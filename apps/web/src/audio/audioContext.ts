const MUTE_KEY = "trickshot.audio.muted";

let sharedCtx: AudioContext | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return globalThis.localStorage?.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    globalThis.localStorage?.setItem(MUTE_KEY, next ? "1" : "0");
  } catch {
    /* private mode */
  }
}

export function toggleMuted(): boolean {
  setMuted(!muted);
  return muted;
}

/** Lazily create / resume AudioContext (call from first pointerdown). */
export async function resumeAudio(): Promise<AudioContext | null> {
  if (typeof AudioContext === "undefined") return null;
  if (!sharedCtx) sharedCtx = new AudioContext();
  if (sharedCtx.state === "suspended") {
    try {
      await sharedCtx.resume();
    } catch {
      /* autoplay policy */
    }
  }
  return sharedCtx;
}

export function getAudioContext(): AudioContext | null {
  return sharedCtx;
}

/** Pitch jitter ~±5% like DunkShot3D. */
export function pitchJitter(base = 1, span = 0.05): number {
  return base * (1 + (Math.random() * 2 - 1) * span);
}
