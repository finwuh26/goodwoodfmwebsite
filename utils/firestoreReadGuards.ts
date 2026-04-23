import type { QuerySnapshot } from '../realtimeFirestoreCompat';

export const FIRESTORE_MIN_READ_INTERVAL_MS = 10_000;

type CacheEntry<T> = {
  value: T;
  cachedAt: number;
};

const readCache = new Map<string, CacheEntry<unknown>>();
const inFlightReads = new Map<string, Promise<unknown>>();
const lastNetworkReadAt = new Map<string, number>();

interface GuardOptions {
  ttlMs?: number;
}

/**
 * Guards Firestore reads with:
 * 1) a hard minimum 10s network-read interval per key
 * 2) a 10s in-memory cache so bursty repeat calls do not hit Firestore
 * 3) in-flight dedupe so concurrent callers share one request
 */
export const readFirestoreWithGuard = async <T>(
  key: string,
  reader: () => Promise<T>,
  options: GuardOptions = {}
): Promise<T> => {
  const ttlMs = Math.max(FIRESTORE_MIN_READ_INTERVAL_MS, options.ttlMs ?? FIRESTORE_MIN_READ_INTERVAL_MS);
  const now = Date.now();
  const cached = readCache.get(key) as CacheEntry<T> | undefined;

  if (cached && now - cached.cachedAt < ttlMs) {
    return cached.value;
  }

  const activeRead = inFlightReads.get(key) as Promise<T> | undefined;
  if (activeRead) {
    return activeRead;
  }

  const lastRead = lastNetworkReadAt.get(key) ?? 0;
  if (now - lastRead < FIRESTORE_MIN_READ_INTERVAL_MS) {
    if (cached) return cached.value;
    throw new Error(`Firestore read throttled for key "${key}"`);
  }

  lastNetworkReadAt.set(key, now);

  const readPromise = reader()
    .then((value) => {
      readCache.set(key, { value, cachedAt: Date.now() });
      return value;
    })
    .catch((error) => {
      if (cached) {
        console.warn(`Firestore read failed for key "${key}", serving cached value.`, error);
        return cached.value;
      }
      throw error;
    })
    .finally(() => {
      inFlightReads.delete(key);
    });

  inFlightReads.set(key, readPromise);
  return readPromise;
};

/**
 * Allows real-time listeners (onSnapshot) to keep cache warm so remounts
 * and rapid re-renders can reuse cached data instead of re-reading Firestore.
 */
export const seedFirestoreReadCache = <T>(key: string, value: T): void => {
  readCache.set(key, { value, cachedAt: Date.now() });
};

export const makeLikeReadKey = (userId: string, songTitle: string, songArtist: string): string =>
  `likes:${userId}:${songTitle.toLowerCase().trim()}:${songArtist.toLowerCase().trim()}`;

export type FirestoreQuerySnapshot = QuerySnapshot;
