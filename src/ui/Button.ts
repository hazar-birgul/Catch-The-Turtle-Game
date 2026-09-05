import Phaser from 'phaser';

import { FILL, FONT_STACK, TEXT } from './theme';

/**
 * A rectangle with a label that responds to a pointer press.
 *
 * Four scenes need the same thing, which is enough to justify one helper. It is
 * deliberately a small factory function rather than a Button class hierarchy:
 * there is no per-button behaviour to inherit, only configuration.
 */

export interface ButtonOptions {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly onPress: () => void;
  readonly width?: number;
  readonly height?: number;
  readonly fontSize?: number;
  /** `primary` is the filled accent button; `secondary` is outlined. */
  readonly variant?: 'primary' | 'secondary';
}

export interface Button {
  readonly background: Phaser.GameObjects.Rectangle;
  readonly label: Phaser.GameObjects.Text;
}

export function createButton(scene: Phaser.Scene, options: ButtonOptions): Button {
  const {
    x,
    y,
    label,
    onPress,
    width = 220,
    height = 58,
    fontSize = 22,
    variant = 'primary',
  } = options;

  const isPrimary = variant === 'primary';
  const idleFill = isPrimary ? FILL.accent : FILL.panel;
  const hoverFill = isPrimary ? FILL.accentHover : FILL.shell;

  const background = scene.add
    .rectangle(x, y, width, height, idleFill)
    .setStrokeStyle(2, isPrimary ? FILL.accent : FILL.shell)
    .setInteractive({ useHandCursor: true });

  const text = scene.add
    .text(x, y, label, {
      fontFamily: FONT_STACK,
      fontSize: `${String(fontSize)}px`,
      fontStyle: '700',
      color: isPrimary ? TEXT.onAccent : TEXT.primary,
    })
    .setOrigin(0.5);

  background.on('pointerover', () => background.setFillStyle(hoverFill));
  background.on('pointerout', () => background.setFillStyle(idleFill));

  // `pointerdown` rather than `pointerup` so the response feels immediate, and
  // because mouse, touch and pen all arrive through the same pointer event.
  background.on('pointerdown', () => {
    scene.tweens.add({
      targets: [background, text],
      scale: 0.95,
      duration: 80,
      yoyo: true,
      ease: 'Quad.easeOut',
    });

    onPress();
  });

  return { background, label: text };
}
