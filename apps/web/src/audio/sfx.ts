import {
  getAudioContext,
  isMuted,
  pitchJitter,
  resumeAudio,
} from "./audioContext.js";

export type SfxId =
  | "aim"
  | "shoot"
  | "flight"
  | "rim"
  | "swish"
  | "miss"
  | "fail"
  | "combo"
  | "pause";

type Tone = { freq: number; dur: number; type?: OscillatorType; gain?: number };

const TONES: Record<Exclude<SfxId, "combo" | "flight">, Tone> = {
  aim: { freq: 420, dur: 0.06, type: "sine", gain: 0.04 },
  shoot: { freq: 180, dur: 0.12, type: "triangle", gain: 0.1 },
  rim: { freq: 220, dur: 0.09, type: "square", gain: 0.06 },
  swish: { freq: 520, dur: 0.18, type: "sine", gain: 0.09 },
  miss: { freq: 110, dur: 0.22, type: "sawtooth", gain: 0.07 },
  fail: { freq: 90, dur: 0.08, type: "triangle", gain: 0.05 },
  pause: { freq: 260, dur: 0.07, type: "sine", gain: 0.05 },
};

let flightOsc: OscillatorNode | null = null;
let flightGain: GainNode | null = null;
let aimingLastMs = 0;

function beep(tone: Tone, rate = 1): void {
  if (isMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = tone.type ?? "sine";
  osc.frequency.value = tone.freq * rate;
  const g = tone.gain ?? 0.08;
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(g, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + tone.dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + tone.dur + 0.02);
}

/** Rising sparkle for combo / chain milestones. */
function playCombo(chainLength: number): void {
  if (isMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const base = chainLength >= 4 ? [523.25, 659.25, 783.99, 1046.5] : [392.0, 493.88, 587.33];
  const gainScale = chainLength >= 4 ? 0.1 : 0.075;
  base.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = "sine";
    osc.frequency.value = freq * pitchJitter(1, 0.02);
    filter.type = "lowpass";
    filter.frequency.value = 3200;
    const t = now + i * 0.055;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gainScale, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  });
}

export const Sfx = {
  async unlock(): Promise<void> {
    await resumeAudio();
  },

  play(id: SfxId): void {
    if (id === "flight") {
      this.startFlight();
      return;
    }
    if (id === "combo") {
      playCombo(2);
      return;
    }
    beep(TONES[id], pitchJitter());
  },

  /** Chain-length-aware combo sting (x2 / x3 / ON FIRE). */
  combo(chainLength: number): void {
    if (chainLength < 2) return;
    playCombo(chainLength);
  },

  /** Throttled aim cue while dragging. */
  aimTick(): void {
    const now = performance.now();
    if (now - aimingLastMs < 120) return;
    aimingLastMs = now;
    beep(TONES.aim, pitchJitter(1, 0.03));
  },

  startFlight(): void {
    if (isMuted()) return;
    const ctx = getAudioContext();
    if (!ctx || flightOsc) return;
    flightOsc = ctx.createOscillator();
    flightGain = ctx.createGain();
    flightOsc.type = "sine";
    flightOsc.frequency.value = 150 * pitchJitter(1, 0.04);
    flightGain.gain.value = 0.025;
    flightOsc.connect(flightGain);
    flightGain.connect(ctx.destination);
    flightOsc.start();
  },

  stopFlight(): void {
    try {
      flightOsc?.stop();
    } catch {
      /* already stopped */
    }
    flightOsc?.disconnect();
    flightGain?.disconnect();
    flightOsc = null;
    flightGain = null;
  },
};
