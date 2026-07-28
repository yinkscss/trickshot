import {
  getAudioContext,
  isMuted,
  pitchJitter,
  resumeAudio,
} from "./audioContext.js";

export type SfxId = "aim" | "shoot" | "flight" | "rim" | "swish" | "miss" | "fail";

type Tone = { freq: number; dur: number; type?: OscillatorType; gain?: number };

const TONES: Record<SfxId, Tone> = {
  aim: { freq: 420, dur: 0.06, type: "sine", gain: 0.04 },
  shoot: { freq: 180, dur: 0.12, type: "triangle", gain: 0.1 },
  flight: { freq: 140, dur: 0.08, type: "sine", gain: 0.03 },
  rim: { freq: 220, dur: 0.09, type: "square", gain: 0.06 },
  swish: { freq: 520, dur: 0.18, type: "sine", gain: 0.09 },
  miss: { freq: 110, dur: 0.22, type: "sawtooth", gain: 0.07 },
  fail: { freq: 90, dur: 0.08, type: "triangle", gain: 0.05 },
};

let flightOsc: OscillatorNode | null = null;
let flightGain: GainNode | null = null;
let aimingLastMs = 0;

function beep(id: SfxId, rate = 1): void {
  if (isMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const tone = TONES[id];
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

export const Sfx = {
  async unlock(): Promise<void> {
    await resumeAudio();
  },

  play(id: SfxId): void {
    if (id === "flight") {
      this.startFlight();
      return;
    }
    beep(id, pitchJitter());
  },

  /** Throttled aim cue while dragging. */
  aimTick(): void {
    const now = performance.now();
    if (now - aimingLastMs < 120) return;
    aimingLastMs = now;
    beep("aim", pitchJitter(1, 0.03));
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
