/**
 * Simple in-memory rate limiter for API routes.
 *
 * Uses a sliding-window counter per key (e.g. user ID or IP address).
 * Suitable for a single-process deployment; swap for Redis in a multi-replica setup.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Prune expired entries every 5 minutes to prevent unbounded memory growth
setInterval(
  () => {
    const now = Date.now()
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) {
        store.delete(key)
      }
    }
  },
  5 * 60 * 1000
)

export interface RateLimitOptions {
  /** Maximum number of requests allowed in the window. */
  limit: number
  /** Window duration in seconds. */
  windowSeconds: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Check whether a request from `key` should be allowed.
 *
 * @param key      Unique identifier (user ID, IP, etc.)
 * @param options  Rate-limit configuration
 */
export function checkRateLimit(
  key: string,
  { limit, windowSeconds }: RateLimitOptions
): RateLimitResult {
  const now = Date.now()
  const windowMs = windowSeconds * 1000

  let entry = store.get(key)

  if (!entry || entry.resetAt <= now) {
    entry = { count: 1, resetAt: now + windowMs }
    store.set(key, entry)
    return { allowed: true, remaining: limit - 1, resetAt: entry.resetAt }
  }

  entry.count += 1

  if (entry.count > limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}
