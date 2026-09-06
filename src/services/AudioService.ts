import { getStorageService, type StorageService } from './StorageService';

/**
 * Sound effect cues. The values are also the loader keys and the file stems in
 * `public/assets/audio/`.
 */
export const SOUND_CUES = [
  'catch',
  'catch-golden',
  'miss',
  'combo',
  'tick',
  'tick-final',
  'round-over',
] as const;

export type SoundCue = (typeof SOUND_CUES)[number];

/**
 * The slice of Phaser's sound manager this service needs.
 *
 * Narrowing it to an interface is what lets the service be tested under Node:
 * `Phaser.Sound.BaseSoundManager` satisfies it structurally, and tests pass a
 * plain recording double.
 */
export interface SoundLike {
  /** True until the browser's autoplay policy has been satisfied. */
  readonly locked: boolean;
  mute: boolean;
  volume: number;
  play(key: string, config?: { volume?: number }): boolean;
}

/** Per-cue volume trim, so one cue can sit under another without re-rendering it. */
const CUE_GAIN: Readonly<Record<SoundCue, number>> = {
  catch: 1,
  'catch-golden': 1,
  miss: 0.9,
  combo: 0.85,
  tick: 0.7,
  'tick-final': 0.85,
  'round-over': 1,
};

/**
 * All sound playback for the game.
 *
 * Two rules shape it. Gameplay never waits on audio: every entry point is
 * best-effort and swallows failure, because a blocked or broken audio context is
 * an expected browser condition rather than an error the player can act on. And
 * a cue requested while the context is still locked is *dropped*, not queued —
 * otherwise the first user gesture would release a burst of stale sounds.
 */
export class AudioService {
  private sound: SoundLike | null = null;

  private muted: boolean;

  private masterVolume: number;

  /** Cues whose file failed to load; playing them would only log warnings. */
  private readonly unavailable = new Set<SoundCue>();

  public constructor(private readonly storage: StorageService = getStorageService()) {
    const settings = this.storage.getSettings();

    this.muted = settings.muted;
    this.masterVolume = settings.volume;
  }

  /**
   * Hand the service the running sound manager. Safe to call on every scene
   * start; the persisted mute and volume are re-applied each time.
   */
  public attach(sound: SoundLike | null): void {
    this.sound = sound;
    this.applyToManager();
  }

  /** Called by the loader when a cue's file could not be fetched or decoded. */
  public markUnavailable(cue: SoundCue): void {
    this.unavailable.add(cue);
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public getVolume(): number {
    return this.masterVolume;
  }

  /** True once the browser has allowed audio to start. */
  public isReady(): boolean {
    return this.sound !== null && !this.sound.locked;
  }

  /** Returns the new muted state, persisting it if storage is available. */
  public toggleMute(): boolean {
    return this.setMuted(!this.muted);
  }

  public setMuted(muted: boolean): boolean {
    this.muted = muted;
    this.applyToManager();
    this.storage.updateSettings({ muted });

    return this.muted;
  }

  public setVolume(volume: number): number {
    const settings = this.storage.updateSettings({ volume });

    this.masterVolume = settings.volume;
    this.applyToManager();

    return this.masterVolume;
  }

  /**
   * Play one cue. Silent and non-throwing when muted, unattached, still locked,
   * or if the underlying manager rejects the call.
   */
  public play(cue: SoundCue): void {
    const sound = this.sound;

    if (sound === null || this.muted || sound.locked || this.unavailable.has(cue)) {
      return;
    }

    try {
      sound.play(cue, { volume: this.masterVolume * CUE_GAIN[cue] });
    } catch {
      // A failed cue must never interrupt a round.
    }
  }

  private applyToManager(): void {
    if (this.sound === null) {
      return;
    }

    try {
      this.sound.mute = this.muted;
      this.sound.volume = this.masterVolume;
    } catch {
      // Some managers reject writes before the context exists.
    }
  }
}

let sharedAudio: AudioService | null = null;

/**
 * One instance per session. Scenes come and go; mute state and the attached
 * manager must not, or toggling mute would not survive a replay.
 */
export function getAudioService(): AudioService {
  sharedAudio ??= new AudioService();

  return sharedAudio;
}
