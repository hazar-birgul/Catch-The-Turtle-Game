import Phaser from 'phaser';

import { BALANCE } from '../config/balance';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/dimensions';
import { countdownCueAt, FEEL } from '../config/feel';
import { TURTLE_TYPES } from '../config/turtleTypes';
import { ensureTurtleTextures, Turtle, turtleRadiusAt } from '../entities/Turtle';
import { difficultyAt, type DifficultyParams } from '../systems/difficulty';
import type { RandomSource } from '../systems/random';
import {
  accuracyOf,
  attemptsOf,
  comboMultiplier,
  createRoundState,
  registerEscape,
  registerHit,
  registerMiss,
  registerSpawn,
  summarizeRound,
  type RoundState,
} from '../systems/scoring';
import {
  buildExclusionZones,
  buildSpawnPool,
  findSpawnPosition,
  selectTurtleType,
  type PlayArea,
  type Rect,
} from '../systems/spawn';
import { getAudioService } from '../services/AudioService';
import { Effects } from '../ui/Effects';
import { Hud } from '../ui/Hud';
import { FILL, TEXT } from '../ui/theme';
import { applyLogicalViewport } from '../ui/viewport';
import { createSeededRandom } from '../utils/phaserRandom';
import type { GameOverPayload } from './GameOverScene';

/**
 * The playable round.
 *
 * An adapter, not a rulebook: it owns what only Phaser can own — the clock, the
 * timers, the sprites, the pointer — and delegates every decision to the pure
 * systems. A gameplay number appearing in this file is a bug; it belongs in
 * `config/balance.ts`.
 */

/**
 * One status rather than two flags, so the end of the round cannot run twice.
 * `ending` refuses input while the summary is being built; `ended` means the
 * transition is queued.
 */
type RoundStatus = 'running' | 'ending' | 'ended';

const PLAY_AREA: PlayArea = { width: GAME_WIDTH, height: GAME_HEIGHT };

// By key, not by class: importing them would cycle between scenes that start
// each other.
const PAUSE_SCENE_KEY = 'Pause';
const GAME_OVER_SCENE_KEY = 'GameOver';

export class GameScene extends Phaser.Scene {
  public static readonly KEY = 'Game';

  private status: RoundStatus = 'running';

  /**
   * The authoritative round clock, accumulated from the frame delta. Phaser stops
   * calling `update` on a paused scene, so pausing freezes the round with no
   * `if (paused)` checks. The countdown, difficulty curve and spawn interval all
   * read this one value, so they cannot drift apart.
   */
  private elapsedMs = 0;

  private state: RoundState = createRoundState();

  private random: RandomSource = () => 0;

  private turtles: Turtle[] = [];

  private exclusionZones: readonly Rect[] = [];

  /**
   * The single pending spawn. Each tick schedules exactly one successor, so a
   * replay cannot stack a second scheduler and compound the spawn rate.
   */
  private spawnTimer: Phaser.Time.TimerEvent | null = null;

  private hud!: Hud;

  private effects!: Effects;

  private readonly audio = getAudioService();

  /** Guards against replaying a countdown cue when the HUD refreshes mid-second. */
  private cuedSecond = -1;

  /** Cached so the HUD is only redrawn when the displayed second changes. */
  private displayedSeconds = -1;

  public constructor() {
    super(GameScene.KEY);
  }

  /**
   * Reset here rather than in the constructor: the constructor runs once per
   * game, `init` runs on every start including a replay. This is what makes a
   * replayed round indistinguishable from a first one.
   */
  public init(): void {
    this.status = 'running';
    this.elapsedMs = 0;
    this.state = createRoundState();
    this.turtles = [];
    this.spawnTimer = null;
    this.displayedSeconds = -1;
    this.cuedSecond = -1;
    this.random = createSeededRandom().random;
    this.exclusionZones = buildExclusionZones(PLAY_AREA);
  }

  public create(): void {
    applyLogicalViewport(this);

    ensureTurtleTextures(this, TURTLE_TYPES);

    this.cameras.main.setBackgroundColor(FILL.background);

    this.effects = new Effects(this);
    this.audio.attach(this.sound);

    this.hud = new Hud(this, {
      onPause: () => {
        this.pauseRound();
      },
      onToggleMute: () => this.audio.toggleMute(),
      initiallyMuted: this.audio.isMuted(),
    });
    this.refreshHud();

    this.input.on('pointerdown', this.handlePointerDown);
    this.input.keyboard?.on('keydown-ESC', this.pauseRound);
    this.input.keyboard?.on('keydown-P', this.pauseRound);

    this.events.once('shutdown', this.handleShutdown);

    this.scheduleNextSpawn(BALANCE.spawn.firstSpawnDelayMs);
  }

  public override update(_time: number, delta: number): void {
    if (this.status !== 'running') {
      return;
    }

    const duration = BALANCE.round.durationMs;

    this.elapsedMs = Math.min(this.elapsedMs + delta, duration);

    const remainingSeconds = Math.ceil((duration - this.elapsedMs) / 1000);

    if (remainingSeconds !== this.displayedSeconds) {
      this.displayedSeconds = remainingSeconds;
      this.refreshHud();
      this.cueCountdown(remainingSeconds);
    }

    if (this.elapsedMs >= duration) {
      this.endRound();
    }
  }

  /**
   * One tick per second of the closing countdown, keyed off the round clock so
   * it cannot double-fire when the HUD refreshes for a catch in the same second.
   */
  private cueCountdown(remainingSeconds: number): void {
    if (remainingSeconds === this.cuedSecond) {
      return;
    }

    this.cuedSecond = remainingSeconds;

    const cue = countdownCueAt(remainingSeconds);

    if (cue === null) {
      return;
    }

    this.audio.play(cue === 'final' ? 'tick-final' : 'tick');

    if (cue === 'final') {
      this.hud.pulseTime();
    }
  }

  /* ---------------------------------------------------------------- *
   * Spawning
   * ---------------------------------------------------------------- */

  /**
   * A one-shot chain rather than a repeating timer: `spawnIntervalMs` changes
   * continuously, and a repeating timer would keep the interval it was created
   * with.
   */
  private scheduleNextSpawn(delayMs: number): void {
    this.spawnTimer = this.time.delayedCall(delayMs, this.onSpawnTick);
  }

  private readonly onSpawnTick = (): void => {
    this.spawnTimer = null;

    if (this.status !== 'running') {
      return;
    }

    const difficulty = difficultyAt(this.elapsedMs);

    this.trySpawn(difficulty);
    this.scheduleNextSpawn(difficulty.spawnIntervalMs);
  };

  /**
   * A tick that cannot spawn simply passes — concurrency reached, or no valid
   * placement. Forcing one would override a deliberate limit.
   */
  private trySpawn(difficulty: DifficultyParams): void {
    if (this.turtles.length >= difficulty.maxConcurrent) {
      return;
    }

    const definition = selectTurtleType(buildSpawnPool(difficulty.progress), this.random);
    const scale = difficulty.targetScale * definition.scaleMultiplier;

    const position = findSpawnPosition({
      area: PLAY_AREA,
      targetRadius: turtleRadiusAt(scale),
      exclusionZones: this.exclusionZones,
      existingPositions: this.turtles.map((turtle) => ({ x: turtle.x, y: turtle.y })),
      random: this.random,
      // margin, separation and the attempt budget all default to BALANCE.spawn.
    });

    if (position === null) {
      return;
    }

    const turtle = new Turtle(this, position.x, position.y, definition, scale);

    this.turtles.push(turtle);
    this.state = registerSpawn(this.state);

    turtle.startLifetime(
      difficulty.targetLifetimeMs * definition.lifetimeMultiplier,
      this.handleEscape,
    );
  }

  /* ---------------------------------------------------------------- *
   * Input
   * ---------------------------------------------------------------- */

  /**
   * One pointer press, exactly one outcome.
   *
   * Phaser emits the scene-level `pointerdown` once per press with everything
   * under the pointer, so resolving it in a single handler makes "hit or miss,
   * never both" structural. No turtle registers a `pointerdown` of its own.
   */
  private readonly handlePointerDown = (
    pointer: Phaser.Input.Pointer,
    currentlyOver: Phaser.GameObjects.GameObject[],
  ): void => {
    if (this.status !== 'running') {
      return;
    }

    const turtle = currentlyOver.find((object): object is Turtle => object instanceof Turtle);

    if (turtle !== undefined) {
      this.handleHit(turtle);

      return;
    }

    // A non-turtle interactive object is a HUD control. Pressing the interface
    // is not a failed attempt, so it must not cost the player their combo.
    if (currentlyOver.length > 0) {
      return;
    }

    const previous = this.state;

    this.state = registerMiss(previous);

    this.effects.missMarker(pointer.worldX, pointer.worldY);
    this.audio.play('miss');
    this.announceComboBreak(previous.combo);
    this.refreshHud();
  };

  private handleHit(turtle: Turtle): void {
    if (!turtle.claim()) {
      return;
    }

    // Detached before scoring so the target stops counting toward concurrency
    // and placement the instant it is caught, exactly as it did before the catch
    // animation existed. The turtle destroys itself when the animation ends.
    this.detachTurtle(turtle);

    const previous = this.state;

    this.state = registerHit(previous, turtle.definition);

    // The figure shown is the difference the scoring system actually applied,
    // never a separately computed one.
    const awarded = this.state.score - previous.score;
    const isGolden = turtle.definition.id === 'golden';

    this.effects.floatingScore(turtle.x, turtle.y, awarded, isGolden);
    this.effects.catchBurst(turtle.x, turtle.y, turtle.definition);
    this.audio.play(isGolden ? 'catch-golden' : 'catch');

    this.announceComboTier(previous.combo, this.state.combo);
    this.refreshHud();

    turtle.playCatch();
  }

  /** Louder feedback only when the multiplier tier actually steps up. */
  private announceComboTier(previousCombo: number, currentCombo: number): void {
    const previousMultiplier = comboMultiplier(previousCombo);
    const currentMultiplier = comboMultiplier(currentCombo);

    if (currentMultiplier <= previousMultiplier) {
      return;
    }

    this.hud.punchCombo();
    this.effects.banner(
      `COMBO x${String(currentMultiplier)}`,
      TEXT.amber,
      GAME_HEIGHT / 2 - 60,
      FEEL.combo.bannerMs,
    );
    this.audio.play('combo');
  }

  /** A streak worth noticing has ended. Scoring is untouched by this. */
  private announceComboBreak(previousCombo: number): void {
    if (comboMultiplier(previousCombo) < FEEL.combo.breakAnnounceMultiplier) {
      return;
    }

    this.effects.banner('COMBO LOST', TEXT.muted, GAME_HEIGHT / 2 - 60, FEEL.combo.breakMs);
  }

  /** Arrow property: handed to the turtle as a callback, so it must keep `this`. */
  private readonly handleEscape = (turtle: Turtle): void => {
    if (this.status !== 'running' || !turtle.claim()) {
      return;
    }

    this.detachTurtle(turtle);

    const previous = this.state;

    this.state = registerEscape(previous);

    this.announceComboBreak(previous.combo);
    this.refreshHud();

    turtle.playEscape();
  };

  /**
   * Stop tracking a target without destroying it, so its resolve animation can
   * play out while the round behaves as though it is already gone.
   */
  private detachTurtle(turtle: Turtle): void {
    const index = this.turtles.indexOf(turtle);

    if (index !== -1) {
      this.turtles.splice(index, 1);
    }
  }

  /* ---------------------------------------------------------------- *
   * Pause and end of round
   * ---------------------------------------------------------------- */

  /**
   * Pausing the scene is the whole mechanism: Phaser stops calling `update` (the
   * clock stops), stops ticking the Clock (the spawn chain and every expiry
   * freeze) and refuses input. Nothing needs a paused flag.
   */
  private readonly pauseRound = (): void => {
    if (this.status !== 'running') {
      return;
    }

    this.scene.pause();
    this.scene.launch(PAUSE_SCENE_KEY);
  };

  /**
   * Targets still on screen at zero are removed without registering an escape:
   * the player cannot be expected to catch them after the clock has run out.
   */
  private endRound(): void {
    if (this.status !== 'running') {
      return;
    }

    this.status = 'ending';

    this.stopSpawning();
    this.clearTurtles();
    this.refreshHud();

    this.audio.play('round-over');
    this.effects.banner("TIME'S UP", TEXT.primary, GAME_HEIGHT / 2, FEEL.roundEnd.holdMs);

    const payload: GameOverPayload = { result: summarizeRound(this.state) };

    // A brief beat before the summary so the round has an ending rather than a
    // cut. Short by design: replay has to stay immediate.
    this.time.delayedCall(FEEL.roundEnd.holdMs, () => {
      this.status = 'ended';
      this.scene.start(GAME_OVER_SCENE_KEY, payload);
    });
  }

  private stopSpawning(): void {
    this.spawnTimer?.remove(false);
    this.spawnTimer = null;
  }

  /** Take every live target off the board without scoring it either way. */
  private clearTurtles(): void {
    for (const turtle of this.turtles) {
      // Claiming cancels the expiry timer, so nothing can fire afterwards.
      turtle.claim();
      turtle.destroy();
    }

    this.turtles = [];
  }

  /**
   * Drop this scene's references to the objects Phaser is already destroying.
   *
   * It must **not operate on** those objects, only forget them. Phaser's own
   * plugins register their `SHUTDOWN` listeners when the scene starts, and this
   * hook is registered later, in `create()`, so it runs last: by the time it
   * fires, `DisplayList.shutdown()` has already called `destroy(true)` on every
   * target — which sets each one's `scene` to `undefined` — and the scene Clock
   * has already discarded the spawn tick and every expiry timer.
   *
   * Calling `clearTurtles()` here is what broke Pause -> Main Menu. It reaches
   * `Turtle.claim()`, which calls `disableInteractive()`, and in Phaser 4 that is
   * `this.scene.sys.input.disable(this)` rather than the flag toggle it was in
   * Phaser 3. On an already-destroyed target `this.scene` is `undefined`, so it
   * threw, and the TypeError escaped `SceneManager.processQueue` — abandoning the
   * rest of the queued scene operations. See `PauseScene.quitToMenu`.
   *
   * Nothing leaks by leaving the work to Phaser: `Turtle.destroy()` cancels its
   * own expiry timer, the Clock discards the spawn chain, and `InputPlugin`
   * removes every listener.
   */
  private readonly handleShutdown = (): void => {
    this.spawnTimer = null;
    this.turtles = [];
  };

  /* ---------------------------------------------------------------- *
   * Presentation
   * ---------------------------------------------------------------- */

  private refreshHud(): void {
    const duration = BALANCE.round.durationMs;

    this.hud.update({
      score: this.state.score,
      remainingSeconds: Math.max(0, Math.ceil((duration - this.elapsedMs) / 1000)),
      combo: this.state.combo,
      multiplier: comboMultiplier(this.state.combo),
      accuracy: accuracyOf(this.state),
      attempts: attemptsOf(this.state),
    });
  }
}
