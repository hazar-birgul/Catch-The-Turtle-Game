import Phaser from 'phaser';

import { FEEL } from '../config/feel';
import { GAME_WIDTH } from '../config/dimensions';
import type { TurtleTypeDefinition } from '../config/turtleTypes';
import { createText, FILL, TEXT } from './theme';

/**
 * Short-lived visual feedback for one scene: floating score, catch particles,
 * miss markers and transient banners.
 *
 * Everything it creates is owned by the scene's display list, Clock and tween
 * manager, so a paused scene freezes every effect and a stopped scene destroys
 * them. The only bookkeeping kept here is the miss-marker cap, which exists
 * because the player controls how fast markers are produced.
 */

const PARTICLE_TEXTURE_KEY = 'fx-particle';
const PARTICLE_TEXTURE_SIZE = 32;

/** How long a banner takes to fade out at the end of its hold. */
const FADE_MS = 180;

function ensureParticleTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(PARTICLE_TEXTURE_KEY)) {
    return;
  }

  const radius = PARTICLE_TEXTURE_SIZE / 2;
  const gfx = scene.make.graphics({ x: 0, y: 0 }, false);

  gfx.fillStyle(0xffffff, 1);
  gfx.fillCircle(radius, radius, radius);
  gfx.generateTexture(PARTICLE_TEXTURE_KEY, PARTICLE_TEXTURE_SIZE, PARTICLE_TEXTURE_SIZE);
  gfx.destroy();
}

export class Effects {
  private readonly missMarkers: Phaser.GameObjects.Arc[] = [];

  public constructor(private readonly scene: Phaser.Scene) {
    ensureParticleTexture(scene);
  }

  /**
   * The points actually awarded, rising from the target.
   *
   * The caller passes the figure the scoring system added; this never computes
   * points of its own.
   */
  public floatingScore(x: number, y: number, points: number, isGolden: boolean): void {
    const feel = FEEL.floatingScore;

    const label = createText(this.scene, x, y - 8, `+${String(points)}`, {
      fontSize: isGolden ? feel.goldenFontSize : feel.fontSize,
      color: isGolden ? TEXT.amber : TEXT.accent,
    }).setOrigin(0.5);

    this.scene.tweens.add({
      targets: label,
      y: y - 8 - feel.riseDistancePx,
      alpha: 0,
      duration: feel.durationMs,
      ease: 'Quad.easeOut',
      onComplete: () => {
        label.destroy();
      },
    });
  }

  public catchBurst(x: number, y: number, definition: TurtleTypeDefinition): void {
    const feel = FEEL.particles;
    const isGolden = definition.id === 'golden';

    const emitter = this.scene.add.particles(x, y, PARTICLE_TEXTURE_KEY, {
      tint: definition.placeholderColor,
      speed: { min: feel.speedMin, max: feel.speedMax },
      angle: { min: 0, max: 360 },
      lifespan: feel.lifespanMs,
      scale: { start: feel.sizePx / PARTICLE_TEXTURE_SIZE, end: 0 },
      alpha: { start: 1, end: 0 },
      emitting: false,
    });

    emitter.explode(isGolden ? feel.goldenCount : feel.normalCount);

    // The emitter outlives its particles by design, so it is removed explicitly.
    // A scene Clock timer freezes with the scene and dies with it.
    this.scene.time.delayedCall(feel.lifespanMs + 80, () => {
      emitter.destroy();
    });
  }

  /**
   * A ring at a click that hit nothing. Capped: the player decides how fast
   * these appear, so the oldest is retired rather than letting them accumulate.
   */
  public missMarker(x: number, y: number): void {
    const feel = FEEL.miss;

    while (this.missMarkers.length >= feel.maxMarkers) {
      const oldest = this.missMarkers.shift();

      if (oldest !== undefined) {
        this.scene.tweens.killTweensOf(oldest);
        oldest.destroy();
      }
    }

    const ring = this.scene.add
      .circle(x, y, feel.radiusPx * 0.35)
      .setStrokeStyle(2, FILL.border)
      .setFillStyle();

    this.missMarkers.push(ring);

    this.scene.tweens.add({
      targets: ring,
      radius: feel.radiusPx,
      alpha: 0,
      duration: feel.durationMs,
      ease: 'Quad.easeOut',
      onComplete: () => {
        const index = this.missMarkers.indexOf(ring);

        if (index !== -1) {
          this.missMarkers.splice(index, 1);
        }

        ring.destroy();
      },
    });
  }

  /** A centred transient line: combo tier reached, combo lost, time's up. */
  public banner(text: string, color: string, y: number, durationMs: number): void {
    const label = createText(this.scene, GAME_WIDTH / 2, y, text, {
      fontSize: 26,
      color,
      letterSpacing: 4,
    })
      .setOrigin(0.5)
      .setScale(0.8);

    this.scene.tweens.add({
      targets: label,
      scale: 1,
      duration: 140,
      ease: 'Back.easeOut',
    });

    this.scene.tweens.add({
      targets: label,
      alpha: 0,
      delay: Math.max(0, durationMs - FADE_MS),
      duration: FADE_MS,
      onComplete: () => {
        label.destroy();
      },
    });
  }
}
