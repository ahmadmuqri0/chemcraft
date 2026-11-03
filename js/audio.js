/**
 * audio.js
 * AudioManager: background music (BGM) and sound effects (SFX).
 *
 * Plug in your own files by placing them at the paths in DEFAULT_TRACKS
 * (./audio/bgm.mp3, ./audio/snap.mp3, ...) or by passing your own map to the
 * constructor. Until a file exists, each SFX falls back to a short synthesised
 * tone (Web Audio API) so the game still gives audio feedback; BGM stays silent.
 *
 * Browsers only allow sound after a user gesture, so call unlock() from the
 * first click/tap. Mute and music preferences are remembered between visits.
 */

import { load, save } from "./storage.js";

export const DEFAULT_TRACKS = Object.freeze({
  bgm: "./audio/bgm.mp3",
  sfx: {
    click: "./audio/click.mp3", // any button
    pickup: "./audio/pickup.mp3", // tile lifted
    snap: "./audio/snap.mp3", // tile snapped onto a cell
    bond: "./audio/bond.mp3", // a group becomes stable
    error: "./audio/error.mp3", // invalid drop / wrong compound
    success: "./audio/success.mp3", // level complete
    step: "./audio/step.mp3", // next step in the synthesis popup
  },
});

/** Fallback tones: [frequency Hz, duration s] notes played in sequence. */
const FALLBACK_TONES = {
  click: [[880, 0.04]],
  pickup: [
    [520, 0.05],
    [700, 0.05],
  ],
  snap: [
    [660, 0.05],
    [990, 0.07],
  ],
  bond: [
    [740, 0.08],
    [988, 0.12],
  ],
  error: [
    [220, 0.12],
    [180, 0.14],
  ],
  success: [
    [523, 0.1],
    [659, 0.1],
    [784, 0.1],
    [1047, 0.22],
  ],
  step: [[784, 0.06]],
};

export class AudioManager {
  /**
   * @param {object} [tracks] { bgm: path, sfx: { name: path } }
   */
  constructor(tracks = DEFAULT_TRACKS) {
    this.musicEnabled = load("audio.music", true);
    this.sfxEnabled = load("audio.sfx", true);
    this.musicVolume = load("audio.musicVolume", 0.45);
    this.sfxVolume = load("audio.sfxVolume", 0.8);
    this.unlocked = false;
    this.missing = new Set(); // names whose files failed to load
    this.listeners = new Set();
    this.context = null; // Web Audio context for fallback tones

    // Background music: one looping element.
    this.bgm = new Audio();
    this.bgm.loop = true;
    this.bgm.preload = "auto";
    this.bgm.volume = this.musicVolume;
    this.bgm.addEventListener("error", () => this.missing.add("bgm"));
    this.bgm.src = tracks.bgm;

    // Sound effects: one template element each, cloned on play so they can overlap.
    this.sfx = new Map();
    for (const [name, src] of Object.entries(tracks.sfx)) {
      const el = new Audio();
      el.preload = "auto";
      el.addEventListener("error", () => this.missing.add(name));
      el.src = src;
      this.sfx.set(name, el);
    }
  }

  // ------------------------------------------------------------- lifecycle

  /** Call from the first user gesture. Starts music if it is enabled. */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    if (this.musicEnabled) this.playBgm();
  }

  // ------------------------------------------------------------- music

  playBgm() {
    if (!this.unlocked || !this.musicEnabled || this.missing.has("bgm")) return;
    this.bgm.play().catch(() => this.missing.add("bgm"));
  }

  pauseBgm() {
    this.bgm.pause();
  }

  /** Turns music on/off and remembers the choice. Returns the new state. */
  toggleMusic(force) {
    this.musicEnabled = typeof force === "boolean" ? force : !this.musicEnabled;
    save("audio.music", this.musicEnabled);
    if (this.musicEnabled) this.playBgm();
    else this.pauseBgm();
    this.emit();
    return this.musicEnabled;
  }

  // ------------------------------------------------------------- effects

  /** Plays a named effect, or its fallback tone when the file is missing. */
  play(name) {
    if (!this.unlocked || !this.sfxEnabled) return;
    const template = this.sfx.get(name);
    if (!template || this.missing.has(name)) {
      this.tone(name);
      return;
    }
    const instance = template.cloneNode();
    instance.volume = this.sfxVolume;
    instance.play().catch(() => {
      this.missing.add(name);
      this.tone(name);
    });
  }

  /** Turns effects on/off and remembers the choice. Returns the new state. */
  toggleSfx(force) {
    this.sfxEnabled = typeof force === "boolean" ? force : !this.sfxEnabled;
    save("audio.sfx", this.sfxEnabled);
    this.emit();
    return this.sfxEnabled;
  }

  // ------------------------------------------------------------- global mute

  get muted() {
    return !this.musicEnabled && !this.sfxEnabled;
  }

  /** Mutes or unmutes everything at once. */
  toggleMute() {
    const unmute = this.muted;
    this.toggleMusic(unmute);
    this.toggleSfx(unmute);
    return !unmute;
  }

  /** Sets a channel volume from 0 to 1 ('music' or 'sfx'). */
  setVolume(channel, value) {
    const v = Math.min(1, Math.max(0, value));
    if (channel === "music") {
      this.musicVolume = v;
      this.bgm.volume = v;
      save("audio.musicVolume", v);
    } else {
      this.sfxVolume = v;
      save("audio.sfxVolume", v);
    }
    this.emit();
  }

  // ------------------------------------------------------------- change events

  /** Subscribe to state changes (for button labels). Returns an unsubscribe function. */
  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    this.listeners.forEach((fn) => {
      fn(this);
    });
  }

  // ------------------------------------------------------------- fallback synth

  /** Short synthesised blip used until real files are supplied. */
  tone(name) {
    const notes = FALLBACK_TONES[name];
    if (!notes) return;
    try {
      this.context ??= new (window.AudioContext || window.webkitAudioContext)();
      const ctx = this.context;
      let start = ctx.currentTime;
      for (const [freq, dur] of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = name === "error" ? "sawtooth" : "triangle";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(
          0.18 * this.sfxVolume,
          start + 0.01,
        );
        gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur + 0.02);
        start += dur * 0.9;
      }
    } catch {
      /* Web Audio unavailable: stay silent */
    }
  }
}
