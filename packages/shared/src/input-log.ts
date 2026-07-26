import { z } from "zod";

/** Locked schema version — reject unknown values in validators. */
export const INPUT_LOG_VERSION = 1 as const;

/**
 * Max serialized log size for hybrid replay uploads (Edge #8).
 * Truncation: recorder stops appending once exceeded; `truncated: true` on finalize.
 */
export const INPUT_LOG_MAX_BYTES = 512 * 1024;

/** Hard cap on frame count before truncation. */
export const INPUT_LOG_MAX_FRAMES = 4096;

export const gameModeSchema = z.enum(["casual", "daily", "tournament"]);

export const inputLogFrameTypeSchema = z.enum([
  "pointer_down",
  "pointer_move",
  "pointer_up",
  "release",
  "through_hoop",
  "out_of_bounds",
  "continue_accept",
  "continue_decline",
  "powerup",
  "tick",
]);

export const inputLogFrameSchema = z
  .object({
    t: z.number().finite().nonnegative(),
    type: inputLogFrameTypeSchema,
    x: z.number().finite().optional(),
    y: z.number().finite().optional(),
    vx: z.number().finite().optional(),
    vy: z.number().finite().optional(),
    originX: z.number().finite().optional(),
    originY: z.number().finite().optional(),
    dt: z.number().finite().positive().optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const inputLogSchema = z
  .object({
    version: z.literal(INPUT_LOG_VERSION),
    seed: z.string().min(1),
    mode: gameModeSchema,
    /** Hash of `@trickshot/physics` constants — mismatched builds fail closed. */
    physicsBuildId: z.string().min(1),
    frames: z.array(inputLogFrameSchema).max(INPUT_LOG_MAX_FRAMES),
    /** Set when recorder hit size/frame limits. */
    truncated: z.boolean().optional(),
  })
  .strict();

export type GameMode = z.infer<typeof gameModeSchema>;
export type InputLogFrameType = z.infer<typeof inputLogFrameTypeSchema>;
export type InputLogFrame = z.infer<typeof inputLogFrameSchema>;
export type InputLog = z.infer<typeof inputLogSchema>;

export interface InputLogValidationError {
  code:
    | "invalid_schema"
    | "unsupported_version"
    | "tournament_continue"
    | "oversized"
    | "client_score";
  message: string;
}

export type InputLogValidationResult =
  | { ok: true; log: InputLog }
  | { ok: false; errors: InputLogValidationError[] };

/** Parse JSON — throws ZodError on shape mismatch. */
export function parseInputLog(raw: unknown): InputLog {
  return inputLogSchema.parse(raw);
}

/** Server-side validator — rejects unknown version, tournament continues, client score. */
export function validateInputLog(raw: unknown): InputLogValidationResult {
  const version =
    typeof raw === "object" && raw !== null && "version" in raw
      ? (raw as { version: unknown }).version
      : undefined;

  if (version !== INPUT_LOG_VERSION) {
    return {
      ok: false,
      errors: [
        {
          code: "unsupported_version",
          message: `unsupported input log version ${String(version)}`,
        },
      ],
    };
  }

  if (hasClientDeclaredScore(raw)) {
    return {
      ok: false,
      errors: [
        {
          code: "client_score",
          message: "input log must not contain client-declared score",
        },
      ],
    };
  }

  const parsed = inputLogSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: [
        {
          code: "invalid_schema",
          message: parsed.error.message,
        },
      ],
    };
  }

  const log = parsed.data;
  const errors: InputLogValidationError[] = [];

  const serialized = JSON.stringify(log);
  if (serialized.length > INPUT_LOG_MAX_BYTES) {
    errors.push({
      code: "oversized",
      message: `input log exceeds ${INPUT_LOG_MAX_BYTES} bytes`,
    });
  }

  if (log.mode === "tournament") {
    const illegal = log.frames.some((f) => f.type === "continue_accept");
    if (illegal) {
      errors.push({
        code: "tournament_continue",
        message: "tournament logs cannot contain continue_accept events",
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, log };
}

function hasClientDeclaredScore(raw: unknown): boolean {
  if (typeof raw !== "object" || raw === null) return false;
  const obj = raw as Record<string, unknown>;
  if ("score" in obj || "chainLength" in obj || "stars" in obj) return true;
  return false;
}

/** JSON serialization for `RunSummary.inputLog`. */
export function serializeInputLog(log: InputLog): string {
  return JSON.stringify(log);
}

export function deserializeInputLog(json: string): InputLog {
  return parseInputLog(JSON.parse(json) as unknown);
}

/** Type guard for mode-specific server checks. */
export function isTournamentLog(log: InputLog): log is InputLog & { mode: "tournament" } {
  return log.mode === "tournament";
}
