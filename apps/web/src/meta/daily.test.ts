import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateShotLayout } from "@trickshot/logic";
import { dailySeed, seedForMode, utcDateKey } from "./daily.js";

describe("daily seed", () => {
  it("is stable for a UTC calendar day", () => {
    const a = new Date("2026-07-26T01:00:00.000Z");
    const b = new Date("2026-07-26T23:59:59.000Z");
    const c = new Date("2026-07-27T00:00:00.000Z");
    assert.equal(utcDateKey(a), "2026-07-26");
    assert.equal(dailySeed(a), dailySeed(b));
    assert.notEqual(dailySeed(a), dailySeed(c));
  });

  it("yields identical daily layouts for the same seed", () => {
    const seed = dailySeed(new Date("2026-07-26T12:00:00.000Z"));
    const input = {
      side: 1 as const,
      score: 3,
      seed,
      mode: "daily" as const,
      width: 390,
      height: 780,
    };
    assert.deepEqual(generateShotLayout(input), generateShotLayout(input));
  });

  it("resolves casual per-run and tournament ids", () => {
    assert.equal(
      seedForMode("casual", { runSeed: "uuid-abc" }),
      "uuid-abc",
    );
    assert.equal(
      seedForMode("tournament", {
        runSeed: "ignored",
        tournamentId: "event-1",
      }),
      "event-1",
    );
  });
});
