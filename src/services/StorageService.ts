import { BALANCE } from '../config/balance';

/**
 * Persistent player data.
 *
 * Unlike `src/systems/*`, this service is allowed to touch browser storage — but
 * it reaches it through a tiny injectable interface, so the whole thing is
 * testable in the Node test environment with no jsdom and no browser.
 *
 * Two rules drive the design:
 *
 * 1. **Persistence must never break gameplay.** Every access is guarded; any
 *    failure degrades to in-memory defaults and the game continues.
 * 2. **Never trust what comes back.** Stored JSON is validated field by field,
 *    and anything invalid falls back to its default while valid neighbours are
 *    kept.
 */

/** The subset of the Web Storage API this service needs. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Single namespaced, versioned key.
 *
 * The namespace is not cosmetic: every GitHub Pages project site shares the
 * `<user>.github.io` origin, so an unprefixed key like `highScore` would collide
 * with the owner's other projects hosted from the same account.
 */
export const STORAGE_KEY = 'ctt:save:v1';

export const SCHEMA_VERSION = 1;

export interface PlayerSettings {
  readonly muted: boolean;
  /** Master volume, always within 0..1. Independent of `muted`. */
  readonly volume: number;
}

export interface SaveData {
  readonly schemaVersion: number;
  readonly highScore: number;
  readonly settings: PlayerSettings;
}

export interface HighScoreUpdate {
  readonly highScore: number;
  readonly isNewBest: boolean;
}

export function defaultSettings(): PlayerSettings {
  return {
    muted: BALANCE.audio.defaultMuted,
    volume: BALANCE.audio.defaultVolume,
  };
}

export function defaultSaveData(): SaveData {
  return {
    schemaVersion: SCHEMA_VERSION,
    highScore: 0,
    settings: defaultSettings(),
  };
}

/** Clamp a volume into 0..1, falling back to the default if it is not a number. */
export function clampVolume(value: unknown, fallback = BALANCE.audio.defaultVolume): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(value, 0), 1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeHighScore(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
}

function sanitizeSettings(value: unknown): PlayerSettings {
  const fallback = defaultSettings();

  if (!isRecord(value)) {
    return fallback;
  }

  return {
    muted: typeof value.muted === 'boolean' ? value.muted : fallback.muted,
    volume: clampVolume(value.volume, fallback.volume),
  };
}

/**
 * Turn arbitrary parsed JSON into valid `SaveData`.
 *
 * Field-by-field recovery is deliberate: a partially corrupted object should
 * cost the player only the corrupted field, not their whole high score. A
 * mismatched schema version is the exception — it cannot be interpreted, so it
 * resets to defaults.
 */
export function sanitizeSaveData(parsed: unknown): SaveData {
  if (!isRecord(parsed) || parsed.schemaVersion !== SCHEMA_VERSION) {
    return defaultSaveData();
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    highScore: sanitizeHighScore(parsed.highScore),
    settings: sanitizeSettings(parsed.settings),
  };
}

/**
 * Obtain `localStorage` without ever throwing.
 *
 * Merely *accessing* `window.localStorage` throws in some blocked-storage
 * configurations, so even the lookup is guarded. Returns `null` outside a
 * browser, which is the normal case under Vitest's Node environment.
 */
export function detectBrowserStorage(): StorageLike | null {
  try {
    if (typeof globalThis.localStorage === 'undefined') {
      return null;
    }

    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export class StorageService {
  private readonly storage: StorageLike | null;

  /** Mirrors the last known good state so the game works with storage broken. */
  private cache: SaveData;

  public constructor(storage: StorageLike | null = detectBrowserStorage()) {
    this.storage = storage;
    this.cache = this.load();
  }

  /**
   * Whether persistence is actually working. Callers can surface this in the
   * UI; the service itself stays silent rather than logging on every blocked
   * read, which is an expected condition, not an error worth console noise.
   */
  public isAvailable(): boolean {
    return this.storage !== null;
  }

  /** Read and validate. Always returns usable data, never throws. */
  public load(): SaveData {
    if (this.storage === null) {
      return defaultSaveData();
    }

    let raw: string | null;

    try {
      raw = this.storage.getItem(STORAGE_KEY);
    } catch {
      return defaultSaveData();
    }

    if (raw === null) {
      return defaultSaveData();
    }

    try {
      return sanitizeSaveData(JSON.parse(raw));
    } catch {
      // Malformed JSON: treat it as absent rather than propagating a parse error.
      return defaultSaveData();
    }
  }

  /** Persist. Returns whether the write actually reached storage. */
  public save(data: SaveData): boolean {
    this.cache = data;

    if (this.storage === null) {
      return false;
    }

    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(data));

      return true;
    } catch {
      // Quota exceeded, private mode, storage disabled. The cache keeps the
      // session consistent; the value simply will not survive a reload.
      return false;
    }
  }

  public getHighScore(): number {
    return this.cache.highScore;
  }

  /**
   * Offer a round's score as a new best.
   *
   * Keeps the existing high score when the new one is lower or equal, and
   * reports whether a new best was set so the game-over screen can celebrate it
   * without re-deriving the comparison.
   */
  public submitScore(score: number): HighScoreUpdate {
    const candidate = sanitizeHighScore(score);
    const current = this.cache.highScore;

    if (candidate <= current) {
      return { highScore: current, isNewBest: false };
    }

    this.save({ ...this.cache, highScore: candidate });

    return { highScore: candidate, isNewBest: true };
  }

  public getSettings(): PlayerSettings {
    return this.cache.settings;
  }

  /** Update some or all settings, validating whatever is supplied. */
  public updateSettings(patch: Partial<PlayerSettings>): PlayerSettings {
    const current = this.cache.settings;
    const settings: PlayerSettings = {
      muted: typeof patch.muted === 'boolean' ? patch.muted : current.muted,
      volume:
        patch.volume === undefined ? current.volume : clampVolume(patch.volume, current.volume),
    };

    this.save({ ...this.cache, settings });

    return settings;
  }
}

/**
 * The one `StorageService` the running game shares.
 *
 * A single instance matters even though the underlying storage is global: when
 * persistence is unavailable (private mode, blocked storage), the service falls
 * back to an in-memory cache, and a fresh instance per scene would throw that
 * cache away — the player's best score would reset between every round instead
 * of lasting the session, which is the documented fallback behaviour.
 */
let sharedService: StorageService | null = null;

export function getStorageService(): StorageService {
  sharedService ??= new StorageService();

  return sharedService;
}
