import {
  getAudioContext,
  isMuted,
  resumeAudio,
} from "./audioContext.js";

/**
 * Adaptive music bed: soft menu bed, intensity layer for tier≥3 or streak≥3.
 * Tries `/music/bed.mp3` + `/music/intensity.mp3`; falls back to procedural drones.
 */
class MusicController {
  private bedGain: GainNode | null = null;
  private intensityGain: GainNode | null = null;
  private started = false;
  private ducked = false;
  private intensityOn = false;
  private menuMode = true;
  private bedSources: AudioNode[] = [];
  private intensitySources: AudioNode[] = [];

  async start(): Promise<void> {
    const ctx = await resumeAudio();
    if (!ctx || this.started) return;
    this.started = true;

    this.bedGain = ctx.createGain();
    this.intensityGain = ctx.createGain();
    this.bedGain.gain.value = 0;
    this.intensityGain.gain.value = 0;
    this.bedGain.connect(ctx.destination);
    this.intensityGain.connect(ctx.destination);

    const bedBuf = await this.loadBuffer(ctx, "/music/bed.mp3");
    const intBuf = await this.loadBuffer(ctx, "/music/intensity.mp3");

    if (bedBuf) {
      this.bedSources.push(this.loopBuffer(ctx, bedBuf, this.bedGain));
    } else {
      this.bedSources.push(...this.proceduralBed(ctx, this.bedGain));
    }
    if (intBuf) {
      this.intensitySources.push(
        this.loopBuffer(ctx, intBuf, this.intensityGain),
      );
    } else {
      this.intensitySources.push(
        ...this.proceduralIntensity(ctx, this.intensityGain),
      );
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
        ? 0.04
        : this.menuMode
          ? 0.06
          : 0.1;
    const intTarget =
      mute || this.menuMode || this.ducked || !this.intensityOn ? 0 : 0.08;
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

  private proceduralBed(ctx: AudioContext, dest: AudioNode): AudioNode[] {
    return [110, 164.81].map((freq) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      g.gain.value = 0.35;
      osc.connect(g);
      g.connect(dest);
      osc.start();
      return osc;
    });
  }

  private proceduralIntensity(
    ctx: AudioContext,
    dest: AudioNode,
  ): AudioNode[] {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 220;
    g.gain.value = 0.25;
    osc.connect(g);
    g.connect(dest);
    osc.start();
    return [osc];
  }
}

export const Music = new MusicController();
