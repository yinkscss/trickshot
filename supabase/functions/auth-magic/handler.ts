/**
 * auth-magic business logic (issue #7).
 *
 * This module contains the pure request handler for the Magic → Supabase
 * user bridge. All external dependencies (Magic SDK, Supabase client, JWT
 * signing, rate limiters) are injected so the handler can be unit-tested
 * in Node.js without a Deno runtime or real network calls.
 *
 * The Deno/Supabase wiring lives in `index.ts`.
 */

// ---------------------------------------------------------------------------
// Dependency interfaces
// ---------------------------------------------------------------------------

/**
 * Minimal Magic Admin client surface required by this handler.
 * The real `Magic` class from `@magic-sdk/admin` satisfies this interface.
 */
export interface MagicClient {
  token: {
    /**
     * Validate the DID token's signature and expiry.
     * Throws `MagicAdminSDKError` (or any Error) on invalid/expired token.
     */
    validate(didToken: string): void;
    /** Extract the Magic issuer (DID) from the token without network I/O. */
    getIssuer(didToken: string): string;
  };
  users: {
    /** Fetch user metadata from Magic's API (requires network). */
    getMetadataByToken(
      didToken: string,
    ): Promise<{ publicAddress: string | null }>;
  };
}

export interface UserRow {
  id: string;
  magic_issuer: string;
  wallet_address: string;
}

export interface AuthMagicDeps {
  magic: MagicClient;
  /**
   * Upsert the player's `public.users` row.
   * ON CONFLICT (magic_issuer) → update wallet_address.
   * Throws on DB error.
   */
  upsertUser(issuer: string, walletAddress: string): Promise<UserRow>;
  /**
   * Sign and return the session JWT for the player.
   * Wraps `signAccessToken` from `_shared/auth.ts` in production.
   */
  signToken(
    userId: string,
    issuer: string,
    walletAddress: string,
  ): Promise<string>;
  /** Returns false when the IP has exceeded the rate limit. */
  rateLimitIp(ip: string): boolean;
  /** Returns false when the Magic issuer has exceeded the rate limit. */
  rateLimitIssuer(issuer: string): boolean;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Handle a POST /functions/v1/auth-magic request.
 *
 * Flow:
 *  1. Rate-limit by IP (before body parse — cheapest first)
 *  2. Parse + validate body shape
 *  3. Verify Magic DID token (offline: signature + expiry)
 *  4. Rate-limit by Magic issuer (after DID decode, before API call)
 *  5. Fetch wallet address from Magic metadata API
 *  6. Upsert `public.users` via service role
 *  7. Sign + return session JWT
 */
export async function handleAuthMagic(
  req: Request,
  deps: AuthMagicDeps,
): Promise<Response> {
  // -- Method guard -----------------------------------------------------------
  if (req.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }

  // -- Rate limit by IP -------------------------------------------------------
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!deps.rateLimitIp(ip)) {
    return Response.json(
      { error: "rate_limited", retryAfterMs: 15 * 60 * 1000 },
      { status: 429 },
    );
  }

  // -- Parse body -------------------------------------------------------------
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const { didToken } = body;
  if (typeof didToken !== "string" || !didToken) {
    return Response.json({ error: "missing_did_token" }, { status: 400 });
  }

  // -- Verify Magic DID token (offline) ---------------------------------------
  let magicIssuer: string;
  try {
    deps.magic.token.validate(didToken);
    magicIssuer = deps.magic.token.getIssuer(didToken);
  } catch (err) {
    return Response.json(
      { error: "invalid_did_token", detail: String(err) },
      { status: 401 },
    );
  }

  // -- Rate limit by issuer ---------------------------------------------------
  // Applied after DID decode so the issuer key is available, but before the
  // Magic API call so abusers don't trigger unnecessary upstream requests.
  if (!deps.rateLimitIssuer(magicIssuer)) {
    return Response.json(
      { error: "rate_limited", retryAfterMs: 15 * 60 * 1000 },
      { status: 429 },
    );
  }

  // -- Fetch wallet address from Magic metadata -------------------------------
  // Wallet is ALWAYS taken from Magic's verified metadata — never from the
  // client request body (security requirement: no client-reported wallets).
  let walletAddress: string;
  try {
    const metadata = await deps.magic.users.getMetadataByToken(didToken);
    if (!metadata.publicAddress) {
      return Response.json(
        {
          error: "no_wallet",
          detail:
            "Magic account has no provisioned wallet. " +
            "Ensure Celo Sepolia is enabled in the Magic dashboard.",
        },
        { status: 401 },
      );
    }
    walletAddress = metadata.publicAddress;
  } catch (err) {
    // Re-throw the no_wallet response shape if it came from our own guard
    if (err instanceof Response) throw err;
    return Response.json(
      { error: "magic_api_error", detail: String(err) },
      { status: 502 },
    );
  }

  // -- Upsert user row --------------------------------------------------------
  let user: UserRow;
  try {
    user = await deps.upsertUser(magicIssuer, walletAddress);
  } catch (err) {
    return Response.json(
      { error: "db_error", detail: String(err) },
      { status: 500 },
    );
  }

  // -- Sign session JWT -------------------------------------------------------
  let accessToken: string;
  try {
    accessToken = await deps.signToken(user.id, user.magic_issuer, user.wallet_address);
  } catch (err) {
    return Response.json(
      { error: "token_error", detail: String(err) },
      { status: 500 },
    );
  }

  return Response.json({
    userId: user.id,
    walletAddress: user.wallet_address,
    accessToken,
    expiresIn: 3600,
  });
}
