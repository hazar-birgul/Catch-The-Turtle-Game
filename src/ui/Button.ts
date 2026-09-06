import Phaser from 'phaser';

import { BUTTON, createText, FILL, TEXT } from './theme';

/**
 * A rectangle with a label that responds to a pointer press.
 *
 * A factory rather than a class: there is no per-button behaviour to inherit,
 * only configuration. `primary` is the filled call to action, one per screen;
 * `secondary` is a dark surface with a hairline border.
 */

export interface ButtonOptions {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly onPress: () => void;
  readonly width?: number;
  readonly height?: number;
  readonly fontSize?: number;
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
    width = BUTTON.width,
    height = BUTTON.height,
    fontSize = BUTTON.fontSize,
    variant = 'primary',
  } = options;

  const isPrimary = variant === 'primary';

  // Hover darkens rather than lightens, so the pressed state has somewhere to go.
  const idleFill = isPrimary ? FILL.accent : FILL.surface;
  const hoverFill = isPrimary ? FILL.accentPressed : FILL.surfaceHover;
  const idleStroke = isPrimary ? FILL.accent : FILL.border;
  const hoverStroke = isPrimary ? FILL.accentPressed : FILL.accent;

  const background = scene.add
    .rectangle(x, y, width, height, idleFill)
    .setStrokeStyle(BUTTON.borderWidth, idleStroke)
    .setInteractive({ useHandCursor: true });

  const text = createText(scene, x, y, label, {
    fontSize,
    color: isPrimary ? TEXT.onAccent : TEXT.primary,
    letterSpacing: BUTTON.letterSpacing,
  }).setOrigin(0.5);

  const setState = (fill: number, stroke: number): void => {
    background.setFillStyle(fill);
    background.setStrokeStyle(BUTTON.borderWidth, stroke);
  };

  background.on('pointerover', () => {
    setState(hoverFill, hoverStroke);
  });
  background.on('pointerout', () => {
    setState(idleFill, idleStroke);
  });

  // `pointerdown` rather than `pointerup` so the response feels immediate, and
  // because mouse, touch and pen all arrive through the same pointer event.
  background.on('pointerdown', () => {
    // Label and background tween together so they never separate; 0.97 is shallow
    // enough that the text does not visibly resample.
    scene.tweens.add({
      targets: [background, text],
      scale: 0.97,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeOut',
    });

    onPress();
  });

  return { background, label: text };
}
