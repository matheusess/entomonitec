import Dexie, { type EntityTable } from 'dexie';
import { VisitForm } from '@/types/visits';

interface SyncQueueRecord {
  id?: number;     // auto-increment PK
  visitId: string; // referencia visits.id
  createdAt: Date;
  retries: number;
}

/**
 * IndexedDB database para storage offline-first.
 * Substitui localStorage (limite ~5-10 MB) por IndexedDB (~50% do disco).
 *
 * Tabelas:
 *  - visits      → dados completos das visitas (incluindo fotos base64)
 *  - syncQueue   → fila de visitas pendentes de sincronização com Firebase
 */
const db = new Dexie('EntomonitecDB') as Dexie & {
  visits: EntityTable<VisitForm, 'id'>;
  syncQueue: EntityTable<SyncQueueRecord, 'id'>;
};

db.version(1).stores({
  visits: 'id, type, syncStatus, organizationId, agentId, neighborhood, createdAt',
  syncQueue: '++id, visitId, createdAt',
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
