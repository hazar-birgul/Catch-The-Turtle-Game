import Phaser from 'phaser';

import { BALANCE } from '../config/balance';
import { type TurtleTypeDefinition } from '../config/turtleTypes';
import { getRenderScale } from '../config/renderScale';

/**
 * The Phaser representation of a catchable target.
 *
 * One class, not one per variant: a turtle is configured entirely by the
 * `TurtleTypeDefinition` it is handed, so a new variant needs no new class and
 * no branch here.
 */

/**
 * Half the turtle's footprint before the difficulty scale. Drawing, spawn
 * placement and hit testing all derive from it, so they cannot drift apart.
 */
const BASE_RADIUS = BALANCE.spawn.targetBaseRadiusPx;

/** Room around the shell for the head and legs, which reach past the radius. */
const TEXTURE_PADDING = 16;

/** The turtle's footprint in logical units: the only system gameplay sees. */
const TEXTURE_SIZE_UNITS = (BASE_RADIUS + TEXTURE_PADDING) * 2;

/**
 * Texture pixels drawn per logical unit. This file is the only place the
 * distinction between the two exists.
 *
 * The display scale divides the density back out, so raising it changes how
 * finely the turtle is drawn and nothing else: footprint, clickable radius and
 * the radius `findSpawnPosition` reserves are identical at any density.
 * `createTurtleImage` exists so callers never have to compensate for it.
 *
 * It matches the camera zoom, so a turtle at logical size S covers `S * scale`
 * device pixels and its texture is exactly that many across — a 1:1 mapping.
 * Relies on the scale being a whole number: a fractional `TEXTURE_SIZE_PX` would
 * be truncated by the canvas and shift the centre the hit circle is anchored to.
 */
const TEXTURE_DENSITY = getRenderScale();

const TEXTURE_SIZE_PX = TEXTURE_SIZE_UNITS * TEXTURE_DENSITY;
const TEXTURE_CENTER_PX = TEXTURE_SIZE_PX / 2;

/** Keyed by variant and density, so a texture is never reused at the wrong size. */
function textureKeyFor(definition: TurtleTypeDefinition): string {
  return `turtle-placeholder-${definition.id}@${String(TEXTURE_DENSITY)}x`;
}

/** The display scale that renders `logicalScale` at its logical footprint. */
function displayScaleFor(logicalScale: number): number {
  return logicalScale / TEXTURE_DENSITY;
}

function shade(color: number, amount: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);

  return (amount < 0 ? c.darken(-amount) : c.lighten(amount)).color;
}

/**
 * Bake one variant's placeholder art into a texture, so each turtle on screen is
 * a textured quad rather than a Graphics command buffer replayed every frame.
 *
 * Dimensions below are in texture pixels, so the drawing gains detail with
 * density without changing its proportions.
 */
function generateTurtleTexture(scene: Phaser.Scene, definition: TurtleTypeDefinition): void {
  const key = textureKeyFor(definition);

  if (scene.textures.exists(key)) {
    return;
  }

  const base = definition.placeholderColor;
  const shell = shade(base, -28);
  const shellRim = shade(base, 18);
  const limb = shade(base, -8);

  const gfx = scene.make.graphics({ x: 0, y: 0 }, false);

  /** One logical unit, in texture pixels. */
  const unit = TEXTURE_DENSITY;
  const radius = BASE_RADIUS * unit;

  const shellRadiusX = radius;
  const shellRadiusY = radius * 0.82;
  const shellCenterY = TEXTURE_CENTER_PX + radius * 0.08;

  // Legs first, so the shell overlaps them and they read as limbs, not blobs.
  gfx.fillStyle(limb, 1);
  for (const [dx, dy] of [
    [-0.66, -0.5],
    [0.66, -0.5],
    [-0.72, 0.52],
    [0.72, 0.52],
  ] as const) {
    gfx.fillCircle(
      TEXTURE_CENTER_PX + shellRadiusX * dx,
      shellCenterY + shellRadiusY * dy,
      radius * 0.24,
    );
  }

  // Head.
  const headY = shellCenterY - shellRadiusY - radius * 0.22;
  gfx.fillCircle(TEXTURE_CENTER_PX, headY, radius * 0.31);

  // Shell.
  gfx.fillStyle(shell, 1);
  gfx.fillEllipse(TEXTURE_CENTER_PX, shellCenterY, shellRadiusX * 2, shellRadiusY * 2);
  gfx.lineStyle(Math.max(2 * unit, radius * 0.07), shellRim, 1);
  gfx.strokeEllipse(TEXTURE_CENTER_PX, shellCenterY, shellRadiusX * 2, shellRadiusY * 2);

  // Shell plates: one centre plate and a ring of segments, so the two variants
  // are distinguishable by shape as well as by colour.
  gfx.fillStyle(base, 1);
  gfx.fillEllipse(TEXTURE_CENTER_PX, shellCenterY, shellRadiusX * 0.72, shellRadiusY * 0.72);

  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI * 2 * i) / 6 + Math.PI / 6;
    gfx.fillCircle(
      TEXTURE_CENTER_PX + Math.cos(angle) * shellRadiusX * 0.62,
      shellCenterY + Math.sin(angle) * shellRadiusY * 0.62,
      radius * 0.15,
    );
  }

  // Eyes, in the page's near-black so they read at any size.
  gfx.fillStyle(0x050505, 1);
  gfx.fillCircle(TEXTURE_CENTER_PX - radius * 0.13, headY - radius * 0.05, 3 * unit);
  gfx.fillCircle(TEXTURE_CENTER_PX + radius * 0.13, headY - radius * 0.05, 3 * unit);

  gfx.generateTexture(key, TEXTURE_SIZE_PX, TEXTURE_SIZE_PX);
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

/**
 * A non-interactive turtle at a logical scale, for the menu preview. Keeps
 * `TEXTURE_DENSITY` out of the scenes.
 */
export function createTurtleImage(
  scene: Phaser.Scene,
  x: number,
  y: number,
  definition: TurtleTypeDefinition,
  logicalScale = 1,
): Phaser.GameObjects.Image {
  return scene.add.image(x, y, textureKeyFor(definition)).setScale(displayScaleFor(logicalScale));
}

/** Half a turtle's on-screen footprint, in logical units, at the given scale. */
export function turtleRadiusAt(scale: number): number {
  return BASE_RADIUS * scale;
}

export class Turtle extends Phaser.GameObjects.Image {
  public readonly definition: TurtleTypeDefinition;

  private lifetimeTimer: Phaser.Time.TimerEvent | null = null;

  /** A target must resolve exactly once, as either caught or escaped. */
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
    this.setScale(displayScaleFor(scale));

    /*
     * The same circle the drawing and the spawn placement use, in un-scaled
     * texture space. Phaser transforms the pointer into that space, so the
     * clickable radius tracks `setScale` and cannot disagree with the visual.
     * Radius and display scale both carry the density, so it cancels out.
     */
    this.setInteractive({
      hitArea: new Phaser.Geom.Circle(
        TEXTURE_CENTER_PX,
        TEXTURE_CENTER_PX,
        BASE_RADIUS * TEXTURE_DENSITY,
      ),
      // Wrapped rather than passed by reference so the callback carries no
      // implicit `this` binding of its own.
      hitAreaCallback: (area: Phaser.Geom.Circle, x: number, y: number): boolean =>
        Phaser.Geom.Circle.Contains(area, x, y),
      useHandCursor: true,
    });

    scene.add.existing(this);
  }

  /**
   * Half the on-screen footprint in logical units, for spawn placement.
   * `this.scale` is density-divided, so multiplying the density back in recovers
   * the logical scale.
   */
  public get displayRadius(): number {
    return turtleRadiusAt(this.scale * TEXTURE_DENSITY);
  }

  public get isResolved(): boolean {
    return this.resolved;
  }

  /** The timer belongs to the scene Clock, so it freezes and dies with the scene. */
  public startLifetime(lifetimeMs: number, onEscape: (turtle: Turtle) => void): void {
    this.lifetimeTimer = this.scene.time.delayedCall(lifetimeMs, () => {
      this.lifetimeTimer = null;
      onEscape(this);
    });
  }

  /**
   * Take ownership of this target's single outcome. True for the first caller
   * only, so a click landing in the same frame the lifetime expires cannot
   * register both a hit and an escape.
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
