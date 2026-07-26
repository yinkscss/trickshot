import {
  INPUT_LOG_MAX_BYTES,
  INPUT_LOG_MAX_FRAMES,
  INPUT_LOG_VERSION,
  serializeInputLog,
  type GameMode,
  type InputLog,
  type InputLogFrame,
} from "@trickshot/shared";

export interface InputLogRecorderOptions {
  seed: string;
  mode: GameMode;
  physicsBuildId: string;
  /** Run-clock anchor (ms) — first frame `t` is relative to this. */
  startedAtMs?: number;
}

export interface RecordFrameResult {
  accepted: boolean;
  truncated: boolean;
}

/**
 * Append-only client recorder for hybrid replay (`anticheat=hybrid`).
 * Does not store client-declared score — only inputs and authoritative events.
 */
export class InputLogRecorder {
  private readonly frames: InputLogFrame[] = [];
  private readonly startedAtMs: number;
  private truncated = false;

  constructor(private readonly options: InputLogRecorderOptions) {
    this.startedAtMs = options.startedAtMs ?? 0;
  }

  get frameCount(): number {
    return this.frames.length;
  }

  get isTruncated(): boolean {
    return this.truncated;
  }

  /** Relative run time in ms. */
  elapsedMs(nowMs: number): number {
    return Math.max(0, nowMs - this.startedAtMs);
  }

  record(frame: Omit<InputLogFrame, "t"> & { t?: number }, nowMs?: number): RecordFrameResult {
    if (this.truncated) {
      return { accepted: false, truncated: true };
    }

    const entry: InputLogFrame = {
      ...frame,
      t: frame.t ?? (nowMs !== undefined ? this.elapsedMs(nowMs) : this.frames.at(-1)?.t ?? 0),
    };

    if (this.frames.length >= INPUT_LOG_MAX_FRAMES) {
      this.truncated = true;
      return { accepted: false, truncated: true };
    }

    this.frames.push(entry);

    const draft = this.finalize();
    if (serializeInputLog(draft).length > INPUT_LOG_MAX_BYTES) {
      this.frames.pop();
      this.truncated = true;
      return { accepted: false, truncated: true };
    }

    return { accepted: true, truncated: false };
  }

  finalize(): InputLog {
    const log: InputLog = {
      version: INPUT_LOG_VERSION,
      seed: this.options.seed,
      mode: this.options.mode,
      physicsBuildId: this.options.physicsBuildId,
      frames: [...this.frames],
    };
    if (this.truncated) {
      log.truncated = true;
    }
    return log;
  }

  serialize(): string {
    return serializeInputLog(this.finalize());
  }
}

export function createInputLogRecorder(
  options: InputLogRecorderOptions,
): InputLogRecorder {
  return new InputLogRecorder(options);
}
