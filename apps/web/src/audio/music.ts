import {
  getAudioContext,
  isMuted,
  resumeAudio,
} from "./audioContext.js";

const BPM = 102;
const BEAT = 60 / BPM;
const STEPS = 16; // one bar of 16ths

/** Bass root frequencies (Hz) — chill C-groove, one bar each. */
const BASS_ROOTS = [65.41, 65.41, 49.0, 55.0]; // C2 C2 G1 A1
const PAD_INTERVALS = [0, 4, 7, 11]; // maj7
const ARP = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63]; // C4 E4 G4 C5 …

/**
 * Adaptive music bed: soft bounce groove + intensity arp when hot.
 * Tries `/music/bed.mp3|wav` (+ intensity); falls back to procedural groove.
 */
class MusicController {
  private bedGain: GainNode | null = null;
  private intensityGain: GainNode | null = null;
  private master: GainNode | null = null;
  private started = false;
  private ducked = false;
  private intensityOn = false;
  private menuMode = true;
  private usingProcedural = false;
  private step = 0;
  private nextNoteTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private noiseBuf: AudioBuffer | null = null;

  async start(): Promise<void> {
    const ctx = await resumeAudio();
    if (!ctx || this.started) return;
    this.started = true;

    this.master = ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(ctx.destination);

    this.bedGain = ctx.createGain();
    this.intensityGain = ctx.createGain();
    this.bedGain.gain.value = 0;
    this.intensityGain.gain.value = 0;
    this.bedGain.connect(this.master);
    this.intensityGain.connect(this.master);

    const bedBuf =
      (await this.loadBuffer(ctx, "/music/bed.mp3")) ??
      (await this.loadBuffer(ctx, "/music/bed.wav"));
    const intBuf =
      (await this.loadBuffer(ctx, "/music/intensity.mp3")) ??
      (await this.loadBuffer(ctx, "/music/intensity.wav"));

    if (bedBuf) {
      this.loopBuffer(ctx, bedBuf, this.bedGain);
      if (intBuf) this.loopBuffer(ctx, intBuf, this.intensityGain);
      this.usingProcedural = false;
    } else {
      this.usingProcedural = true;
      this.noiseBuf = this.makeNoise(ctx);
      this.nextNoteTime = ctx.currentTime + 0.05;
      this.timer = setInterval(() => this.scheduler(), 25);
    }

    this.applyGains(0.4);
  }

  setMenu(menu: boolean): void {
    this.menuMode = menu;
    this.applyGains(0.35);
  }

  /** Duck during miss/continue modal. */
  setDucked(ducked: boolean): void {
    this.ducked = ducked;
    this.applyGains(0.25);
  }

  /**
   * Intensity when difficulty tier ≥ 3 or dunk streak ≥ 3.
   * Tier is dunk-count based (same thresholds as difficulty-tier module).
   */
  setIntensity(opts: { tier: number; streak: number }): void {
    this.intensityOn = opts.tier >= 3 || opts.streak >= 3;
    this.applyGains(0.35);
  }

  private applyGains(rampSec: number): void {
    const ctx = getAudioContext();
    if (!ctx || !this.bedGain || !this.intensityGain) return;
    const now = ctx.currentTime;
    const mute = isMuted();
    const bedTarget = mute
      ? 0
      : this.ducked
        ? 0.03
        : this.menuMode
          ? 0.09
          : 0.14;
    const intTarget =
      mute || this.menuMode || this.ducked || !this.intensityOn ? 0 : 0.11;
    this.bedGain.gain.cancelScheduledValues(now);
    this.intensityGain.gain.cancelScheduledValues(now);
    this.bedGain.gain.linearRampToValueAtTime(bedTarget, now + rampSec);
    this.intensityGain.gain.linearRampToValueAtTime(intTarget, now + rampSec);
  }

  /** Re-apply after mute toggle. */
  refreshMute(): void {
    this.applyGains(0.15);
  }

  private async loadBuffer(
    ctx: AudioContext,
    url: string,
  ): Promise<AudioBuffer | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const arr = await res.arrayBuffer();
      return await ctx.decodeAudioData(arr.slice(0));
    } catch {
      return null;
    }
  }

  private loopBuffer(
    ctx: AudioContext,
    buffer: AudioBuffer,
    dest: AudioNode,
  ): AudioBufferSourceNode {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(dest);
    src.start();
    return src;
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const len = ctx.sampleRate * 0.2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private scheduler(): void {
    const ctx = getAudioContext();
    if (!ctx || !this.usingProcedural || !this.bedGain || !this.intensityGain) {
      return;
    }
    const horizon = ctx.currentTime + 0.12;
    while (this.nextNoteTime < horizon) {
      this.playStep(ctx, this.step, this.nextNoteTime);
      this.nextNoteTime += BEAT / 4;
      this.step = (this.step + 1) % (STEPS * 4); // 4 bars
    }
  }

  private playStep(ctx: AudioContext, step: number, t: number): void {
    const bar = Math.floor(step / STEPS) % BASS_ROOTS.length;
    const s = step % STEPS;
    const root = BASS_ROOTS[bar]!;

    // Kick on 1 & 3
    if (s === 0 || s === 8) {
      this.kick(ctx, this.bedGain!, t, s === 0 ? 1 : 0.75);
    }
    // Soft snare / clap on 2 & 4
    if (s === 4 || s === 12) {
      this.hat(ctx, this.bedGain!, t, 0.045, 1800);
    }
    // Closed hats on offbeat 8ths
    if (s % 2 === 1) {
      this.hat(ctx, this.bedGain!, t, 0.02, 4200);
    }
    // Bass on downbeats + syncopation
    if (s === 0 || s === 3 || s === 8 || s === 11) {
      this.tone(
        ctx,
        this.bedGain!,
        t,
        root * (s === 3 || s === 11 ? 1.5 : 1),
        0.28,
        "triangle",
        0.11,
      );
    }
    // Soft pad chord every half-bar
    if (s === 0 || s === 8) {
      for (const semis of PAD_INTERVALS) {
        const f = root * 2 * Math.pow(2, semis / 12);
        this.tone(ctx, this.bedGain!, t, f, 0.55, "sine", 0.028);
      }
    }

    // Intensity: brighter arp + extra hats
    if (this.intensityOn && !this.menuMode && !this.ducked) {
      if (s % 2 === 0) {
        const note = ARP[(step / 2) % ARP.length]!;
        this.tone(ctx, this.intensityGain!, t, note, 0.14, "square", 0.035);
      }
      if (s === 6 || s === 14) {
        this.hat(ctx, this.intensityGain!, t, 0.035, 5000);
      }
    }
  }

  private tone(
    ctx: AudioContext,
    dest: AudioNode,
    t: number,
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
  ): void {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(type === "square" ? 2200 : 900, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(filter);
    filter.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private kick(
    ctx: AudioContext,
    dest: AudioNode,
    t: number,
    vel: number,
  ): void {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16 * vel, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  private hat(
    ctx: AudioContext,
    dest: AudioNode,
    t: number,
    gain: number,
    cutoff: number,
  ): void {
    if (!this.noiseBuf) return;
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    src.buffer = this.noiseBuf;
    filter.type = "highpass";
    filter.frequency.value = cutoff;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(t);
    src.stop(t + 0.08);
  }
}

export const Music = new MusicController();
