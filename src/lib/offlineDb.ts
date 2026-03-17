import Dexie, { type EntityTable } from 'dexie';
import { VisitForm } from '@/types/visits';

interface SyncQueueRecord {
  id?: number;     // auto-increment PK
  visitId: string; // referencia visits.id
  createdAt: Date;
  retries: number;
}

/** Resultado de uma query Firebase cacheada localmente */
export interface CachedDataRecord {
  key: string;       // cache key único (PK)
  collection: string;
  data: string;      // JSON serializado do resultado
  updatedAt: Date;
}

/** Tipo de operação de escrita pendente */
export type PendingWriteType = 'add' | 'update' | 'delete';

/** Status de uma operação pendente */
export type PendingWriteStatus = 'pending' | 'syncing' | 'error';

/** Operação de escrita enfileirada para sync posterior */
export interface PendingWriteRecord {
  id?: number;                   // auto-increment PK
  type: PendingWriteType;
  collection: string;
  docId?: string;                // undefined em 'add' (Firebase gera o ID)
  localId?: string;              // ID local temporário para operações 'add'
  data?: string;                 // JSON serializado do payload
  createdAt: Date;
  status: PendingWriteStatus;
  retries: number;
  error?: string;
}

/**
 * IndexedDB database para storage offline-first.
 * Substitui localStorage (limite ~5-10 MB) por IndexedDB (~50% do disco).
 *
 * Tabelas:
 *  - visits        → dados completos das visitas (incluindo fotos base64)
 *  - syncQueue     → fila de visitas pendentes de sincronização com Firebase
 *  - cachedData    → resultados de queries Firebase cacheados para leitura offline
 *  - pendingWrites → operações de escrita genéricas enfileiradas para sync
 */
const db = new Dexie('EntomonitecDB') as Dexie & {
  visits: EntityTable<VisitForm, 'id'>;
  syncQueue: EntityTable<SyncQueueRecord, 'id'>;
  cachedData: EntityTable<CachedDataRecord, 'key'>;
  pendingWrites: EntityTable<PendingWriteRecord, 'id'>;
};

db.version(1).stores({
  visits: 'id, type, syncStatus, organizationId, agentId, neighborhood, createdAt',
  syncQueue: '++id, visitId, createdAt',
});

// v2: adiciona tabelas para cache genérico e fila de escrita genérica
db.version(2).stores({
  visits: 'id, type, syncStatus, organizationId, agentId, neighborhood, createdAt',
  syncQueue: '++id, visitId, createdAt',
  cachedData: 'key, collection, updatedAt',
  pendingWrites: '++id, collection, status, createdAt',
});

/**
 * Migração única: localStorage → IndexedDB.
 * Executa apenas na primeira abertura do DB (quando visits está vazio).
 * Remove as chaves antigas do localStorage após confirmar a migração.
 */
db.on('ready', async () => {
  try {
    if (typeof window === 'undefined') return;

    const count = await db.visits.count();
    if (count > 0) return; // Já tem dados — não migrar novamente

    const storedVisits = localStorage.getItem('entomonitec_visits');
    if (!storedVisits) return;

    const visits: VisitForm[] = JSON.parse(storedVisits);
    if (visits.length === 0) return;

    await db.visits.bulkAdd(visits);

    const storedQueue = localStorage.getItem('entomonitec_sync_queue');
    if (storedQueue) {
      const queueIds: string[] = JSON.parse(storedQueue);
      if (queueIds.length > 0) {
        const queueRecords = queueIds.map((visitId) => ({
          visitId,
          createdAt: new Date(),
          retries: 0,
        }));
        await db.syncQueue.bulkAdd(queueRecords);
      }
    }

    // Limpar localStorage após migração bem-sucedida
    localStorage.removeItem('entomonitec_visits');
    localStorage.removeItem('entomonitec_sync_queue');

    console.log(`[offlineDb] Migração concluída: ${visits.length} visitas movidas para IndexedDB`);
  } catch (error) {
    // Não lança — migração silenciosa; dados do localStorage permanecem como fallback
    console.error('[offlineDb] Erro na migração do localStorage:', error);
  }
});

export { db };
export type { SyncQueueRecord };
