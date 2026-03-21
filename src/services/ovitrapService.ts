import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db as firebaseDb } from '@/lib/firebase';
import { withOfflineRead, withOfflineWrite } from '@/lib/firebaseWrapper';
import logger from '@/lib/logger';
import { db as localDb } from '@/lib/offlineDb';
import {
  IOvitrap,
  CreateOvitrapRequest,
  UpdateOvitrapRequest,
} from '@/types/ovitrap';

class OvitrapService {
  private readonly COLLECTION_NAME = 'ovitraps';

  private generateLocalId(): string {
    return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async createOvitrap(data: CreateOvitrapRequest): Promise<IOvitrap> {
    const localId = this.generateLocalId();
    const now = new Date();

    // Criar objeto da ovitrampa
    const ovitrapData: IOvitrap = {
      id: localId,
      nome: data.nome || '',
      codigo: data.codigo || '',
      endereco: data.endereco || '',
      organizationId: data.organizationId,
      createdBy: data.createdBy,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      // Campos Conta Ovos (opcionais)
      ...(data.contaOvosGroupId !== undefined && { contaOvosGroupId: data.contaOvosGroupId }),
      ...(data.lat !== undefined && { lat: data.lat }),
      ...(data.lng !== undefined && { lng: data.lng }),
      ...(data.district && { district: data.district }),
      ...(data.street && { street: data.street }),
      ...(data.addressNumber && { addressNumber: data.addressNumber }),
      ...(data.complement && { complement: data.complement }),
      ...(data.sector && { sector: data.sector }),
      ...(data.responsable && { responsable: data.responsable }),
      ...(data.blockId && { blockId: data.blockId }),
      source: 'local' as const,
    };

    // Tentar salvar no Firebase
    const result = await withOfflineWrite(
      {
        type: 'add',
        collection: this.COLLECTION_NAME,
        localId,
        data: data as unknown as Record<string, unknown>,
        cacheKey: `ovitraps_org_${data.organizationId}`,
      },
      async () => {
        const docData = {
          ...data,
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        const docRef = await addDoc(collection(firebaseDb, this.COLLECTION_NAME), docData);
        logger.log('✅ Ovitrap criada no Firebase:', docRef.id);

        // Retornar objeto com ID gerado pelo Firebase
        return {
          ...ovitrapData,
          id: docRef.id,
        };
      },
    );

    // Se online e salvou com sucesso, retornar resultado
    if (result) {
      return result;
    }

    // Se offline, armazenar localmente e retornar com ID local
    logger.log('📱 Ovitrap armazenada localmente (offline):', localId);

    // Atualizar cache da lista de ovitraps
    try {
      const cacheKey = `ovitraps_org_${data.organizationId}`;
      const cached = await localDb.cachedData.get(cacheKey);
      if (cached) {
        const existing: IOvitrap[] = JSON.parse(cached.data);
        const updated = [ovitrapData, ...existing];
        await localDb.cachedData.put({
          ...cached,
          data: JSON.stringify(updated),
          updatedAt: now,
        });
      }
    } catch (cacheErr) {
      logger.warn('Erro ao atualizar cache local de ovitraps:', cacheErr);
    }

    return ovitrapData;
  }

  async getOvitraps(organizationId: string): Promise<IOvitrap[]> {
    const cacheKey = `ovitraps_org_${organizationId}`;

    // Tentar obter do cache e do Firebase
    const result = await withOfflineRead<IOvitrap[]>(
      cacheKey,
      this.COLLECTION_NAME,
      async () => {
        const q = query(
          collection(firebaseDb, this.COLLECTION_NAME),
          where('organizationId', '==', organizationId)
          // Removido orderBy - vai ordenar no JavaScript
        );
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as IOvitrap));
        // Ordenar por createdAt decrescente no JavaScript
        return docs.sort((a, b) => {
          const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt as any).getTime();
          const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt as any).getTime();
          return dateB - dateA;
        });
      },
    );

    const remoteOvitraps = result ?? [];

    // Buscar ovitraps criadas localmente (pendentes de sincronização)
    try {
      const pendingOps = await localDb.pendingWrites
        .where('collection')
        .equals(this.COLLECTION_NAME)
        .toArray();

      const localOvitraps: IOvitrap[] = pendingOps
        .filter(op => op.type === 'add' && op.data && op.localId)
        .map(op => {
          const data = JSON.parse(op.data!);
          return {
            id: op.localId!,
            nome: data.nome || '',
            codigo: data.codigo || '',
            endereco: data.endereco || '',
            organizationId: data.organizationId,
            createdBy: data.createdBy,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as IOvitrap;
        });

      // Combinar: ovitraps locais primeiro (mais recentes), depois remotas
      const combined = [...localOvitraps, ...remoteOvitraps];

      // Remover duplicatas (manter a local se existir ambas)
      const deduplicated = Array.from(
        new Map(combined.map(item => [item.id, item])).values()
      );

      logger.log(`🔍 Ovitraps carregadas: ${localOvitraps.length} locais + ${remoteOvitraps.length} remotas = ${deduplicated.length} total`);
      return deduplicated;
    } catch (error) {
      logger.warn('Erro ao buscar ovitraps locais, usando apenas remotas:', error);
      return remoteOvitraps;
    }
  }

  // Limpar cache de ovitraps para forçar recarga
  async clearOvitrapsCache(organizationId: string): Promise<void> {
    try {
      const cacheKey = `ovitraps_org_${organizationId}`;
      await localDb.cachedData.delete(cacheKey);
      logger.log('🧹 Cache de ovitraps limpo');
    } catch (error) {
      logger.warn('Erro ao limpar cache de ovitraps:', error);
    }
  }

  async getOvitrapById(id: string): Promise<IOvitrap | null> {
    try {
      const docRef = doc(firebaseDb, this.COLLECTION_NAME, id);
      const snapshot = await getDoc(docRef);
      if (!snapshot.exists()) return null;
      return { id: snapshot.id, ...snapshot.data() } as IOvitrap;
    } catch (error) {
      logger.error('Erro ao buscar ovitrap:', error);
      return null;
    }
  }

  // Sincronizar ovitraps pendentes (criadas offline) com Firebase
  async syncPendingOvitraps(): Promise<{ synced: number; errors: number }> {
    try {
      const pendingOps = await localDb.pendingWrites
        .where('collection')
        .equals(this.COLLECTION_NAME)
        .toArray();

      if (pendingOps.length === 0) {
        logger.log('✅ Nenhuma ovitrampa pendente para sincronizar');
        return { synced: 0, errors: 0 };
      }

      logger.log(`🔄 Sincronizando ${pendingOps.length} ovitrampa(s)...`);

      let synced = 0;
      let errors = 0;

      for (const op of pendingOps) {
        if (op.type !== 'add' || !op.data) continue;

        try {
          const data = JSON.parse(op.data);
          const docData = {
            ...data,
            isActive: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };

          const docRef = await addDoc(collection(firebaseDb, this.COLLECTION_NAME), docData);
          logger.log('✅ Ovitrampa sincronizada com Firebase:', docRef.id);

          // Remover da fila de pendentes
          if (op.id) {
            await localDb.pendingWrites.delete(op.id);
          }

          // Atualizar cache com o novo ID do Firebase
          if (data.organizationId) {
            const cacheKey = `ovitraps_org_${data.organizationId}`;
            const cached = await localDb.cachedData.get(cacheKey);
            if (cached) {
              const existing: IOvitrap[] = JSON.parse(cached.data);
              const updated = existing
                .filter(item => item.id !== op.localId)
                .concat({
                  id: docRef.id,
                  nome: data.nome || '',
                  codigo: data.codigo || '',
                  endereco: data.endereco || '',
                  organizationId: data.organizationId,
                  createdBy: data.createdBy,
                  isActive: true,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
              await localDb.cachedData.put({
                ...cached,
                data: JSON.stringify(updated),
                updatedAt: new Date(),
              });
            }
          }

          synced++;
        } catch (error) {
          logger.error('❌ Erro ao sincronizar ovitrampa:', error);
          errors++;

          // Atualizar status para erro
          if (op.id) {
            await localDb.pendingWrites.update(op.id, {
              status: 'error',
              error: error instanceof Error ? error.message : 'Erro desconhecido',
            });
          }
        }
      }

      logger.log(`📊 Sincronização de ovitraps concluída: ${synced} sincronizadas, ${errors} com erro`);

      // Limpar cache para forçar recarga após sincronização
      if (synced > 0) {
        try {
          const firstOp = await localDb.pendingWrites.get(1);
          if (firstOp?.data) {
            const sampleData = JSON.parse(firstOp.data);
            if (sampleData.organizationId) {
              await this.clearOvitrapsCache(sampleData.organizationId);
            }
          }
        } catch (error) {
          logger.warn('Erro ao limpar cache após sincronização:', error);
        }
      }

      return { synced, errors };
    } catch (error) {
      logger.error('Erro ao sincronizar ovitraps pendentes:', error);
      return { synced: 0, errors: 0 };
    }
  }

  async updateOvitrap(id: string, data: UpdateOvitrapRequest): Promise<void> {
    await withOfflineWrite(
      {
        type: 'update',
        collection: this.COLLECTION_NAME,
        docId: id,
        data: data as unknown as Record<string, unknown>,
      },
      async () => {
        const docRef = doc(firebaseDb, this.COLLECTION_NAME, id);
        await updateDoc(docRef, {
          ...data,
          updatedAt: serverTimestamp(),
        });
        logger.log('✅ Ovitrap atualizada:', id);
      },
    );
  }

  async deleteOvitrap(id: string): Promise<void> {
    await withOfflineWrite(
      {
        type: 'delete',
        collection: this.COLLECTION_NAME,
        docId: id,
      },
      async () => {
        const docRef = doc(firebaseDb, this.COLLECTION_NAME, id);
        await deleteDoc(docRef);
        logger.log('✅ Ovitrampa removida:', id);
      },
    );
  }
}

export const ovitrapService = new OvitrapService();
