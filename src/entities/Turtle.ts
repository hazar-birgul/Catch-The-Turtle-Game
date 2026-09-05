import Phaser from 'phaser';

import { BALANCE } from '../config/balance';
import { type TurtleTypeDefinition } from '../config/turtleTypes';

/**
 * The Phaser representation of a catchable target.
 *
 * There is deliberately one class, not one per variant: a turtle is configured
 * entirely by the `TurtleTypeDefinition` it is handed, exactly as the data-driven
 * design in `config/turtleTypes.ts` intends. Adding a variant needs no new class,
 * no new texture code and no branch in here.
 *
 * The turtle owns two things Phaser will not clean up correctly on its own: its
 * expiry timer, and the single-resolution guarantee that stops one target being
 * both caught and escaped.
 */

/**
 * Half the turtle's on-screen footprint before the difficulty scale is applied.
 *
 * Drawing, spawn placement and hit testing all derive from this one value, so
 * they cannot drift apart the way the legacy game's hard-coded 20px hit radius
 * drifted from its `shapesize(2, 2)` sprite (defect 12).
 */
const BASE_RADIUS = BALANCE.spawn.targetBaseRadiusPx;

/** Room around the shell for the head and legs, which reach past the radius. */
const TEXTURE_PADDING = 16;

const TEXTURE_SIZE = (BASE_RADIUS + TEXTURE_PADDING) * 2;
const TEXTURE_CENTER = TEXTURE_SIZE / 2;

/** Placeholder textures are keyed by variant so each is generated exactly once. */
function textureKeyFor(definition: TurtleTypeDefinition): string {
  return `turtle-placeholder-${definition.id}`;
}

function shade(color: number, amount: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);

  return (amount < 0 ? c.darken(-amount) : c.lighten(amount)).color;
}

/**
 * Draw the temporary turtle for one variant into a texture.
 *
 * Generated rather than loaded: P3 ships no artwork, and baking the drawing into
 * a texture once means every turtle on screen is a cheap textured quad instead of
 * a Graphics object replaying its command buffer every frame.
 */
function generateTurtleTexture(scene: Phaser.Scene, definition: TurtleTypeDefinition): void {
  const key = textureKeyFor(definition);

  if (scene.textures.exists(key)) {
    return;
  }

  const base = definition.placeholderColor;
  const shell = shade(base, -26);
  const shellRim = shade(base, 16);
  const limb = shade(base, -6);

  const gfx = scene.make.graphics({ x: 0, y: 0 }, false);

  const shellRadiusX = BASE_RADIUS;
  const shellRadiusY = BASE_RADIUS * 0.82;
  const shellCenterY = TEXTURE_CENTER + BASE_RADIUS * 0.08;

  // Legs first, so the shell overlaps them and they read as limbs, not blobs.
  gfx.fillStyle(limb, 1);
  for (const [dx, dy] of [
    [-0.66, -0.5],
    [0.66, -0.5],
    [-0.72, 0.52],
    [0.72, 0.52],
  ] as const) {
    gfx.fillCircle(
      TEXTURE_CENTER + shellRadiusX * dx,
      shellCenterY + shellRadiusY * dy,
      BASE_RADIUS * 0.24,
    );
  }

  // Head.
  const headY = shellCenterY - shellRadiusY - BASE_RADIUS * 0.22;
  gfx.fillCircle(TEXTURE_CENTER, headY, BASE_RADIUS * 0.31);

  // Shell.
  gfx.fillStyle(shell, 1);
  gfx.fillEllipse(TEXTURE_CENTER, shellCenterY, shellRadiusX * 2, shellRadiusY * 2);
  gfx.lineStyle(Math.max(2, BASE_RADIUS * 0.07), shellRim, 1);
  gfx.strokeEllipse(TEXTURE_CENTER, shellCenterY, shellRadiusX * 2, shellRadiusY * 2);

  // Shell plates: one centre plate and a ring of segments, so the two variants
  // are distinguishable by shape as well as by colour.
  gfx.fillStyle(base, 1);
  gfx.fillEllipse(TEXTURE_CENTER, shellCenterY, shellRadiusX * 0.72, shellRadiusY * 0.72);

  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI * 2 * i) / 6 + Math.PI / 6;
    gfx.fillCircle(
      TEXTURE_CENTER + Math.cos(angle) * shellRadiusX * 0.62,
      shellCenterY + Math.sin(angle) * shellRadiusY * 0.62,
      BASE_RADIUS * 0.15,
    );
  }

  // Eyes.
  gfx.fillStyle(0x0f1f1b, 1);
  gfx.fillCircle(TEXTURE_CENTER - BASE_RADIUS * 0.13, headY - BASE_RADIUS * 0.05, 3);
  gfx.fillCircle(TEXTURE_CENTER + BASE_RADIUS * 0.13, headY - BASE_RADIUS * 0.05, 3);

  gfx.generateTexture(key, TEXTURE_SIZE, TEXTURE_SIZE);
  gfx.destroy();
}

/** Generate every variant's placeholder texture. Safe to call more than once. */
export function ensureTurtleTextures(
  scene: Phaser.Scene,
  definitions: readonly TurtleTypeDefinition[],
): void {
  for (const definition of definitions) {
    generateTurtleTexture(scene, definition);
  }
}

/** The texture key a variant's placeholder art is registered under. */
export function turtleTextureKey(definition: TurtleTypeDefinition): string {
  return textureKeyFor(definition);
}

/** Half a turtle's on-screen footprint at the given combined scale. */
export function turtleRadiusAt(scale: number): number {
  return BASE_RADIUS * scale;
}

export class Turtle extends Phaser.GameObjects.Image {
  public readonly definition: TurtleTypeDefinition;

  private lifetimeTimer: Phaser.Time.TimerEvent | null = null;

  /**
   * Set the first time this target is claimed, by whichever of "caught" or
   * "escaped" gets there first. A target must resolve exactly once.
   */
  private resolved = false;

  public constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    definition: TurtleTypeDefinition,
    scale: number,
  ) {
    super(scene, x, y, textureKeyFor(definition));

    this.definition = definition;
    this.setScale(scale);

    /*
     * The hit area is the same circle the drawing and the spawn placement use,
     * expressed in un-scaled texture space. Phaser transforms the pointer into
     * that space before testing, so the clickable radius automatically tracks
     * `setScale` — the visual and the hitbox cannot disagree.
     */
    this.setInteractive({
      hitArea: new Phaser.Geom.Circle(TEXTURE_CENTER, TEXTURE_CENTER, BASE_RADIUS),
      // Wrapped rather than passed by reference so the callback carries no
      // implicit `this` binding of its own.
      hitAreaCallback: (area: Phaser.Geom.Circle, x: number, y: number): boolean =>
        Phaser.Geom.Circle.Contains(area, x, y),
      useHandCursor: true,
    });

    scene.add.existing(this);
  }

  /** Half this turtle's actual on-screen footprint, for spawn placement. */
  public get displayRadius(): number {
    return turtleRadiusAt(this.scale);
  }

  public get isResolved(): boolean {
    return this.resolved;
  }

  /**
   * Start the escape countdown. The timer belongs to the scene's Clock, so it
   * freezes with the scene and is destroyed with it.
   */
  public startLifetime(lifetimeMs: number, onEscape: (turtle: Turtle) => void): void {
    this.lifetimeTimer = this.scene.time.delayedCall(lifetimeMs, () => {
      this.lifetimeTimer = null;
      onEscape(this);
    });
  }

  /**
   * Take ownership of this target's single outcome.
   *
   * Returns `true` for the first caller only, and cancels the expiry timer, so a
   * click that lands in the same frame the lifetime runs out cannot register
   * both a hit and an escape.
   */
  public claim(): boolean {
    if (this.resolved) {
      return false;
    }

    this.resolved = true;
    this.cancelLifetime();
    this.disableInteractive();

    return true;
  }

  public override destroy(fromScene?: boolean): void {
    this.cancelLifetime();
    super.destroy(fromScene);
  }

  private cancelLifetime(): void {
    this.lifetimeTimer?.remove(false);
    this.lifetimeTimer = null;
  }
}
