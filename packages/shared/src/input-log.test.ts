import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INPUT_LOG_VERSION,
  deserializeInputLog,
  parseInputLog,
  serializeInputLog,
  validateInputLog,
} from "./input-log.js";

const baseLog = {
  version: INPUT_LOG_VERSION,
  seed: "test-seed",
  mode: "casual" as const,
  physicsBuildId: "physics-deadbeef",
  frames: [{ t: 0, type: "pointer_down" as const, x: 1, y: 2 }],
};

describe("input log schema", () => {
  it("parses a valid v1 log", () => {
    const log = parseInputLog(baseLog);
    assert.equal(log.seed, "test-seed");
    assert.equal(log.frames.length, 1);
  });

  it("rejects unknown version via validateInputLog", () => {
    const result = validateInputLog({ ...baseLog, version: 2 });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors[0]?.code, "unsupported_version");
  });

  it("rejects client-declared score fields", () => {
    const result = validateInputLog({ ...baseLog, score: 999 });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors[0]?.code, "client_score");
  });

  it("rejects tournament continue_accept events", () => {
    const result = validateInputLog({
      ...baseLog,
      mode: "tournament",
      frames: [{ t: 0, type: "continue_accept" }],
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.errors.some((e) => e.code === "tournament_continue"), true);
  });

  it("round-trips serialize/deserialize", () => {
    const json = serializeInputLog(parseInputLog(baseLog));
    const restored = deserializeInputLog(json);
    assert.deepEqual(restored, parseInputLog(baseLog));
  });
});
