import {
  validateInputLog,
  type InputLog,
  type InputLogFrame,
} from "@trickshot/shared";
import {
  createRunFSM,
  reduceRunFSM,
  restoreRunFSM,
  snapshotRunFSM,
  type RunFSMSnapshot,
  type RunEvent,
} from "./run-fsm.js";
import {
  createScoreState,
  reduceScoreEvent,
  type ScoreState,
} from "./scoring.js";
import { shotRng, type Side } from "./shot-layout.js";

export interface ReplayRunResult {
  score: number;
  stars: number;
  chainLength: number;
  continuesUsed: number;
  fsmSnapshot: RunFSMSnapshot;
  side: Side;
  frameCount: number;
}

const DEFAULT_MIN_SPEED = 160;

/**
 * Seeded RNG contract (hybrid replay):
 * - Layout + obstacles: `shotRng(seed, score, side, mode)` — no rolls stored in log.
 * - Star spawn: `shotRng(...).next()` passed to `reduceScoreEvent({ type: "prepareShot" })`.
 * Same seed + score progression + side → identical layouts and star flags in Node replay.
 */
export function replayRunFromInputLog(
  raw: unknown,
  options?: { minSpeed?: number; expectedPhysicsBuildId?: string },
): ReplayRunResult {
  const validation = validateInputLog(raw);
  if (!validation.ok) {
    const msg = validation.errors.map((e) => e.message).join("; ");
    throw new Error(`invalid input log: ${msg}`);
  }

  const log = validation.log;
  if (
    options?.expectedPhysicsBuildId !== undefined &&
    log.physicsBuildId !== options.expectedPhysicsBuildId
  ) {
    throw new Error(
      `physics build mismatch: log=${log.physicsBuildId} expected=${options.expectedPhysicsBuildId}`,
    );
  }

  return replayValidatedLog(log, options?.minSpeed ?? DEFAULT_MIN_SPEED);
}

function replayValidatedLog(log: InputLog, minSpeed: number): ReplayRunResult {
  let ctx = createRunFSM(log.mode);
  let scoreState = createScoreState();
  let side: Side = 1;

  const boot = reduceRunFSM(ctx, { type: "bootComplete" });
  if (!boot.accepted) throw new Error("replay: bootComplete rejected");
  ctx = boot.state;

  for (const frame of log.frames) {
    const outcome = applyReplayFrame(ctx, scoreState, side, frame, log, minSpeed);
    ctx = outcome.ctx;
    scoreState = outcome.scoreState;
    side = outcome.side;
  }

  return {
    score: scoreState.score,
    stars: scoreState.stars,
    chainLength: scoreState.chainLength,
    continuesUsed: ctx.continuesUsed,
    fsmSnapshot: snapshotRunFSM(ctx),
    side,
    frameCount: log.frames.length,
  };
}

function applyReplayFrame(
  ctx: ReturnType<typeof createRunFSM>,
  scoreState: ScoreState,
  side: Side,
  frame: InputLogFrame,
  log: InputLog,
  minSpeed: number,
): { ctx: typeof ctx; scoreState: ScoreState; side: Side } {
  switch (frame.type) {
    case "pointer_down":
    case "pointer_move":
    case "pointer_up":
    case "tick":
    case "powerup":
      return { ctx, scoreState, side };

    case "release": {
      const event: RunEvent = {
        type: "release",
        vx: frame.vx ?? 0,
        vy: frame.vy ?? 0,
        originX: frame.originX ?? 0,
        originY: frame.originY ?? 0,
        minSpeed,
      };
      const result = reduceRunFSM(ctx, event, frame.t);
      if (!result.accepted) return { ctx, scoreState, side };
      return { ctx: result.state, scoreState, side };
    }

    case "through_hoop": {
      const hoop = reduceRunFSM(ctx, { type: "throughHoop" }, frame.t);
      if (!hoop.accepted) return { ctx, scoreState, side };
      const nextScore = reduceScoreEvent(scoreState, { type: "dunk" });
      return { ctx: hoop.state, scoreState: nextScore, side };
    }

    case "out_of_bounds": {
      const miss = reduceRunFSM(ctx, { type: "outOfBounds" }, frame.t);
      if (!miss.accepted) return { ctx, scoreState, side };
      const nextScore = reduceScoreEvent(scoreState, { type: "miss" });
      return { ctx: miss.state, scoreState: nextScore, side };
    }

    case "continue_accept": {
      const cont = reduceRunFSM(ctx, { type: "acceptContinue" }, frame.t);
      if (!cont.accepted) return { ctx, scoreState, side };
      const nextScore = reduceScoreEvent(scoreState, { type: "acceptContinue" });
      return { ctx: cont.state, scoreState: nextScore, side };
    }

    case "continue_decline": {
      const end = reduceRunFSM(ctx, { type: "declineContinue" }, frame.t);
      if (!end.accepted) return { ctx, scoreState, side };
      const nextScore = reduceScoreEvent(scoreState, { type: "declineContinue" });
      return { ctx: end.state, scoreState: nextScore, side };
    }

    default: {
      const _exhaustive: never = frame.type;
      return _exhaustive;
    }
  }
}

/** Prepare shot star state from seeded RNG (mirrors PlayScene `applyShotStar`). */
export function prepareShotFromSeed(
  scoreState: ScoreState,
  seed: string,
  fromScore: number,
  side: Side,
  mode: InputLog["mode"],
): ScoreState {
  const rng = shotRng(seed, fromScore, side, mode);
  return reduceScoreEvent(scoreState, {
    type: "prepareShot",
    fromScore,
    rngUnit: rng.next(),
  });
}

export function restoreRunFromReplaySnapshot(snap: RunFSMSnapshot) {
  return restoreRunFSM(snap);
}
