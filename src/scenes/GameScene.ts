import Phaser from 'phaser';

import { BALANCE } from '../config/balance';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/dimensions';
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
import { Hud } from '../ui/Hud';
import { FILL } from '../ui/theme';
import { createSeededRandom } from '../utils/phaserRandom';
import type { GameOverPayload } from './GameOverScene';

/**
 * The playable round.
 *
 * This scene is an *adapter*, not a rulebook. It owns the things only Phaser can
 * own — the clock, the timers, the sprites, the pointer — and delegates every
 * decision to the pure systems built in P2:
 *
 * - what the round feels like right now → `difficultyAt`
 * - what to spawn → `buildSpawnPool` + `selectTurtleType`
 * - where to put it → `findSpawnPosition`
 * - what a catch, a miss or an escape does to the score → `systems/scoring`
 *
 * Nothing in here recomputes any of that. If a gameplay number appears in this
 * file it is a bug: it belongs in `config/balance.ts`.
 */

/**
 * One explicit status, so the end of the round cannot run twice.
 *
 * `ending` is the window in which the round has stopped accepting input but the
 * summary has not been handed over yet; `ended` means the transition is already
 * queued. Two flags would allow a state that means nothing, so this is one.
 */
type RoundStatus = 'running' | 'ending' | 'ended';

const PLAY_AREA: PlayArea = { width: GAME_WIDTH, height: GAME_HEIGHT };

/**
 * Sibling scenes are addressed by key rather than by importing their classes,
 * which would create an import cycle between scenes that start each other.
 */
const PAUSE_SCENE_KEY = 'Pause';
const GAME_OVER_SCENE_KEY = 'GameOver';

export class GameScene extends Phaser.Scene {
  public static readonly KEY = 'Game';

  private status: RoundStatus = 'running';

  /**
   * The authoritative round clock, in milliseconds.
   *
   * Accumulated from the frame delta in `update`, which Phaser stops calling
   * while the scene is paused — so pausing freezes the round for free, with no
   * `if (paused)` checks anywhere. It is also the only clock: the countdown, the
   * difficulty curve and the spawn interval all read this one value, so they
   * cannot drift apart the way a chain of one-second timer events would.
   */
  private elapsedMs = 0;

  private state: RoundState = createRoundState();

  private random: RandomSource = () => 0;

  private turtles: Turtle[] = [];

  private exclusionZones: readonly Rect[] = [];

  /**
   * The single pending spawn. There is never more than one: each tick schedules
   * the next, so a replay cannot stack a second scheduler on top of the first —
   * which is precisely how the legacy game's difficulty compounded (defect 3).
   */
  private spawnTimer: Phaser.Time.TimerEvent | null = null;

  private hud!: Hud;

  /** Cached so the HUD is only redrawn when the displayed second changes. */
  private displayedSeconds = -1;

  public constructor() {
    super(GameScene.KEY);
  }

  /**
   * Every piece of round state is reset here rather than in the constructor,
   * because the constructor runs once per game while `init` runs on every start
   * — including a replay. This is the single guarantee that a replayed round is
   * indistinguishable from a first one.
   */
  public init(): void {
    this.status = 'running';
    this.elapsedMs = 0;
    this.state = createRoundState();
    this.turtles = [];
    this.spawnTimer = null;
    this.displayedSeconds = -1;
    this.random = createSeededRandom().random;
    this.exclusionZones = buildExclusionZones(PLAY_AREA);
  }

  public create(): void {
    ensureTurtleTextures(this, TURTLE_TYPES);

    this.cameras.main.setBackgroundColor(FILL.background);
    this.drawPlayfield();

    this.hud = new Hud(this, () => {
      this.pauseRound();
    });
    this.refreshHud();

    this.input.on('pointerdown', this.handlePointerDown);
    this.input.keyboard?.on('keydown-ESC', this.pauseRound);
    this.input.keyboard?.on('keydown-P', this.pauseRound);

    // Phaser's own plugins detach their listeners, destroy the display list and
    // shut the Clock down on scene shutdown. This hook only clears what Phaser
    // does not own: this scene's references to objects it is about to destroy.
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
    }

    if (this.elapsedMs >= duration) {
      this.endRound();
    }
  }

  /* ---------------------------------------------------------------- *
   * Spawning
   * ---------------------------------------------------------------- */

  /**
   * Schedule one spawn tick.
   *
   * A one-shot chain rather than a looping timer, because `spawnIntervalMs`
   * changes continuously through the round: each tick reads the interval that
   * applies *now* and books the next one accordingly. A single repeating timer
   * would be stuck with whatever interval it was created with.
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
   * Attempt one spawn. A tick that cannot spawn simply passes: the concurrency
   * limit is reached, or placement found nowhere valid. Forcing a spawn would
   * mean overriding one of those two deliberate limits.
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
   * One pointer press produces exactly one outcome.
   *
   * Phaser emits the scene-level `pointerdown` once per press with the list of
   * interactive objects under the pointer, so resolving the outcome here — in a
   * single handler — is what makes "hit or miss, never both" structural rather
   * than a matter of getting event propagation right between two listeners. No
   * turtle registers a `pointerdown` of its own.
   */
  private readonly handlePointerDown = (
    _pointer: Phaser.Input.Pointer,
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

    // An interactive object that is not a turtle is a HUD control (the pause
    // button). Pressing the interface is not an attempt at a target, so it must
    // not cost the player their combo.
    if (currentlyOver.length > 0) {
      return;
    }

    this.state = registerMiss(this.state);
    this.refreshHud();
  };

  private handleHit(turtle: Turtle): void {
    if (!turtle.claim()) {
      return;
    }

    this.removeTurtle(turtle);
    this.state = registerHit(this.state, turtle.definition);
    this.refreshHud();
  }

  /**
   * A target that ran out of time. Arrow property because it is handed to the
   * turtle as a callback and must keep this scene as its `this`.
   */
  private readonly handleEscape = (turtle: Turtle): void => {
    if (this.status !== 'running' || !turtle.claim()) {
      return;
    }

    this.removeTurtle(turtle);
    this.state = registerEscape(this.state);
    this.refreshHud();
  };

  private removeTurtle(turtle: Turtle): void {
    const index = this.turtles.indexOf(turtle);

    if (index !== -1) {
      this.turtles.splice(index, 1);
    }

    turtle.destroy();
  }

  /* ---------------------------------------------------------------- *
   * Pause and end of round
   * ---------------------------------------------------------------- */

  /**
   * Hand control to the overlay and pause this scene.
   *
   * Pausing the scene is the whole mechanism: Phaser stops calling `update` (so
   * the round clock stops), stops ticking the Clock (so the spawn chain and every
   * target's expiry freeze) and refuses input (so a click on a frozen turtle
   * cannot score). Nothing needs a paused flag.
   */
  private readonly pauseRound = (): void => {
    if (this.status !== 'running') {
      return;
    }

    this.scene.pause();
    this.scene.launch(PAUSE_SCENE_KEY);
  };

  /**
   * End the round exactly once.
   *
   * POLICY — targets still on screen when the clock hits zero are removed
   * *without* registering an escape. The round is over; the player cannot be
   * expected to catch them, so taking their combo and inflating the escape count
   * after the timer has run out would be punishing them for the clock.
   */
  private endRound(): void {
    if (this.status !== 'running') {
      return;
    }

    this.status = 'ending';

    this.stopSpawning();
    this.clearTurtles();
    this.refreshHud();

    const payload: GameOverPayload = { result: summarizeRound(this.state) };

    this.status = 'ended';
    this.scene.start(GAME_OVER_SCENE_KEY, payload);
  }

  private stopSpawning(): void {
    this.spawnTimer?.remove(false);
    this.spawnTimer = null;
  }

  /** Take every live target off the board without scoring it either way. */
  private clearTurtles(): void {
    for (const turtle of this.turtles) {
      // Claiming first cancels the expiry timer, so nothing can fire afterwards.
      turtle.claim();
      turtle.destroy();
    }

    this.turtles = [];
  }

  private readonly handleShutdown = (): void => {
    this.stopSpawning();
    this.clearTurtles();
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

  /** A frame at the logical bounds, so a scaling fault is visible on sight. */
  private drawPlayfield(): void {
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH - 8, GAME_HEIGHT - 8)
      .setStrokeStyle(2, FILL.shell);
  }
}
