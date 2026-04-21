interface CachedResponse {
  statusCode: number;
  body: unknown;
  createdAt: number;
}

// In-memory cache - in production, use Redis for multi-server support
const cache = new Map<string, CachedResponse>();
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Look up a cached response by idempotency key.
 * Returns undefined if not found or expired.
 */
export function getCachedResponse(key: string): CachedResponse | undefined {
  const entry = cache.get(key);

  if (!entry) return undefined;

  // Clean up expired entries on access
  if (Date.now() - entry.createdAt > TTL_MS) {
    cache.delete(key);
    return undefined;
  }

  return entry;
}

/**
 * Store a response for later replay.
 */
export function cacheResponse(
  key: string,
  statusCode: number,
  body: unknown
): void {
  cache.set(key, {
    statusCode,
    body,
    createdAt: Date.now(),
  });
}
