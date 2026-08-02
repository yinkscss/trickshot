/**
 * In-memory sliding window rate limiter for Edge Functions (issue #7).
 *
 * Per-worker: each Deno isolate maintains its own Map. The `per_worker`
 * Edge runtime policy (see config.toml) keeps workers alive across requests
 * so counters persist within a worker's lifetime.
 *
 * This is explicitly acceptable for Alpha — the issue spec allows "Edge memory
 * with clear limits". Swap for DB-backed if horizontal scale requires
 * (stack lock: no Redis without a lock review).
 *
 * Security: a malicious caller who hits the per-IP limit from the same IP
 * is still blocked even across reconnections, because the Map is keyed on
 * the IP string and workers remain resident.
 */

/** Map from rate-limit key → timestamps of past requests (epoch ms). */
const windows = new Map<string, number[]>();

/**
 * Returns `true` when the request is allowed; `false` when rate-limited.
 *
 * Uses a sliding window: timestamps outside `windowMs` are pruned on each
 * call, so the map does not grow unboundedly for well-behaved callers.
 */
export function rateLimitByKey(
  key: string,
  maxRequests: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const recent = (windows.get(key) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= maxRequests) {
    windows.set(key, recent);
    return false; // rate-limited
  }

  recent.push(now);
  windows.set(key, recent);
  return true; // allowed
}

/**
 * 10 requests per IP per 15 minutes.
 * Applied before parsing the request body (cheapest check first).
 */
export function rateLimitByIp(ip: string): boolean {
  return rateLimitByKey(`ip:${ip}`, 10, 15 * 60 * 1000);
}

/**
 * 5 requests per Magic issuer per 15 minutes.
 * Applied after DID decode but before the Magic API call.
 */
export function rateLimitByIssuer(issuer: string): boolean {
  return rateLimitByKey(`issuer:${issuer}`, 5, 15 * 60 * 1000);
}

/**
 * Reset all windows — exported for unit tests only.
 * Do not call in production code.
 */
export function _resetRateLimitWindows(): void {
  windows.clear();
}
