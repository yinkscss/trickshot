import {
  TOURNAMENT_ALLOWS_CONTINUES,
  type GameMode,
} from "@trickshot/shared";

/** Alpha run lifecycle states (authoritative; scene must not invent parallel modes). */
export type RunState =
  | "boot"
  | "aiming"
  | "flying"
  | "scored"
  | "transition"
  | "missed"
  | "continue"
  | "ended";

export type RunEvent =
  | { type: "bootComplete" }
  | {
      type: "release";
      /** Shot velocity components (scene computes from drag). */
      vx: number;
      vy: number;
      /** Ball origin at release. */
      originX: number;
      originY: number;
      /** Minimum speed threshold — weak releases stay in aiming. */
      minSpeed: number;
    }
  | { type: "throughHoop" }
  | { type: "outOfBounds" }
  | { type: "swishHoldComplete" }
  | { type: "finishTransition" }
  | { type: "offerContinue" }
  | { type: "acceptContinue" }
  | { type: "declineContinue" }
  | { type: "endRun" };

/** Side-effect hints for the scene / integrator — FSM does not own physics. */
export type PhysicsIntent =
  | { type: "startFlight"; x: number; y: number; vx: number; vy: number }
  | { type: "seatBallAtHoop" }
  | { type: "stopBall" }
  | { type: "beginDunkTransition" }
  | { type: "completeDunkTransition" }
  | { type: "placeRun"; score: number; advanceSide: boolean }
  | { type: "showContinuePrompt" }
  | { type: "hideContinuePrompt" }
  | { type: "runEnded" };

export interface RunFSMState {
  state: RunState;
  mode: GameMode;
  score: number;
  continuesUsed: number;
  /** Wall-clock ms when scored state began; null outside scored. */
  scoredAtMs: number | null;
}

export interface RunFSMTransition {
  from: RunState;
  event: RunEvent["type"];
  to: RunState;
  /** When set, transition only applies if predicate passes. */
  when?: (ctx: RunFSMState) => boolean;
}

export interface RunFSMResult {
  state: RunFSMState;
  intents: PhysicsIntent[];
  /** False when event is illegal or rejected (e.g. weak release). */
  accepted: boolean;
  reason?: string;
}

/** Serializable snapshot for inputLog / server replay (Alpha+). */
export interface RunFSMSnapshot {
  version: 1;
  state: RunState;
  mode: GameMode;
  score: number;
  continuesUsed: number;
  scoredAtMs: number | null;
}

const SNAPSHOT_VERSION = 1 as const;

export function createRunFSM(mode: GameMode = "casual"): RunFSMState {
  return {
    state: "boot",
    mode,
    score: 0,
    continuesUsed: 0,
    scoredAtMs: null,
  };
}

export function allowsContinue(mode: GameMode): boolean {
  if (mode === "tournament") return TOURNAMENT_ALLOWS_CONTINUES;
  return true;
}

function hypot(x: number, y: number): number {
  return Math.hypot(x, y);
}

/** Legal transitions for Alpha — single source of truth. */
export const RUN_TRANSITIONS: readonly RunFSMTransition[] = [
  { from: "boot", event: "bootComplete", to: "aiming" },
  { from: "aiming", event: "release", to: "flying" },
  { from: "flying", event: "throughHoop", to: "scored" },
  { from: "flying", event: "outOfBounds", to: "missed" },
  { from: "scored", event: "swishHoldComplete", to: "transition" },
  { from: "transition", event: "finishTransition", to: "aiming" },
  {
    from: "missed",
    event: "offerContinue",
    to: "continue",
    when: (ctx) => allowsContinue(ctx.mode),
  },
  { from: "missed", event: "endRun", to: "ended" },
  { from: "continue", event: "acceptContinue", to: "aiming" },
  { from: "continue", event: "declineContinue", to: "ended" },
] as const;

function findTransition(
  from: RunState,
  event: RunEvent,
  ctx: RunFSMState,
): RunFSMTransition | undefined {
  return RUN_TRANSITIONS.find(
    (t) =>
      t.from === from &&
      t.event === event.type &&
      (t.when ? t.when(ctx) : true),
  );
}

function intentsFor(
  from: RunState,
  to: RunState,
  event: RunEvent,
  ctx: RunFSMState,
): PhysicsIntent[] {
  const intents: PhysicsIntent[] = [];

  if (event.type === "release" && to === "flying") {
    intents.push({
      type: "startFlight",
      x: event.originX,
      y: event.originY,
      vx: event.vx,
      vy: event.vy,
    });
  }

  if (from === "flying" && to === "scored") {
    intents.push({ type: "stopBall" });
    intents.push({ type: "seatBallAtHoop" });
  }

  if (from === "scored" && to === "transition") {
    intents.push({ type: "beginDunkTransition" });
  }

  if (from === "transition" && to === "aiming") {
    intents.push({ type: "completeDunkTransition" });
    intents.push({
      type: "placeRun",
      score: ctx.score,
      advanceSide: false,
    });
  }

  if (from === "boot" && to === "aiming") {
    intents.push({ type: "placeRun", score: ctx.score, advanceSide: false });
  }

  if (from === "missed" && to === "continue") {
    intents.push({ type: "showContinuePrompt" });
  }

  if (to === "ended") {
    intents.push({ type: "runEnded" });
    intents.push({ type: "hideContinuePrompt" });
  }

  if (from === "continue" && to === "aiming") {
    intents.push({ type: "hideContinuePrompt" });
    intents.push({ type: "placeRun", score: 0, advanceSide: false });
  }

  if (from === "missed" && to === "ended") {
    intents.push({ type: "hideContinuePrompt" });
  }

  return intents;
}

function applyStatePatch(
  ctx: RunFSMState,
  from: RunState,
  to: RunState,
  event: RunEvent,
  nowMs: number,
): RunFSMState {
  const next: RunFSMState = { ...ctx, state: to };

  if (event.type === "throughHoop" || (from === "flying" && to === "scored")) {
    next.score = ctx.score + 1;
    next.scoredAtMs = nowMs;
  }

  if (to === "aiming" && from === "transition") {
    next.scoredAtMs = null;
  }

  if (to === "aiming" && from === "continue") {
    next.continuesUsed = ctx.continuesUsed + 1;
    next.score = 0;
    next.scoredAtMs = null;
  }

  if (to === "aiming" && from === "boot") {
    next.scoredAtMs = null;
  }

  if (to === "missed" || to === "continue") {
    next.scoredAtMs = null;
  }

  return next;
}

/**
 * Pure reducer for the run lifecycle. Scene dispatches events; applies returned intents.
 */
export function reduceRunFSM(
  ctx: RunFSMState,
  event: RunEvent,
  nowMs = 0,
): RunFSMResult {
  if (event.type === "release") {
    if (ctx.state !== "aiming") {
      return {
        state: ctx,
        intents: [],
        accepted: false,
        reason: `release illegal in ${ctx.state}`,
      };
    }
    if (hypot(event.vx, event.vy) < event.minSpeed) {
      return {
        state: ctx,
        intents: [],
        accepted: false,
        reason: "release below minSpeed",
      };
    }
  }

  if (event.type === "offerContinue" && !allowsContinue(ctx.mode)) {
    return {
      state: ctx,
      intents: [],
      accepted: false,
      reason: "continue forbidden in tournament",
    };
  }

  const transition = findTransition(ctx.state, event, ctx);
  if (!transition) {
    return {
      state: ctx,
      intents: [],
      accepted: false,
      reason: `${event.type} illegal in ${ctx.state}`,
    };
  }

  const next = applyStatePatch(
    ctx,
    ctx.state,
    transition.to,
    event,
    nowMs,
  );
  const intents = intentsFor(ctx.state, transition.to, event, next);

  return { state: next, intents, accepted: true };
}

export function snapshotRunFSM(ctx: RunFSMState): RunFSMSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    state: ctx.state,
    mode: ctx.mode,
    score: ctx.score,
    continuesUsed: ctx.continuesUsed,
    scoredAtMs: ctx.scoredAtMs,
  };
}

export function restoreRunFSM(snap: RunFSMSnapshot): RunFSMState {
  if (snap.version !== SNAPSHOT_VERSION) {
    throw new Error(`unsupported RunFSMSnapshot version ${snap.version}`);
  }
  return {
    state: snap.state,
    mode: snap.mode,
    score: snap.score,
    continuesUsed: snap.continuesUsed,
    scoredAtMs: snap.scoredAtMs,
  };
}

/** Convenience wrapper — holds state and exposes dispatch. */
export class RunFSM {
  private ctx: RunFSMState;

  constructor(mode: GameMode = "casual") {
    this.ctx = createRunFSM(mode);
  }

  get state(): RunFSMState {
    return this.ctx;
  }

  get runState(): RunState {
    return this.ctx.state;
  }

  dispatch(event: RunEvent, nowMs = 0): RunFSMResult {
    const result = reduceRunFSM(this.ctx, event, nowMs);
    if (result.accepted) {
      this.ctx = result.state;
    }
    return result;
  }

  snapshot(): RunFSMSnapshot {
    return snapshotRunFSM(this.ctx);
  }

  restore(snap: RunFSMSnapshot): void {
    this.ctx = restoreRunFSM(snap);
  }
}
