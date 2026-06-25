// A tiny in-memory snapshot cache for the API routes: rebuild via load() at most
// once per ttlMs, otherwise hand back the last value. Keeps polling clients from
// triggering a rebuild on every request.
export function cachedSnapshot<T>(
  ttlMs: number,
  load: () => Promise<T>,
): () => Promise<T> {
  let snapshot: { at: number; data: T } | null = null;
  return async () => {
    if (!snapshot || Date.now() - snapshot.at > ttlMs)
      snapshot = { at: Date.now(), data: await load() };
    return snapshot.data;
  };
}
