/**
 * Tests for leaderboard handler (issue #8).
 * Run via: npm run test:edge
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleLeaderboard, type LeaderboardDeps, type LeaderboardRow } from "./handler.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRow(rank: number): LeaderboardRow {
  return {
    rank,
    userId: `user-${rank}`,
    walletAddress: `0x${rank.toString().padStart(40, "0")}`,
    score: 100 - rank,
    chainLength: 10 - rank,
    createdAt: new Date(Date.now() - rank * 1000).toISOString(),
  };
}

function makeDeps(overrides: Partial<LeaderboardDeps> = {}): LeaderboardDeps {
  return {
    queryBoard: async () => [makeRow(1), makeRow(2), makeRow(3)],
    ...overrides,
  };
}

function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL("https://edge.example.com/functions/v1/leaderboard");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString(), { method: "GET" });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("handleLeaderboard — method guard", () => {
  it("returns 405 for POST", async () => {
    const req = new Request("https://example.com", { method: "POST", body: "{}" });
    const res = await handleLeaderboard(req, makeDeps());
    assert.equal(res.status, 405);
  });
});

describe("handleLeaderboard — query param validation", () => {
  it("returns 400 for invalid mode", async () => {
    const req = makeRequest({ mode: "ranked" });
    const res = await handleLeaderboard(req, makeDeps());
    assert.equal(res.status, 400);
    const body = await res.json() as { error: string };
    assert.equal(body.error, "invalid_mode");
  });

  it("returns 400 for invalid date format", async () => {
    const req = makeRequest({ mode: "daily", date: "29-07-2026" });
    const res = await handleLeaderboard(req, makeDeps());
    assert.equal(res.status, 400);
    const body = await res.json() as { error: string };
    assert.equal(body.error, "invalid_date");
  });

  it("accepts valid YYYY-MM-DD date", async () => {
    const req = makeRequest({ mode: "daily", date: "2026-07-29" });
    const res = await handleLeaderboard(req, makeDeps());
    assert.equal(res.status, 200);
  });
});

describe("handleLeaderboard — success", () => {
  it("returns 200 with board array for valid request", async () => {
    const req = makeRequest({ mode: "daily", date: "2026-07-29", limit: "10" });
    const res = await handleLeaderboard(req, makeDeps());
    assert.equal(res.status, 200);
    const body = await res.json() as { board: LeaderboardRow[]; mode: string; date: string };
    assert.equal(body.mode, "daily");
    assert.equal(body.date, "2026-07-29");
    assert.equal(body.board.length, 3);
    assert.equal(body.board[0]!.rank, 1);
  });

  it("defaults to mode=daily when not specified", async () => {
    let capturedMode: string | null = null;
    const deps = makeDeps({
      queryBoard: async ({ mode }) => { capturedMode = mode; return []; },
    });
    const req = makeRequest({});
    await handleLeaderboard(req, deps);
    assert.equal(capturedMode, "daily");
  });

  it("caps limit at 500", async () => {
    let capturedLimit: number | null = null;
    const deps = makeDeps({
      queryBoard: async ({ limit }) => { capturedLimit = limit; return []; },
    });
    const req = makeRequest({ mode: "casual", limit: "9999" });
    await handleLeaderboard(req, deps);
    assert.equal(capturedLimit, 500);
  });

  it("defaults limit to 100 when not specified", async () => {
    let capturedLimit: number | null = null;
    const deps = makeDeps({
      queryBoard: async ({ limit }) => { capturedLimit = limit; return []; },
    });
    const req = makeRequest({ mode: "casual" });
    await handleLeaderboard(req, deps);
    assert.equal(capturedLimit, 100);
  });

  it("passes correct date to queryBoard", async () => {
    let capturedDate: string | null = null;
    const deps = makeDeps({
      queryBoard: async ({ date }) => { capturedDate = date; return []; },
    });
    const req = makeRequest({ mode: "tournament", date: "2026-07-01" });
    await handleLeaderboard(req, deps);
    assert.equal(capturedDate, "2026-07-01");
  });

  it("returns 500 when queryBoard throws", async () => {
    const deps = makeDeps({
      queryBoard: async () => { throw new Error("DB timeout"); },
    });
    const req = makeRequest({ mode: "daily" });
    const res = await handleLeaderboard(req, deps);
    assert.equal(res.status, 500);
    const body = await res.json() as { error: string };
    assert.equal(body.error, "db_error");
  });

  it("accepts all valid modes", async () => {
    for (const mode of ["casual", "daily", "tournament", "challenges"] as const) {
      const req = makeRequest({ mode });
      const res = await handleLeaderboard(req, makeDeps());
      assert.equal(res.status, 200, `mode=${mode} should return 200`);
    }
  });

  it("returns empty board when no verified runs exist", async () => {
    const deps = makeDeps({ queryBoard: async () => [] });
    const req = makeRequest({ mode: "daily", date: "2026-07-29" });
    const res = await handleLeaderboard(req, deps);
    assert.equal(res.status, 200);
    const body = await res.json() as { board: LeaderboardRow[] };
    assert.equal(body.board.length, 0);
  });
});
