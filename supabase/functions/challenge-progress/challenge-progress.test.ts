/**
 * Tests for challenge-progress handler (issue #43).
 * Run via: npm run test:edge
 */

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  handleChallengeProgress,
  formatProgress,
  type ChallengeProgressDeps,
  type LevelProgressRow,
} from "./handler.ts";

// ---------------------------------------------------------------------------
// Helpers & Fixtures
// ---------------------------------------------------------------------------

const VALID_USER = { userId: "user-uuid-1" };
let dbStore: Map<number, LevelProgressRow> = new Map();

function makeDeps(overrides: Partial<ChallengeProgressDeps> = {}): ChallengeProgressDeps {
  return {
    requireAuth: async () => VALID_USER,
    getUserProgress: async () => Array.from(dbStore.values()).sort((a, b) => a.levelIndex - b.levelIndex),
    upsertLevelProgress: async (_userId, levelIndex, cleared, stars) => {
      const existing = dbStore.get(levelIndex);
      const updated: LevelProgressRow = {
        levelIndex,
        cleared: existing ? (existing.cleared || cleared) : cleared,
        stars: existing ? Math.max(existing.stars, stars) : stars,
      };
      dbStore.set(levelIndex, updated);
      return updated;
    },
    ...overrides,
  };
}

function makeRequest(method = "GET", body?: unknown): Request {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  return new Request("https://edge.example.com/functions/v1/challenge-progress", init);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("handleChallengeProgress — method guard", () => {
  it("returns 405 for DELETE", async () => {
    const res = await handleChallengeProgress(makeRequest("DELETE"), makeDeps());
    assert.equal(res.status, 405);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "method_not_allowed");
  });
});

describe("handleChallengeProgress — auth", () => {
  it("returns 401 when requireAuth throws a Response", async () => {
    const deps = makeDeps({
      requireAuth: async () => {
        throw new Response(null, { status: 401 });
      },
    });
    const res = await handleChallengeProgress(makeRequest("GET"), deps);
    assert.equal(res.status, 401);
  });
});

describe("handleChallengeProgress — GET", () => {
  beforeEach(() => {
    dbStore = new Map();
  });

  it("returns empty cleared and stars maps when user has no progress", async () => {
    const res = await handleChallengeProgress(makeRequest("GET"), makeDeps());
    assert.equal(res.status, 200);
    const body = (await res.json()) as { cleared: Record<string, boolean>; stars: Record<string, number> };
    assert.deepEqual(body.cleared, {});
    assert.deepEqual(body.stars, {});
  });

  it("returns formatted progress when user has saved levels", async () => {
    dbStore.set(0, { levelIndex: 0, cleared: true, stars: 2 });
    dbStore.set(1, { levelIndex: 1, cleared: true, stars: 3 });

    const res = await handleChallengeProgress(makeRequest("GET"), makeDeps());
    assert.equal(res.status, 200);
    const body = (await res.json()) as { cleared: Record<string, boolean>; stars: Record<string, number> };
    assert.equal(body.cleared["0"], true);
    assert.equal(body.cleared["1"], true);
    assert.equal(body.stars["0"], 2);
    assert.equal(body.stars["1"], 3);
  });
});

describe("handleChallengeProgress — POST single level", () => {
  beforeEach(() => {
    dbStore = new Map();
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("https://edge.example.com/functions/v1/challenge-progress", {
      method: "POST",
      body: "not json",
    });
    const res = await handleChallengeProgress(req, makeDeps());
    assert.equal(res.status, 400);
  });

  it("returns 400 for negative levelIndex", async () => {
    const res = await handleChallengeProgress(makeRequest("POST", { levelIndex: -1, stars: 1 }), makeDeps());
    assert.equal(res.status, 400);
    assert.equal(((await res.json()) as { error: string }).error, "invalid_level_index");
  });

  it("returns 400 for invalid stars count (> 3)", async () => {
    const res = await handleChallengeProgress(makeRequest("POST", { levelIndex: 0, stars: 5 }), makeDeps());
    assert.equal(res.status, 400);
    assert.equal(((await res.json()) as { error: string }).error, "invalid_stars");
  });

  it("returns 422 level_locked when attempting level 1 before level 0 is cleared", async () => {
    const res = await handleChallengeProgress(makeRequest("POST", { levelIndex: 1, stars: 2 }), makeDeps());
    assert.equal(res.status, 422);
    assert.equal(((await res.json()) as { error: string }).error, "level_locked");
  });

  it("successfully clears Level 0 (free level)", async () => {
    const res = await handleChallengeProgress(makeRequest("POST", { levelIndex: 0, stars: 2 }), makeDeps());
    assert.equal(res.status, 200);
    const body = (await res.json()) as { status: string; levelIndex: number; cleared: boolean; stars: number; progress: unknown };
    assert.equal(body.status, "ok");
    assert.equal(body.levelIndex, 0);
    assert.equal(body.cleared, true);
    assert.equal(body.stars, 2);
  });

  it("allows clearing Level 1 after Level 0 has been cleared", async () => {
    dbStore.set(0, { levelIndex: 0, cleared: true, stars: 1 });
    const res = await handleChallengeProgress(makeRequest("POST", { levelIndex: 1, stars: 3 }), makeDeps());
    assert.equal(res.status, 200);
    const body = (await res.json()) as { status: string; levelIndex: number };
    assert.equal(body.levelIndex, 1);
  });

  it("retains maximum stars when a lower star count is submitted for an existing level", async () => {
    dbStore.set(0, { levelIndex: 0, cleared: true, stars: 3 });
    const res = await handleChallengeProgress(makeRequest("POST", { levelIndex: 0, stars: 1 }), makeDeps());
    assert.equal(res.status, 200);
    const body = (await res.json()) as { stars: number };
    assert.equal(body.stars, 3);
  });
});

describe("handleChallengeProgress — POST bulk sync", () => {
  beforeEach(() => {
    dbStore = new Map();
  });

  it("successfully syncs bulk progress from client", async () => {
    const syncData = {
      sync: {
        cleared: { "0": true, "1": true },
        stars: { "0": 2, "1": 3 },
      },
    };
    const res = await handleChallengeProgress(makeRequest("POST", syncData), makeDeps());
    assert.equal(res.status, 200);
    const body = (await res.json()) as { status: string; progress: { cleared: Record<string, boolean>; stars: Record<string, number> } };
    assert.equal(body.status, "ok");
    assert.equal(body.progress.cleared["0"], true);
    assert.equal(body.progress.cleared["1"], true);
    assert.equal(body.progress.stars["0"], 2);
    assert.equal(body.progress.stars["1"], 3);
  });
});
