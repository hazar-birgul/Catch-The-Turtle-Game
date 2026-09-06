import { beforeEach, describe, expect, it } from 'vitest';

import { AudioService, type SoundLike } from './AudioService';
import { StorageService, type StorageLike } from './StorageService';

/**
 * The service is tested through the same seam production uses: a `SoundLike`
 * that Phaser's manager satisfies structurally, and an injectable storage.
 */

class FakeSound implements SoundLike {
  public locked = false;
  public mute = false;
  public volume = 1;
  public readonly played: { key: string; volume: number | undefined }[] = [];
  public throwOnPlay = false;

  public play(key: string, config?: { volume?: number }): boolean {
    if (this.throwOnPlay) {
      throw new Error('audio context unavailable');
    }

    this.played.push({ key, volume: config?.volume });

    return true;
  }
}

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe('AudioService', () => {
  let storage: StorageService;
  let sound: FakeSound;
  let audio: AudioService;

  beforeEach(() => {
    storage = new StorageService(memoryStorage());
    sound = new FakeSound();
    audio = new AudioService(storage);
    audio.attach(sound);
  });

  it('plays a cue through the attached manager', () => {
    audio.play('catch');

    expect(sound.played).toHaveLength(1);
    expect(sound.played[0]?.key).toBe('catch');
  });

  it('is silent with no manager attached, rather than throwing', () => {
    const detached = new AudioService(storage);

    expect(() => {
      detached.play('catch');
    }).not.toThrow();
  });

  it('drops cues while the context is locked instead of queueing them', () => {
    sound.locked = true;
    audio.play('catch');
    audio.play('miss');

    sound.locked = false;

    // Nothing was buffered, so unlocking cannot release a burst of stale sounds.
    expect(sound.played).toEqual([]);
  });

  it('reports readiness from the manager lock state', () => {
    expect(audio.isReady()).toBe(true);

    sound.locked = true;

    expect(audio.isReady()).toBe(false);
  });

  it('swallows a manager that throws, so a round is never interrupted', () => {
    sound.throwOnPlay = true;

    expect(() => {
      audio.play('catch');
    }).not.toThrow();
  });

  it('never plays a cue whose file failed to load', () => {
    audio.markUnavailable('tick');
    audio.play('tick');
    audio.play('catch');

    expect(sound.played.map((entry) => entry.key)).toEqual(['catch']);
  });

  it('mutes and unmutes, reporting the new state', () => {
    expect(audio.toggleMute()).toBe(true);
    expect(audio.isMuted()).toBe(true);
    expect(sound.mute).toBe(true);

    audio.play('catch');
    expect(sound.played).toEqual([]);

    expect(audio.toggleMute()).toBe(false);
    audio.play('catch');
    expect(sound.played).toHaveLength(1);
  });

  it('persists mute so it survives a new service on the same storage', () => {
    audio.setMuted(true);

    const restored = new AudioService(storage);

    expect(restored.isMuted()).toBe(true);
  });

  it('re-applies the persisted state whenever a manager is attached', () => {
    audio.setMuted(true);

    const replacement = new FakeSound();

    audio.attach(replacement);

    expect(replacement.mute).toBe(true);
  });

  it('clamps volume through the storage layer and applies it to the manager', () => {
    expect(audio.setVolume(2)).toBe(1);
    expect(sound.volume).toBe(1);

    expect(audio.setVolume(0.5)).toBe(0.5);
    expect(sound.volume).toBe(0.5);
  });

  it('scales each cue by the master volume', () => {
    audio.setVolume(0.5);
    audio.play('catch');

    expect(sound.played[0]?.volume).toBeCloseTo(0.5);
  });

  it('keeps working when persistence is unavailable', () => {
    const blocked = new AudioService(new StorageService(null));

    blocked.attach(sound);

    expect(blocked.setMuted(true)).toBe(true);
    expect(blocked.isMuted()).toBe(true);
  });
});
