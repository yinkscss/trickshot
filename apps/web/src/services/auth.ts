/**
 * Client-side auth service
 *
 * Auth flow:
 *  1. Player enters email → Magic.link sends OTP
 *  2. Player confirms OTP → Magic SDK returns a DID token
 *  3. Client POSTs DID token to Edge Function `auth-magic`
 *  4. Edge Function verifies with Magic Admin SDK, upserts `public.users`,
 *     returns a signed session JWT
 *  5. Client stores session in localStorage (`trickshot.session.v1`)
 *  6. Future Edge Function calls attach the JWT as: Authorization: Bearer <token>
 *
 * Stack constraints:
 *  - `wallet=magic` — Magic.link is the identity provider; Supabase Auth is NOT
 *  - `chain=celo` — wallet is Celo-provisioned by Magic
 *  - MAGIC_SECRET_KEY + SUPABASE_SERVICE_ROLE_KEY never reach this file
 *
 * Token lifetime: 1 hour (Alpha). No refresh — user re-logs via Magic.
 */

import { Magic } from "magic-sdk";
import { getCeloNetworkConfig } from "./network.js";

const SESSION_KEY = "trickshot.session.v1";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrickshotSession {
  userId: string;
  walletAddress: string;
  /** HS256 JWT — attach as Authorization: Bearer header to Edge Function calls. */
  accessToken: string;
  /** Unix timestamp (ms) after which the token is expired. */
  expiresAt: number;
}

export interface MagicRpcProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Magic SDK singleton
// ---------------------------------------------------------------------------

let _magic: Magic | null = null;

/**
 * Lazily initialise the Magic SDK with the configured Celo network.
 * Returns `null` when `VITE_MAGIC_PUBLISHABLE_KEY` is not set (local dev
 * without Magic configured).
 */
function initMagic(): Magic | null {
  if (_magic) return _magic;

  const key = import.meta.env.VITE_MAGIC_PUBLISHABLE_KEY as string | undefined;
  if (!key || key === "pk_live_REPLACE_ME") {
    console.warn(
      "[auth] VITE_MAGIC_PUBLISHABLE_KEY not configured. " +
      "Magic login will not work. Set the key in .env.",
    );
    return null;
  }

  const network = getCeloNetworkConfig();
  _magic = new Magic(key, {
    network: {
      rpcUrl: network.rpcUrl,
      chainId: network.chainId,
    },
  });
  return _magic;
}

/** Return Magic's EIP-1193-compatible provider for viem wallet requests. */
export function getMagicRpcProvider(): MagicRpcProvider | null {
  const magic = initMagic();
  if (!magic) return null;
  return {
    request: ({ method, params }) =>
      Promise.resolve(magic.rpcProvider.request({ method, params })),
  };
}

// ---------------------------------------------------------------------------
// Network guard
// ---------------------------------------------------------------------------

/**
 * Validate the configured Celo network at app startup. Unsupported chain IDs
 * fail fast instead of silently pointing a mainnet build at testnet.
 *
 * Call once at app startup (see `src/main.ts`).
 */
export function guardCeloNetwork(): void {
  getCeloNetworkConfig();
}

// ---------------------------------------------------------------------------
// Session persistence
// ---------------------------------------------------------------------------

/**
 * Persist the session returned by `auth-magic` to localStorage.
 * The `expiresAt` timestamp lets `getSession()` prune expired sessions.
 */
function saveSession(
  raw: { userId: string; walletAddress: string; accessToken: string; expiresIn: number },
): TrickshotSession {
  const session: TrickshotSession = {
    userId: raw.userId,
    walletAddress: raw.walletAddress,
    accessToken: raw.accessToken,
    expiresAt: Date.now() + raw.expiresIn * 1000,
  };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* private mode / storage quota */
  }
  return session;
}

/**
 * Read the stored session. Returns `null` if:
 * - No session exists
 * - Session is expired (past `expiresAt`)
 * - JSON is malformed
 */
export function getSession(): TrickshotSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Partial<TrickshotSession>;
    if (
      typeof session.userId !== "string" ||
      typeof session.accessToken !== "string" ||
      typeof session.expiresAt !== "number"
    ) {
      return null;
    }
    if (Date.now() >= session.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session as TrickshotSession;
  } catch {
    return null;
  }
}

/** `true` when a valid (non-expired) session is stored. */
export function isSignedIn(): boolean {
  return getSession() !== null;
}

/**
 * Retrieve the current access token for attaching to Edge Function requests.
 * Returns `null` when not signed in or session is expired.
 */
export function getAccessToken(): string | null {
  return getSession()?.accessToken ?? null;
}

// ---------------------------------------------------------------------------
// Auth actions
// ---------------------------------------------------------------------------

/**
 * Log in with Magic email OTP. Resolves after the user confirms the OTP
 * in the Magic overlay. Returns the new session.
 *
 * Throws if:
 * - Magic SDK is not configured (see `initMagic`)
 * - Magic OTP flow is cancelled or fails
 * - The `auth-magic` Edge Function call fails
 */
export async function login(email: string): Promise<TrickshotSession> {
  const magic = initMagic();
  if (!magic) {
    throw new Error(
      "Magic SDK not configured — set VITE_MAGIC_PUBLISHABLE_KEY in .env",
    );
  }

  // Step 1: Magic email OTP → DID token
  const didToken = await magic.auth.loginWithEmailOTP({ email });
  if (!didToken) {
    throw new Error("Magic OTP login did not return a DID token");
  }

  // Step 2: Bridge DID token to Supabase user row + session JWT
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  const res = await fetch(`${supabaseUrl}/functions/v1/auth-magic`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // anon key required by withSupabase({ auth: ["publishable"] }) wrapper
      "apiKey": anonKey,
    },
    body: JSON.stringify({ didToken }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(
      `auth-magic failed (${res.status}): ${body.error ?? "unknown error"}`,
    );
  }

  const data = await res.json() as {
    userId: string;
    walletAddress: string;
    accessToken: string;
    expiresIn: number;
  };

  return saveSession(data);
}

/**
 * Log out: clear the local session and log out from Magic.
 * Silent on Magic logout errors (token may already be expired).
 */
export async function logout(): Promise<void> {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* private mode */
  }
  try {
    const magic = initMagic();
    if (magic) await magic.user.logout();
  } catch {
    /* already logged out or network unavailable */
  }
}

// ---------------------------------------------------------------------------
// Authenticated fetch helper
// ---------------------------------------------------------------------------

/**
 * Wrapper around `fetch` that attaches the session JWT and Supabase anon key.
 * Use for all authenticated Edge Function calls.
 *
 * @example
 * const res = await fetchWithAuth("/functions/v1/runs-finish", {
 *   method: "POST",
 *   body: JSON.stringify(runSummary),
 * });
 */
export async function fetchWithAuth(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const session = getSession();
  if (!session) {
    throw new Error("Not signed in — call auth.login() first");
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const url = path.startsWith("http") ? path : `${supabaseUrl}${path}`;

  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
      "apiKey": anonKey,
      "Authorization": `Bearer ${session.accessToken}`,
    },
  });
}
