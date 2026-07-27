import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INPUT_LOG_VERSION,
  deserializeInputLog,
  isContinueForbiddenCode,
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

  it("rejects continue_accept in modes that forbid continues", () => {
    for (const mode of ["tournament", "challenges"] as const) {
      const result = validateInputLog({
        ...baseLog,
        mode,
        frames: [{ t: 0, type: "continue_accept" }],
      });
      assert.equal(result.ok, false);
      if (result.ok) return;
      const err = result.errors.find((e) => e.code === "continue_forbidden");
      assert.ok(err, `${mode} should emit continue_forbidden`);
      assert.equal(isContinueForbiddenCode(err.code), true);
      assert.equal(isContinueForbiddenCode("tournament_continue"), true);
    }
  });

  it("allows continue_accept in casual and daily", () => {
    for (const mode of ["casual", "daily"] as const) {
      const result = validateInputLog({
        ...baseLog,
        mode,
        frames: [{ t: 0, type: "continue_accept" }],
      });
      assert.equal(result.ok, true, `${mode} should allow continue_accept`);
    }
  });

  it("round-trips serialize/deserialize", () => {
    const json = serializeInputLog(parseInputLog(baseLog));
    const restored = deserializeInputLog(json);
    assert.deepEqual(restored, parseInputLog(baseLog));
  });
});
