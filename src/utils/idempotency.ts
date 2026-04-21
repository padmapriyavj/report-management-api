interface CachedResponse {
  statusCode: number;
  body: unknown;
  createdAt: number;
}

const cache = new Map<string, CachedResponse>();
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function getCachedResponse(key: string): CachedResponse | undefined {
  const entry = cache.get(key);

  if (!entry) return undefined;

  // Expired — clean up
  if (Date.now() - entry.createdAt > TTL_MS) {
    cache.delete(key);
    return undefined;
  }

  return entry;
}

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
