/**
 * Offline-first Firebase wrapper.
 *
 * Provides two building-block utilities consumed by every Firebase service:
 *
 *  - withOfflineRead<T>(key, onlineFn, opts?)
 *      Online  → call onlineFn(), cache result, return result.
 *      Offline → return cached result (or throw if no cache and throwOnMiss === true).
 *
 *  - withOfflineWrite(op, onlineFn)
 *      Online  → call onlineFn(), return result.
 *      Offline → save op to pendingWrites queue, apply optimistic update to
 *                cachedData when a cacheKey is supplied, return undefined.
 *
 *  - processSyncQueue()
 *      Replays every pending write against Firebase.
 *      Called automatically when connectivity is restored via connectivityChange events.
 *
 * Connectivity detection:
 *  Combines navigator.onLine (synchronous, sometimes wrong) with `online`/`offline`
 *  DOM events kept in an in-memory flag.  Subscribe with onConnectivityChange().
 */

import {
  collection as fsCollection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db as firestoreDb } from '@/lib/firebase';
import { db as localDb, PendingWriteRecord, PendingWriteType } from '@/lib/offlineDb';
import logger from '@/lib/logger';

// ---------------------------------------------------------------------------
// Connectivity state
// ---------------------------------------------------------------------------

let _onlineFlag: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
const _listeners = new Set<(online: boolean) => void>();

function _notify(online: boolean) {
  _onlineFlag = online;
  _listeners.forEach(fn => fn(online));
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => _notify(true));
  window.addEventListener('offline', () => _notify(false));
}

/** Returns true when the browser believes it has network connectivity. */
export function isOnline(): boolean {
  return _onlineFlag;
}

/**
 * Subscribe to connectivity changes.
 * Returns an unsubscribe function.
 */
export function onConnectivityChange(fn: (online: boolean) => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

// ---------------------------------------------------------------------------
// Read wrapper
// ---------------------------------------------------------------------------

export interface ReadOptions {
  /** If provided and cache is older than ttlMs, the cache is considered stale and
   *  onlineFn is called even when online (fresh fetch replaces the cache). */
  ttlMs?: number;
  /** When offline and no cache exists: throw (true) or return null (false, default). */
  throwOnMiss?: boolean;
}

/**
 * Executes a Firebase read when online, caching the result in IndexedDB.
 * Falls back to the cached value when offline.
 */
export async function withOfflineRead<T>(
  cacheKey: string,
  collectionName: string,
  onlineFn: () => Promise<T>,
  options: ReadOptions = {},
): Promise<T> {
  const { ttlMs, throwOnMiss = false } = options;

  // Attempt online path
  if (_onlineFlag) {
    try {
      const result = await onlineFn();
      // Cache the result
      await localDb.cachedData.put({
        key: cacheKey,
        collection: collectionName,
        data: JSON.stringify(result),
        updatedAt: new Date(),
      });
      return result;
    } catch (err) {
      logger.warn(`[firebaseWrapper] Online read failed for "${cacheKey}", falling back to cache:`, err);
      // Fall through to cache
    }
  }

  // Offline (or online-read failed) — try cache
  const cached = await localDb.cachedData.get(cacheKey);
  if (cached) {
    const age = Date.now() - cached.updatedAt.getTime();
    if (!ttlMs || age < ttlMs) {
      logger.log(`[firebaseWrapper] Serving "${cacheKey}" from cache (age: ${Math.round(age / 1000)}s)`);
      return JSON.parse(cached.data) as T;
    }
  }

  if (throwOnMiss) {
    throw new Error(`[firebaseWrapper] Offline and no cache for "${cacheKey}"`);
  }

  // Return sensible empty defaults depending on expected type
  // Callers using this pattern should handle empty arrays/nulls gracefully
  return ([] as unknown) as T;
}

// ---------------------------------------------------------------------------
// Write wrapper
// ---------------------------------------------------------------------------

export interface PendingOperation {
  type: PendingWriteType;
  collection: string;
  /** Firestore document ID — required for 'update' and 'delete'. */
  docId?: string;
  /** Temporary local ID used while the document hasn't been persisted yet. */
  localId?: string;
  /** The payload to write. */
  data?: Record<string, unknown>;
  /**
   * When set, the pending operation will also patch the corresponding
   * cachedData entry optimistically so UI can reflect the change offline.
   */
  cacheKey?: string;
}

/**
 * Executes a Firebase write when online.
 * When offline, queues the operation in IndexedDB for later replay.
 * Optionally applies an optimistic patch to the read cache.
 */
export async function withOfflineWrite<T = unknown>(
  op: PendingOperation,
  onlineFn: () => Promise<T>,
): Promise<T | undefined> {
  if (_onlineFlag) {
    try {
      return await onlineFn();
    } catch (err) {
      logger.error(`[firebaseWrapper] Online write failed for "${op.collection}/${op.docId ?? 'new'}":`, err);
      throw err;
    }
  }

  // Offline — enqueue for later
  await localDb.pendingWrites.add({
    type: op.type,
    collection: op.collection,
    docId: op.docId,
    localId: op.localId,
    data: op.data ? JSON.stringify(op.data) : undefined,
    createdAt: new Date(),
    status: 'pending',
    retries: 0,
  });

  logger.log(`[firebaseWrapper] Queued offline ${op.type} on "${op.collection}"${op.docId ? `/${op.docId}` : ''}`);

  // Optimistic cache update for reads that depend on this collection
  if (op.cacheKey && (op.type === 'add' || op.type === 'update') && op.data) {
    try {
      const cached = await localDb.cachedData.get(op.cacheKey);
      if (cached) {
        const existing: unknown[] = JSON.parse(cached.data);
        let updated: unknown[];
        if (op.type === 'add') {
          updated = [op.data, ...existing];
        } else {
          updated = existing.map((item: any) =>
            item.id === op.docId ? { ...item, ...op.data } : item,
          );
        }
        await localDb.cachedData.put({
          ...cached,
          data: JSON.stringify(updated),
          updatedAt: new Date(),
        });
      }
    } catch (cacheErr) {
      logger.warn('[firebaseWrapper] Optimistic cache update failed (non-critical):', cacheErr);
    }
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Sync engine
// ---------------------------------------------------------------------------

const MAX_RETRIES = 5;
let _syncInProgress = false;

/**
 * Replays all pending writes against Firebase in insertion order.
 * Should be called when connectivity is restored.
 */
export async function processSyncQueue(): Promise<{ synced: number; errors: number }> {
  if (_syncInProgress) {
    logger.log('[firebaseWrapper] Sync already in progress, skipping');
    return { synced: 0, errors: 0 };
  }

  const pendingItems = await localDb.pendingWrites
    .where('status')
    .anyOf('pending', 'error')
    .sortBy('createdAt');

  if (pendingItems.length === 0) {
    return { synced: 0, errors: 0 };
  }

  _syncInProgress = true;
  logger.log(`[firebaseWrapper] Processing ${pendingItems.length} pending write(s)...`);

  let synced = 0;
  let errors = 0;

  for (const item of pendingItems) {
    if ((item.retries ?? 0) >= MAX_RETRIES) {
      logger.warn(`[firebaseWrapper] Skipping ${item.collection}/${item.docId ?? item.localId} — max retries reached`);
      continue;
    }

    // Mark as syncing
    await localDb.pendingWrites.update(item.id!, { status: 'syncing' });

    try {
      const payload = item.data ? JSON.parse(item.data) : {};

      switch (item.type) {
        case 'add': {
          const colRef = fsCollection(firestoreDb, item.collection);
          await addDoc(colRef, payload);
          break;
        }
        case 'update': {
          if (!item.docId) throw new Error('docId required for update');
          const docRef = doc(firestoreDb, item.collection, item.docId);
          await updateDoc(docRef, payload);
          break;
        }
        case 'delete': {
          if (!item.docId) throw new Error('docId required for delete');
          const docRef = doc(firestoreDb, item.collection, item.docId);
          await deleteDoc(docRef);
          break;
        }
      }

      await localDb.pendingWrites.delete(item.id!);
      synced++;
      logger.log(`[firebaseWrapper] ✅ Synced ${item.type} on "${item.collection}"${item.docId ? `/${item.docId}` : ''}`);
    } catch (err) {
      const retries = (item.retries ?? 0) + 1;
      await localDb.pendingWrites.update(item.id!, {
        status: 'error',
        retries,
        error: err instanceof Error ? err.message : String(err),
      });
      errors++;
      logger.error(`[firebaseWrapper] ❌ Failed ${item.type} on "${item.collection}" (retry ${retries}/${MAX_RETRIES}):`, err);
    }
  }

  _syncInProgress = false;
  logger.log(`[firebaseWrapper] Sync complete — synced: ${synced}, errors: ${errors}`);
  return { synced, errors };
}

// ---------------------------------------------------------------------------
// Cache management helpers
// ---------------------------------------------------------------------------

/** Removes all cached read results, optionally scoped to a collection. */
export async function clearCache(collectionName?: string): Promise<void> {
  if (collectionName) {
    await localDb.cachedData.where('collection').equals(collectionName).delete();
  } else {
    await localDb.cachedData.clear();
  }
}

/** Invalidates (removes) a single cached entry by key. */
export async function invalidateCache(cacheKey: string): Promise<void> {
  await localDb.cachedData.delete(cacheKey);
}

/** Returns the number of operations currently in the pending writes queue. */
export async function getPendingCount(): Promise<number> {
  return localDb.pendingWrites.where('status').anyOf('pending', 'error').count();
}
