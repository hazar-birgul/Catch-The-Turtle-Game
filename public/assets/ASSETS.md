# Assets

## Audio

`public/assets/audio/*.wav`

| File               | Cue                                 |
| ------------------ | ----------------------------------- |
| `catch.wav`        | Normal turtle caught                |
| `catch-golden.wav` | Golden turtle caught                |
| `miss.wav`         | Click that hit nothing              |
| `combo.wav`        | Combo multiplier reached a new tier |
| `tick.wav`         | Countdown, final 10 to 6 seconds    |
| `tick-final.wav`   | Countdown, final 5 seconds          |
| `round-over.wav`   | Round ended                         |

**Provenance:** all of these were generated specifically for Catch the Turtle by
[`tools/generate-audio.mjs`](../../tools/generate-audio.mjs), which synthesises each cue from
sine partials and writes 16-bit mono WAV files at 22.05 kHz. No third-party, sampled or
downloaded audio is used, and none is derived from the media preserved under `legacy/python/`.

Regenerate with:

```bash
node tools/generate-audio.mjs
```

## Images

None. Every visual in the browser game — turtles, buttons, panels, particles — is drawn
programmatically at runtime with Phaser's `Graphics` and baked into a texture.
