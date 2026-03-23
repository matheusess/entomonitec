/**
 * useOnlineSync
 *
 * Global hook that:
 *  - Tracks online / offline state reactively.
 *  - On reconnection fires processSyncQueue() (generic write queue),
 *    visitsService.syncVisits() (legacy visits-specific queue), AND
 *    ovitrapService.syncPendingOvitraps() (ovitraps queue).
 *  - Also polls every 60 seconds as a safety net (navigator.onLine can lie).
 *
 * Mount once in the root layout / provider.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { onConnectivityChange, processSyncQueue, getPendingCount } from '@/lib/firebaseWrapper';
import { visitsService } from '@/services/visitsService';
import { ovitrapService } from '@/services/ovitrapService';
import { contaOvosService } from '@/services/contaOvosService';
import logger from '@/lib/logger';

const POLL_INTERVAL_MS = 60_000;

export interface OnlineSyncState {
  isOnline: boolean;
  pendingCount: number;
  lastSyncAt: Date | null;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
}

export function useOnlineSync(): OnlineSyncState {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const prevOnlineRef = useRef(isOnline);

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {
      // Non-critical
    }
  }, []);

  const runSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      logger.log('[useOnlineSync] Running sync...');

      const [wrapperResult, visitsResult, ovitrapsResult, contaOvosResult] = await Promise.allSettled([
        processSyncQueue(),
        visitsService.syncVisits(),
        ovitrapService.syncPendingOvitraps(),
        contaOvosService.syncPendingContaOvos(),
      ]);

      if (wrapperResult.status === 'fulfilled') {
        const { synced, errors } = wrapperResult.value;
        if (synced > 0 || errors > 0) {
          logger.log(`[useOnlineSync] Generic queue — synced: ${synced}, errors: ${errors}`);
        }
      }

      if (visitsResult.status === 'fulfilled') {
        const { synced, errors } = visitsResult.value;
        if (synced > 0 || errors > 0) {
          logger.log(`[useOnlineSync] Visits queue — synced: ${synced}, errors: ${errors}`);
        }
      }

      if (ovitrapsResult.status === 'fulfilled') {
        const { synced, errors } = ovitrapsResult.value;
        if (synced > 0 || errors > 0) {
          logger.log(`[useOnlineSync] Ovitraps queue — synced: ${synced}, errors: ${errors}`);
        }
      }

      if (contaOvosResult.status === 'fulfilled') {
        const { synced, errors } = contaOvosResult.value;
        if (synced > 0 || errors > 0) {
          logger.log(`[useOnlineSync] Conta Ovos queue — synced: ${synced}, errors: ${errors}`);
        }
      }

      setLastSyncAt(new Date());
    } catch (err) {
      logger.error('[useOnlineSync] Sync error:', err);
    } finally {
      setIsSyncing(false);
      await refreshPendingCount();
    }
  }, [isSyncing, refreshPendingCount]);

  // Subscribe to connectivity changes from the wrapper
  useEffect(() => {
    const unsub = onConnectivityChange(async (online) => {
      setIsOnline(online);

      if (online && !prevOnlineRef.current) {
        // Went from offline → online: trigger sync
        logger.log('[useOnlineSync] Back online — triggering sync');
        await runSync();
      }

      prevOnlineRef.current = online;
    });

    return unsub;
  }, [runSync]);

  // Periodic safety-net poll
  useEffect(() => {
    refreshPendingCount();

    const interval = setInterval(async () => {
      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
      setIsOnline(online);

      if (online) {
        const count = await getPendingCount();
        setPendingCount(count);
        if (count > 0) {
          await runSync();
        }
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [refreshPendingCount, runSync]);

  return {
    isOnline,
    pendingCount,
    lastSyncAt,
    isSyncing,
    syncNow: runSync,
  };
}
