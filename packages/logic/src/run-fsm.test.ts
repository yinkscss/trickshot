import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RUN_TRANSITIONS,
  RunFSM,
  allowsContinue,
  createRunFSM,
  reduceRunFSM,
  restoreRunFSM,
  snapshotRunFSM,
  type RunEvent,
  type RunState,
} from "./run-fsm.js";

const MIN = 0.5;

function release(
  vx = 3,
  vy = -4,
  minSpeed = MIN,
): Extract<RunEvent, { type: "release" }> {
  return {
    type: "release",
    vx,
    vy,
    originX: 10,
    originY: 20,
    minSpeed,
  };
}

function happyPath(mode: "casual" | "daily" | "tournament" = "casual") {
  let ctx = createRunFSM(mode);
  const steps: RunEvent[] = [
    { type: "bootComplete" },
    release(),
    { type: "throughHoop" },
    { type: "swishHoldComplete" },
    { type: "finishTransition" },
  ];
  for (const event of steps) {
    const r = reduceRunFSM(ctx, event, 100);
    assert.equal(r.accepted, true, `expected ${event.type} to succeed`);
    ctx = r.state;
  }
  return ctx;
}

describe("allowsContinue", () => {
  it("blocks tournament continues per stack lock", () => {
    assert.equal(allowsContinue("tournament"), false);
    assert.equal(allowsContinue("casual"), true);
    assert.equal(allowsContinue("daily"), true);
  });
});

describe("createRunFSM", () => {
  it("starts in boot with zeroed counters", () => {
    const ctx = createRunFSM("daily");
    assert.equal(ctx.state, "boot");
    assert.equal(ctx.score, 0);
    assert.equal(ctx.continuesUsed, 0);
    assert.equal(ctx.scoredAtMs, null);
    assert.equal(ctx.mode, "daily");
  });
});

describe("legal transitions", () => {
  it("boot → aiming", () => {
    const r = reduceRunFSM(createRunFSM(), { type: "bootComplete" });
    assert.equal(r.accepted, true);
    assert.equal(r.state.state, "aiming");
    assert.ok(r.intents.some((i) => i.type === "placeRun"));
  });

  it("aiming → flying on release", () => {
    let ctx = createRunFSM();
    ctx = reduceRunFSM(ctx, { type: "bootComplete" }).state;
    const r = reduceRunFSM(ctx, release());
    assert.equal(r.accepted, true);
    assert.equal(r.state.state, "flying");
    assert.deepEqual(r.intents[0], {
      type: "startFlight",
      x: 10,
      y: 20,
      vx: 3,
      vy: -4,
    });
  });

  it("flying → scored increments score", () => {
    let ctx = createRunFSM();
    ctx = reduceRunFSM(ctx, { type: "bootComplete" }).state;
    ctx = reduceRunFSM(ctx, release()).state;
    const r = reduceRunFSM(ctx, { type: "throughHoop" }, 500);
    assert.equal(r.state.state, "scored");
    assert.equal(r.state.score, 1);
    assert.equal(r.state.scoredAtMs, 500);
    assert.ok(r.intents.some((i) => i.type === "stopBall"));
  });

  it("flying → missed", () => {
    let ctx = createRunFSM();
    ctx = reduceRunFSM(ctx, { type: "bootComplete" }).state;
    ctx = reduceRunFSM(ctx, release()).state;
    const r = reduceRunFSM(ctx, { type: "outOfBounds" });
    assert.equal(r.state.state, "missed");
  });

  it("scored → transition → aiming", () => {
    let ctx = createRunFSM();
    ctx = reduceRunFSM(ctx, { type: "bootComplete" }).state;
    ctx = reduceRunFSM(ctx, release()).state;
    ctx = reduceRunFSM(ctx, { type: "throughHoop" }, 1).state;
    ctx = reduceRunFSM(ctx, { type: "swishHoldComplete" }).state;
    assert.equal(ctx.state, "transition");
    ctx = reduceRunFSM(ctx, { type: "finishTransition" }).state;
    assert.equal(ctx.state, "aiming");
    assert.equal(ctx.score, 1);
    assert.equal(ctx.scoredAtMs, null);
  });

  it("missed → continue → aiming (casual)", () => {
    let ctx = createRunFSM("casual");
    ctx = reduceRunFSM(ctx, { type: "bootComplete" }).state;
    ctx = reduceRunFSM(ctx, release()).state;
    ctx = reduceRunFSM(ctx, { type: "outOfBounds" }).state;
    const offer = reduceRunFSM(ctx, { type: "offerContinue" });
    assert.equal(offer.accepted, true);
    assert.equal(offer.state.state, "continue");
    const accept = reduceRunFSM(offer.state, { type: "acceptContinue" });
    assert.equal(accept.state.state, "aiming");
    assert.equal(accept.state.continuesUsed, 1);
    assert.equal(accept.state.score, 0);
  });

  it("missed → ended", () => {
    let ctx = createRunFSM();
    ctx = reduceRunFSM(ctx, { type: "bootComplete" }).state;
    ctx = reduceRunFSM(ctx, release()).state;
    ctx = reduceRunFSM(ctx, { type: "outOfBounds" }).state;
    const r = reduceRunFSM(ctx, { type: "endRun" });
    assert.equal(r.state.state, "ended");
    assert.ok(r.intents.some((i) => i.type === "runEnded"));
  });

  it("continue → ended on decline", () => {
    let ctx = createRunFSM();
    ctx = reduceRunFSM(ctx, { type: "bootComplete" }).state;
    ctx = reduceRunFSM(ctx, release()).state;
    ctx = reduceRunFSM(ctx, { type: "outOfBounds" }).state;
    ctx = reduceRunFSM(ctx, { type: "offerContinue" }).state;
    const r = reduceRunFSM(ctx, { type: "declineContinue" });
    assert.equal(r.state.state, "ended");
  });

  it("covers every declared edge in RUN_TRANSITIONS", () => {
    for (const edge of RUN_TRANSITIONS) {
      let ctx = createRunFSM(edge.when ? "casual" : "casual");
      if (edge.from === "boot") {
        /* ready */
      } else if (edge.from === "aiming") {
        ctx = reduceRunFSM(ctx, { type: "bootComplete" }).state;
      } else if (edge.from === "flying") {
        ctx = reduceRunFSM(ctx, { type: "bootComplete" }).state;
        ctx = reduceRunFSM(ctx, release()).state;
      } else if (edge.from === "scored") {
        ctx = reduceRunFSM(ctx, { type: "bootComplete" }).state;
        ctx = reduceRunFSM(ctx, release()).state;
        ctx = reduceRunFSM(ctx, { type: "throughHoop" }).state;
      } else if (edge.from === "transition") {
        ctx = reduceRunFSM(ctx, { type: "bootComplete" }).state;
        ctx = reduceRunFSM(ctx, release()).state;
        ctx = reduceRunFSM(ctx, { type: "throughHoop" }).state;
        ctx = reduceRunFSM(ctx, { type: "swishHoldComplete" }).state;
      } else if (edge.from === "missed") {
        ctx = reduceRunFSM(ctx, { type: "bootComplete" }).state;
        ctx = reduceRunFSM(ctx, release()).state;
        ctx = reduceRunFSM(ctx, { type: "outOfBounds" }).state;
      } else if (edge.from === "continue") {
        ctx = reduceRunFSM(ctx, { type: "bootComplete" }).state;
        ctx = reduceRunFSM(ctx, release()).state;
        ctx = reduceRunFSM(ctx, { type: "outOfBounds" }).state;
        ctx = reduceRunFSM(ctx, { type: "offerContinue" }).state;
      }
      assert.equal(ctx.state, edge.from, `setup for ${edge.event}`);
      const event =
        edge.event === "release"
          ? release()
          : ({ type: edge.event } as RunEvent);
      const r = reduceRunFSM(ctx, event);
      assert.equal(r.accepted, true, `${edge.from}+${edge.event}`);
      assert.equal(r.state.state, edge.to);
    }
  });
});

function reachState(target: RunState) {
  let ctx = createRunFSM();
  if (target === "boot") return ctx;
  ctx = reduceRunFSM(ctx, { type: "bootComplete" }).state;
  if (target === "aiming") return ctx;
  ctx = reduceRunFSM(ctx, release()).state;
  if (target === "flying") return ctx;

  if (target === "missed" || target === "continue" || target === "ended") {
    ctx = reduceRunFSM(ctx, { type: "outOfBounds" }).state;
    if (target === "missed") return ctx;
    if (target === "continue") {
      return reduceRunFSM(ctx, { type: "offerContinue" }).state;
    }
    return reduceRunFSM(ctx, { type: "endRun" }).state;
  }

  ctx = reduceRunFSM(ctx, { type: "throughHoop" }).state;
  if (target === "scored") return ctx;
  ctx = reduceRunFSM(ctx, { type: "swishHoldComplete" }).state;
  return ctx;
}

describe("illegal transitions", () => {
  const illegal: Array<{ from: RunState; event: RunEvent }> = [
    {
      from: "boot",
      event: { type: "release", vx: 1, vy: 1, originX: 0, originY: 0, minSpeed: MIN },
    },
    { from: "boot", event: { type: "throughHoop" } },
    { from: "aiming", event: { type: "throughHoop" } },
    { from: "flying", event: { type: "finishTransition" } },
    { from: "scored", event: { type: "outOfBounds" } },
    {
      from: "transition",
      event: { type: "release", vx: 1, vy: 1, originX: 0, originY: 0, minSpeed: MIN },
    },
    { from: "continue", event: { type: "throughHoop" } },
    { from: "ended", event: { type: "bootComplete" } },
    { from: "ended", event: { type: "acceptContinue" } },
  ];

  for (const { from, event } of illegal) {
    it(`rejects ${event.type} from ${from}`, () => {
      const ctx = reachState(from);
      assert.equal(ctx.state, from);
      const r = reduceRunFSM(ctx, event);
      assert.equal(r.accepted, false);
      assert.equal(r.state.state, from);
    });
  }

  it("rejects weak release in aiming", () => {
    let ctx = createRunFSM();
    ctx = reduceRunFSM(ctx, { type: "bootComplete" }).state;
    const r = reduceRunFSM(ctx, release(0.01, 0.01));
    assert.equal(r.accepted, false);
    assert.equal(r.state.state, "aiming");
  });

  it("rejects offerContinue in tournament", () => {
    let ctx = createRunFSM("tournament");
    ctx = reduceRunFSM(ctx, { type: "bootComplete" }).state;
    ctx = reduceRunFSM(ctx, release()).state;
    ctx = reduceRunFSM(ctx, { type: "outOfBounds" }).state;
    const r = reduceRunFSM(ctx, { type: "offerContinue" });
    assert.equal(r.accepted, false);
    assert.equal(r.state.state, "missed");
  });
});

describe("snapshot round-trip", () => {
  it("restores FSM state for replay logs", () => {
    const fsm = new RunFSM("daily");
    fsm.dispatch({ type: "bootComplete" });
    fsm.dispatch(release());
    fsm.dispatch({ type: "throughHoop" }, 42);
    const snap = fsm.snapshot();
    const restored = restoreRunFSM(snap);
    assert.deepEqual(restored, fsm.state);
    assert.equal(snap.version, 1);
    assert.equal(snapshotRunFSM(restored).score, 1);
  });
});
