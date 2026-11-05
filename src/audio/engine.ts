import type { Rarity, Volume } from '@/core/types';

/**
 * Music and sound effects (spec §8 «Звук») on the Web Audio API.
 *
 * - One music track per place; changing place crossfades the tracks.
 * - The night version of a track is the same recording through a low-pass
 *   filter and a soft reverb; `setNight(0..1)` blends dry → night smoothly.
 * - Volumes: master × music, master × sfx (settings sliders, 0–100).
 *
 * Browsers start audio only after a user gesture, so the context is resumed on
 * the first pointer or key press. Every failure is silent: no sound, no crash.
 */

const BASE = `${import.meta.env.BASE_URL}assets/audio/`;
const FADE = 1.6; // seconds, place-to-place crossfade
const STEPS = 5;

export type Sfx =
  | 'step'
  | 'till'
  | 'water'
  | 'plant'
  | 'harvest'
  | 'chop'
  | 'mine'
  | 'swing'
  | 'shoot'
  | 'spell'
  | 'enemy-hit'
  | 'enemy-defeat'
  | 'hurt'
  | 'coins'
  | 'door'
  | 'book'
  | 'mail'
  | `reward-${Rarity}`;

/** Per-effect loudness on top of the sfx volume (footsteps sit under everything). */
const SFX_GAIN: Partial<Record<Sfx, number>> = { step: 0.25, water: 0.6, swing: 0.6, hurt: 0.8, door: 0.5, book: 0.7 };

interface Track {
  id: string;
  el: HTMLAudioElement;
  gain: GainNode;
}

/** Perceived loudness: slider 0–100 → gain (squared, so 50% is clearly quieter). */
const toGain = (v: number) => Math.max(0, Math.min(1, v / 100)) ** 2;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  /** Shared by all tracks: the day path and the night (filtered + reverb) path. */
  private dry!: GainNode;
  private wet!: GainNode;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private track: Track | null = null;
  private wanted: string | null = null;
  private night = 0;
  private volume: Volume = { master: 80, music: 70, sfx: 80 };
  private lastStep = 0;

  /** Listen for the first gesture: only then may audio start. */
  constructor() {
    if (typeof window === 'undefined') return;
    const unlock = () => {
      const ctx = this.context();
      if (!ctx) return;
      const start = () => {
        if (this.wanted && !this.track) this.playMusic(this.wanted);
      };
      if (ctx.state === 'suspended') void ctx.resume().then(start);
      else start();
    };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    // A hidden tab is silent; the sound comes back with the tab.
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      const ctx = new Ctor();
      this.master = ctx.createGain();
      this.master.connect(ctx.destination);
      this.musicBus = ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      // Night path: muffled and roomy, a little quieter.
      this.dry = ctx.createGain();
      this.dry.connect(this.musicBus);
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 900;
      lowpass.Q.value = 0.5;
      const reverb = ctx.createConvolver();
      reverb.buffer = impulse(ctx, 2.6);
      const reverbGain = ctx.createGain();
      reverbGain.gain.value = 0.45;
      this.wet = ctx.createGain();
      this.wet.connect(lowpass);
      lowpass.connect(this.musicBus);
      lowpass.connect(reverb);
      reverb.connect(reverbGain);
      reverbGain.connect(this.musicBus);
      this.ctx = ctx;
      this.applyVolume();
      this.applyNight(true);
      return ctx;
    } catch {
      return null;
    }
  }

  setVolume(v: Volume): void {
    this.volume = v;
    this.applyVolume();
  }

  private applyVolume(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(toGain(this.volume.master), t, 0.05);
    this.musicBus.gain.setTargetAtTime(toGain(this.volume.music), t, 0.05);
    this.sfxBus.gain.setTargetAtTime(toGain(this.volume.sfx), t, 0.05);
  }

  /** 0 = day version, 1 = night version. */
  setNight(n: number): void {
    const v = Math.max(0, Math.min(1, n));
    if (Math.abs(v - this.night) < 0.01) return;
    this.night = v;
    this.applyNight(false);
  }

  private applyNight(now: boolean): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Equal-power blend so the loudness stays even through dusk.
    const dry = Math.cos((this.night * Math.PI) / 2);
    const wet = Math.sin((this.night * Math.PI) / 2) * 0.85;
    this.dry.gain.setTargetAtTime(dry, t, now ? 0 : 0.5);
    this.wet.gain.setTargetAtTime(wet, t, now ? 0 : 0.5);
  }

  /** Play a place's track (crossfade). `null` fades the music out. */
  playMusic(id: string | null): void {
    this.wanted = id;
    if (this.track?.id === id) return;
    const ctx = this.context();
    if (!ctx || ctx.state !== 'running') return; // started by the first gesture
    const t = ctx.currentTime;
    const old = this.track;
    if (old) {
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setValueAtTime(old.gain.gain.value, t);
      old.gain.gain.linearRampToValueAtTime(0, t + FADE);
      window.setTimeout(() => {
        old.el.pause();
        old.el.removeAttribute('src');
        old.gain.disconnect();
      }, FADE * 1000 + 100);
    }
    this.track = null;
    if (!id) return;
    const el = new Audio(`${BASE}music/${id}.ogg`);
    el.loop = true;
    el.preload = 'auto';
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + FADE);
    try {
      const src = ctx.createMediaElementSource(el);
      src.connect(gain);
      gain.connect(this.dry);
      gain.connect(this.wet);
    } catch {
      return;
    }
    this.track = { id, el, gain };
    void el.play().catch(() => {
      if (this.track?.el === el) this.track = null;
    });
  }

  play(name: Sfx): void {
    const ctx = this.context();
    if (!ctx || ctx.state !== 'running') return;
    let file: string = name;
    let rate = 1;
    if (name === 'step') {
      const now = performance.now();
      if (now - this.lastStep < 120) return;
      this.lastStep = now;
      file = `step-${Math.floor(Math.random() * STEPS)}`;
      rate = 0.92 + Math.random() * 0.16;
    }
    void this.buffer(file).then((buf) => {
      if (!buf || !this.ctx) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      const g = this.ctx.createGain();
      g.gain.value = SFX_GAIN[name] ?? 1;
      src.connect(g);
      g.connect(this.sfxBus);
      src.start();
    });
  }

  /** Decode the effects ahead of time so the first use has no delay. */
  preload(names: string[]): void {
    for (const n of names) void this.buffer(n);
  }

  private buffer(name: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(name);
    if (!p) {
      const ctx = this.context();
      p = ctx
        ? fetch(`${BASE}sfx/${name}.ogg`)
            .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText))))
            .then((b) => ctx.decodeAudioData(b))
            .catch(() => null)
        : Promise.resolve(null);
      this.buffers.set(name, p);
    }
    return p;
  }
}

/** A soft stereo room: decaying noise. */
function impulse(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }
  return buf;
}
