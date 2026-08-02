/**
 * Shared session JWT helpers for Edge Functions (issue #7).
 *
 * Token strategy: custom HS256 JWT signed with `RUN_SIGNING_SECRET`.
 *
 * Why not Supabase Auth tokens?
 * Stack lock (`wallet=magic`) requires Magic.link as the primary identity
 * provider. Supabase Auth is explicitly NOT the primary player login in Alpha.
 * Issuing custom JWTs signed with our own secret keeps the two systems
 * cleanly separated — Supabase Auth is never involved.
 *
 * How clients use the token:
 *   Authorization: Bearer <accessToken>
 *   apiKey: <SUPABASE_ANON_KEY>
 *
 * Protected Edge Functions call `requireAuth(req)` to verify the token and
 * get the session payload. The anon API key is checked separately by the
 * `withSupabase({ auth: ["publishable"] })` wrapper.
 *
 * Token lifetime: 1 hour. No refresh tokens in Alpha — re-auth via Magic.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const ISSUER = "trickshot";
const ALGORITHM = "HS256";
export const SESSION_EXPIRY_SECONDS = 3600; // 1 hour

export interface SessionPayload {
  /** `public.users.id` — Supabase row UUID. */
  userId: string;
  /** Magic DID issuer (`did:ethr:0x...`). */
  issuer: string;
  /** Celo wallet address from Magic metadata. Never client-reported. */
  walletAddress: string;
}

// ---------------------------------------------------------------------------
// Internal: cross-runtime env access
// ---------------------------------------------------------------------------

/**
 * Read an environment variable in Deno (Edge) or Node.js (tests).
 * Uses a `typeof` guard so the TypeScript compiler sees no reference error
 * in either environment's type context.
 */
function readEnv(key: string): string | undefined {
  // deno-lint-ignore no-explicit-any
  const g = globalThis as any;
  if (typeof g.Deno !== "undefined") {
    return g.Deno.env.get(key) as string | undefined;
  }
  // Node.js fallback (unit tests)
  if (typeof g.process !== "undefined" && g.process.env) {
    return g.process.env[key] as string | undefined;
  }
  return undefined;
}

function getSecretBytes(): Uint8Array {
  const secret = readEnv("RUN_SIGNING_SECRET");
  if (!secret) {
    throw new Error(
      "RUN_SIGNING_SECRET environment variable is not set",
    );
  }
  return new TextEncoder().encode(secret);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sign a session JWT containing the player's identity.
 * Expires after `expirySeconds` (default 3600 — 1 hour).
 */
export async function signAccessToken(
  payload: SessionPayload,
  expirySeconds = SESSION_EXPIRY_SECONDS,
): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    issuer: payload.issuer,
    walletAddress: payload.walletAddress,
  })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setSubject(payload.userId)
    .setExpirationTime(`${expirySeconds}s`)
    .sign(getSecretBytes());
}

/**
 * Verify and decode a session JWT.
 * Throws a descriptive error on invalid signature, wrong issuer, or expiry.
 */
export async function verifyAccessToken(
  token: string,
): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, getSecretBytes(), {
    issuer: ISSUER,
    algorithms: [ALGORITHM],
  });
  return extractSession(payload);
}

function extractSession(payload: JWTPayload): SessionPayload {
  const { userId, issuer, walletAddress } = payload as Record<string, unknown>;
  if (
    typeof userId !== "string" ||
    typeof issuer !== "string" ||
    typeof walletAddress !== "string"
  ) {
    throw new Error("invalid session payload: missing required fields");
  }
  return { userId, issuer, walletAddress };
}

/**
 * Extract and verify the session from an `Authorization: Bearer <token>`
 * header. **Throws a `Response` object** (HTTP 401) on auth failure, so
 * callers can do:
 *
 *   ```ts
 *   const session = await requireAuth(req).catch((r) => r as Response);
 *   if (session instanceof Response) return session;
 *   ```
 *
 * Or use try/catch and re-throw the Response.
 */
export async function requireAuth(req: Request): Promise<SessionPayload> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw Response.json(
      { error: "unauthorized", reason: "missing_token" },
      { status: 401 },
    );
  }
  const token = authHeader.slice(7);
  try {
    return await verifyAccessToken(token);
  } catch {
    throw Response.json(
      { error: "unauthorized", reason: "invalid_token" },
      { status: 401 },
    );
  }
}
