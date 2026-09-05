import { beforeEach, describe, expect, it } from 'vitest';

import { BALANCE } from '../config/balance';
import {
  clampVolume,
  defaultSaveData,
  sanitizeSaveData,
  getStorageService,
  StorageService,
  STORAGE_KEY,
  type StorageLike,
} from './StorageService';

/** An in-memory stand-in for Web Storage. No jsdom required. */
class MemoryStorage implements StorageLike {
  public readonly items = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

/** Storage that throws on read, like a blocked-cookies context. */
const throwingReadStorage: StorageLike = {
  getItem(): string | null {
    throw new Error('SecurityError: access denied');
  },
  setItem(): void {
    /* writes succeed */
  },
};

/** Storage that throws on write, like an exceeded quota or private mode. */
const throwingWriteStorage: StorageLike = {
  getItem(): string | null {
    return null;
  },
  setItem(): void {
    throw new Error('QuotaExceededError');
  },
};

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
});

describe('clampVolume', () => {
  it('passes through values already inside the range', () => {
    expect(clampVolume(0)).toBe(0);
    expect(clampVolume(0.5)).toBe(0.5);
    expect(clampVolume(1)).toBe(1);
  });

  it('clamps values outside 0..1', () => {
    expect(clampVolume(-2)).toBe(0);
    expect(clampVolume(17)).toBe(1);
  });

  it('falls back for values that are not usable numbers', () => {
    expect(clampVolume(Number.NaN)).toBe(BALANCE.audio.defaultVolume);
    expect(clampVolume('loud')).toBe(BALANCE.audio.defaultVolume);
    expect(clampVolume(null)).toBe(BALANCE.audio.defaultVolume);
    expect(clampVolume(undefined)).toBe(BALANCE.audio.defaultVolume);
    expect(clampVolume(Number.POSITIVE_INFINITY)).toBe(BALANCE.audio.defaultVolume);
  });
});

describe('sanitizeSaveData', () => {
  it('accepts a well-formed payload', () => {
    const data = sanitizeSaveData({
      schemaVersion: 1,
      highScore: 420,
      settings: { muted: true, volume: 0.25 },
    });

    expect(data).toEqual({
      schemaVersion: 1,
      highScore: 420,
      settings: { muted: true, volume: 0.25 },
    });
  });

  it('resets entirely when the schema version is not recognised', () => {
    expect(sanitizeSaveData({ schemaVersion: 2, highScore: 999 })).toEqual(defaultSaveData());
    expect(sanitizeSaveData({ highScore: 999 })).toEqual(defaultSaveData());
  });

  it('rejects values that are not objects', () => {
    expect(sanitizeSaveData(null)).toEqual(defaultSaveData());
    expect(sanitizeSaveData('nope')).toEqual(defaultSaveData());
    expect(sanitizeSaveData(42)).toEqual(defaultSaveData());
    expect(sanitizeSaveData([])).toEqual(defaultSaveData());
  });

  it('repairs only the corrupted field and keeps valid neighbours', () => {
    const data = sanitizeSaveData({
      schemaVersion: 1,
      highScore: 'lots',
      settings: { muted: true, volume: 0.3 },
    });

    expect(data.highScore).toBe(0);
    expect(data.settings).toEqual({ muted: true, volume: 0.3 });
  });

  it('repairs a corrupted setting without discarding the high score', () => {
    const data = sanitizeSaveData({
      schemaVersion: 1,
      highScore: 77,
      settings: { muted: 'yes', volume: 99 },
    });

    expect(data.highScore).toBe(77);
    expect(data.settings.muted).toBe(BALANCE.audio.defaultMuted);
    expect(data.settings.volume).toBe(1);
  });

  it('normalises an out-of-range or fractional high score', () => {
    expect(sanitizeSaveData({ schemaVersion: 1, highScore: -5 }).highScore).toBe(0);
    expect(sanitizeSaveData({ schemaVersion: 1, highScore: 12.9 }).highScore).toBe(12);
    expect(sanitizeSaveData({ schemaVersion: 1, highScore: Number.NaN }).highScore).toBe(0);
  });

  it('supplies default settings when the settings object is missing', () => {
    const data = sanitizeSaveData({ schemaVersion: 1, highScore: 10 });

    expect(data.settings).toEqual({
      muted: BALANCE.audio.defaultMuted,
      volume: BALANCE.audio.defaultVolume,
    });
  });
});

describe('StorageService with working storage', () => {
  it('starts from defaults when nothing is stored', () => {
    const service = new StorageService(storage);

    expect(service.isAvailable()).toBe(true);
    expect(service.getHighScore()).toBe(0);
    expect(service.getSettings()).toEqual({
      muted: BALANCE.audio.defaultMuted,
      volume: BALANCE.audio.defaultVolume,
    });
  });

  it('round-trips a high score through the namespaced key', () => {
    const first = new StorageService(storage);
    first.submitScore(1234);

    expect(storage.items.has(STORAGE_KEY)).toBe(true);
    expect(new StorageService(storage).getHighScore()).toBe(1234);
  });

  it('round-trips settings', () => {
    const first = new StorageService(storage);
    first.updateSettings({ muted: true, volume: 0.42 });

    expect(new StorageService(storage).getSettings()).toEqual({ muted: true, volume: 0.42 });
  });

  it('writes exactly one key', () => {
    const service = new StorageService(storage);
    service.submitScore(10);
    service.updateSettings({ muted: true });

    expect([...storage.items.keys()]).toEqual([STORAGE_KEY]);
  });

  it('recovers to defaults from malformed JSON', () => {
    storage.items.set(STORAGE_KEY, '{ this is not json');

    const service = new StorageService(storage);

    expect(service.getHighScore()).toBe(0);
    expect(service.getSettings().volume).toBe(BALANCE.audio.defaultVolume);
  });

  it('recovers to defaults from an unsupported schema version', () => {
    storage.items.set(STORAGE_KEY, JSON.stringify({ schemaVersion: 99, highScore: 5000 }));

    expect(new StorageService(storage).getHighScore()).toBe(0);
  });

  it('recovers from a partially corrupted object', () => {
    storage.items.set(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: 1, highScore: 88, settings: 'broken' }),
    );

    const service = new StorageService(storage);

    expect(service.getHighScore()).toBe(88);
    expect(service.getSettings().volume).toBe(BALANCE.audio.defaultVolume);
  });
});

describe('high-score semantics', () => {
  it('reports a new best and keeps it', () => {
    const service = new StorageService(storage);

    expect(service.submitScore(500)).toEqual({ highScore: 500, isNewBest: true });
    expect(service.getHighScore()).toBe(500);
  });

  it('keeps the old best when the new score is lower', () => {
    const service = new StorageService(storage);
    service.submitScore(500);

    expect(service.submitScore(200)).toEqual({ highScore: 500, isNewBest: false });
    expect(service.getHighScore()).toBe(500);
  });

  it('does not treat an equal score as a new best', () => {
    const service = new StorageService(storage);
    service.submitScore(500);

    expect(service.submitScore(500)).toEqual({ highScore: 500, isNewBest: false });
  });

  it('ignores a negative or malformed score', () => {
    const service = new StorageService(storage);
    service.submitScore(300);

    expect(service.submitScore(-100)).toEqual({ highScore: 300, isNewBest: false });
    expect(service.submitScore(Number.NaN)).toEqual({ highScore: 300, isNewBest: false });
    expect(service.getHighScore()).toBe(300);
  });

  it('stores whole points only', () => {
    const service = new StorageService(storage);

    expect(service.submitScore(99.9)).toEqual({ highScore: 99, isNewBest: true });
  });
});

describe('settings semantics', () => {
  it('keeps mute and volume independent', () => {
    const service = new StorageService(storage);
    const settings = service.updateSettings({ volume: 0.7, muted: true });

    expect(settings).toEqual({ volume: 0.7, muted: true });
  });

  it('updates one field without disturbing the other', () => {
    const service = new StorageService(storage);
    service.updateSettings({ volume: 0.3, muted: true });

    expect(service.updateSettings({ muted: false })).toEqual({ volume: 0.3, muted: false });
  });

  it('clamps an out-of-range volume on the way in', () => {
    const service = new StorageService(storage);

    expect(service.updateSettings({ volume: 5 }).volume).toBe(1);
    expect(service.updateSettings({ volume: -5 }).volume).toBe(0);
  });

  it('keeps the current volume when handed an unusable value', () => {
    const service = new StorageService(storage);
    service.updateSettings({ volume: 0.6 });

    expect(service.updateSettings({ volume: Number.NaN }).volume).toBe(0.6);
  });
});

describe('StorageService resilience', () => {
  it('works with no storage at all', () => {
    const service = new StorageService(null);

    expect(service.isAvailable()).toBe(false);
    expect(service.getHighScore()).toBe(0);
    expect(service.submitScore(750)).toEqual({ highScore: 750, isNewBest: true });
    // The session stays consistent even though nothing was persisted.
    expect(service.getHighScore()).toBe(750);
  });

  it('falls back to defaults when reading throws', () => {
    const service = new StorageService(throwingReadStorage);

    expect(service.getHighScore()).toBe(0);
    expect(service.getSettings().volume).toBe(BALANCE.audio.defaultVolume);
  });

  it('reports a failed write without throwing', () => {
    const service = new StorageService(throwingWriteStorage);

    expect(service.save(defaultSaveData())).toBe(false);
  });

  it('keeps the game playable when writes keep failing', () => {
    const service = new StorageService(throwingWriteStorage);

    expect(() => service.submitScore(900)).not.toThrow();
    expect(service.getHighScore()).toBe(900);
    expect(service.updateSettings({ muted: true }).muted).toBe(true);
  });

  it('reports a successful write', () => {
    expect(new StorageService(storage).save(defaultSaveData())).toBe(true);
  });
});

describe('shared service instance', () => {
  it('hands every scene the same instance, so the in-memory fallback survives', () => {
    expect(getStorageService()).toBe(getStorageService());
  });

  it('works with no browser storage present, which is the Node test environment', () => {
    const service = getStorageService();

    expect(service.isAvailable()).toBe(false);
    expect(service.submitScore(120)).toEqual({ highScore: 120, isNewBest: true });
    expect(service.submitScore(90)).toEqual({ highScore: 120, isNewBest: false });
  });
});
