/**
 * Generates the game's sound effects as small mono WAV files.
 *
 * Every cue is synthesised from sine tones here, so the audio in this repository
 * is original to the project and carries no third-party licence. Re-run with
 * `node tools/generate-audio.mjs` after changing a cue.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 22050;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'audio');

/** Exponential decay with a short attack, so cues never click on/off. */
function envelope(t, duration, attack = 0.004, decay = 5) {
  const attackGain = t < attack ? t / attack : 1;
  const release = Math.min(1, (duration - t) / 0.01);

  return attackGain * Math.exp((-decay * t) / duration) * Math.max(0, release);
}

/** Sum of sine partials; `partials` are [relativeFrequency, relativeGain] pairs. */
function tone(frequency, t, partials = [[1, 1]]) {
  let value = 0;

  for (const [ratio, gain] of partials) {
    value += Math.sin(2 * Math.PI * frequency * ratio * t) * gain;
  }

  return value;
}

/** Render a cue from a `(t) => sample` function into 16-bit PCM. */
function render(duration, amplitude, sampleAt) {
  const frameCount = Math.floor(SAMPLE_RATE * duration);
  const samples = new Int16Array(frameCount);

  for (let i = 0; i < frameCount; i += 1) {
    const t = i / SAMPLE_RATE;
    const value = sampleAt(t) * envelope(t, duration) * amplitude;

    samples[i] = Math.max(-1, Math.min(1, value)) * 0x7fff;
  }

  return samples;
}

function toWav(samples) {
  const dataBytes = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataBytes);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);

  for (let i = 0; i < samples.length; i += 1) {
    buffer.writeInt16LE(samples[i], 44 + i * 2);
  }

  return buffer;
}

/** Play `notes` as [frequency, startSeconds, lengthSeconds] triples. */
function sequence(notes, partials) {
  return (t) => {
    let value = 0;

    for (const [frequency, start, length] of notes) {
      if (t >= start && t < start + length) {
        const local = t - start;
        value += tone(frequency, local, partials) * Math.exp((-4 * local) / length);
      }
    }

    return value;
  };
}

const CUES = {
  // Short upward blip: reads as "collected" without being shrill.
  catch: {
    duration: 0.11,
    amplitude: 0.32,
    sampleAt: (t) =>
      tone(700 + 500 * (t / 0.11), t, [
        [1, 1],
        [2, 0.25],
      ]),
  },
  // Brighter and longer than a normal catch: a rising third, with a fifth on top.
  'catch-golden': {
    duration: 0.26,
    amplitude: 0.38,
    sampleAt: sequence(
      [
        [880, 0, 0.09],
        [1174, 0.07, 0.09],
        [1568, 0.14, 0.12],
      ],
      [
        [1, 1],
        [2, 0.3],
        [3, 0.12],
      ],
    ),
  },
  // Quiet downward tick. Deliberately dull so mistakes are not punished loudly.
  miss: {
    duration: 0.09,
    amplitude: 0.14,
    sampleAt: (t) =>
      tone(230 - 90 * (t / 0.09), t, [
        [1, 1],
        [1.5, 0.2],
      ]),
  },
  // Three ascending notes, distinct from the catch cue it plays alongside.
  combo: {
    duration: 0.22,
    amplitude: 0.26,
    sampleAt: sequence(
      [
        [784, 0, 0.07],
        [988, 0.06, 0.07],
        [1319, 0.12, 0.1],
      ],
      [
        [1, 1],
        [2, 0.2],
      ],
    ),
  },
  // Restrained click for the closing seconds; this one repeats, so it stays soft.
  tick: {
    duration: 0.05,
    amplitude: 0.11,
    sampleAt: (t) => tone(1000, t, [[1, 1]]),
  },
  // Slightly firmer tick for the final few seconds.
  'tick-final': {
    duration: 0.06,
    amplitude: 0.18,
    sampleAt: (t) =>
      tone(1320, t, [
        [1, 1],
        [2, 0.2],
      ]),
  },
  // Resolved major triad: the round is over, not failed.
  'round-over': {
    duration: 0.5,
    amplitude: 0.3,
    sampleAt: sequence(
      [
        [523, 0, 0.16],
        [659, 0.1, 0.16],
        [784, 0.2, 0.3],
      ],
      [
        [1, 1],
        [2, 0.22],
      ],
    ),
  },
};

mkdirSync(OUT_DIR, { recursive: true });

for (const [name, { duration, amplitude, sampleAt }] of Object.entries(CUES)) {
  const wav = toWav(render(duration, amplitude, sampleAt));
  const path = join(OUT_DIR, `${name}.wav`);

  writeFileSync(path, wav);
  console.log(`${name}.wav  ${(wav.length / 1024).toFixed(1)} kB`);
}
