import {
  VisitForm,
  RoutineVisitForm,
  LIRAAVisitForm,
  CreateRoutineVisitRequest,
  CreateLIRAAVisitRequest,
  UpdateVisitRequest,
  VisitResponse,
  VisitsListResponse
} from '@/types/visits';
import { IUser } from '@/types/organization';
import { firebaseVisitsService } from './firebaseVisitsService';
import { db } from '@/lib/offlineDb';
import logger from '@/lib/logger';

class VisitsService {

  // Salvar visita localmente (offline) — IndexedDB via Dexie
  async saveVisitLocally(visit: VisitForm): Promise<void> {
    try {
      await db.visits.put(visit);
      await this.addToSyncQueue(visit.id);
      logger.log('Visita salva localmente (IndexedDB):', visit.id);
    } catch (error) {
      logger.error('Erro ao salvar visita localmente:', error);
      throw error;
    }
  }

  // Obter visitas salvas localmente
  async getLocalVisits(): Promise<VisitForm[]> {
    try {
      return await db.visits.orderBy('createdAt').reverse().toArray();
    } catch (error) {
      logger.error('Erro ao obter visitas locais:', error);
      return [];
    }
  }

  // Persistir visitas vindas do Firebase (upsert — preserva pendentes com IDs locais)
  async setFirebaseVisits(firebaseVisits: VisitForm[]): Promise<void> {
    try {
      if (firebaseVisits.length > 0) {
        await db.visits.bulkPut(firebaseVisits);
      }
    } catch (error) {
      logger.error('Erro ao persistir visitas do Firebase:', error);
    }
  }

  // Adicionar à fila de sincronização
  private async addToSyncQueue(visitId: string): Promise<void> {
    try {
      const existing = await db.syncQueue.where('visitId').equals(visitId).count();
      if (existing === 0) {
        await db.syncQueue.add({ visitId, createdAt: new Date(), retries: 0 });
      }
    } catch (error) {
      logger.error('Erro ao adicionar à fila de sincronização:', error);
    }
  }

  // Obter fila de sincronização (lista de IDs)
  async getSyncQueue(): Promise<string[]> {
    try {
      const records = await db.syncQueue.orderBy('createdAt').toArray();
      return records.map(r => r.visitId);
    } catch (error) {
      logger.error('Erro ao obter fila de sincronização:', error);
      return [];
    }
  }

  // Remover da fila de sincronização
  private async removeFromSyncQueue(visitId: string): Promise<void> {
    try {
      await db.syncQueue.where('visitId').equals(visitId).delete();
    } catch (error) {
      logger.error('Erro ao remover da fila de sincronização:', error);
    }
  }

  // Limpar todos os dados locais
  async clearLocalData(): Promise<void> {
    try {
      await db.visits.clear();
      await db.syncQueue.clear();
      logger.log('Dados locais limpos do IndexedDB');
    } catch (error) {
      logger.error('Erro ao limpar dados locais:', error);
    }
  }

  // Criar visita de rotina
  async createRoutineVisit(data: CreateRoutineVisitRequest, user: IUser): Promise<RoutineVisitForm> {
    const visit: RoutineVisitForm = {
      id: this.generateId(),
      type: 'routine',
      timestamp: new Date(),
      location: data.location,
      neighborhood: data.neighborhood,
      agentName: user.name,
      agentId: user.id,
      userId: user.id, // Campo necessário para as regras do Firebase
      organizationId: user.organizationId || '',
      observations: data.observations,
      photos: data.photos || [],
      status: 'completed',
      syncStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      breedingSites: data.breedingSites,
      larvaeFound: data.larvaeFound,
      pupaeFound: data.pupaeFound,
      controlMeasures: data.controlMeasures,
      calculatedRiskLevel: this.calculateRiskLevel(data.breedingSites, data.larvaeFound, data.pupaeFound)
    };

    await this.saveVisitLocally(visit);
    logger.log('✅ Visita de rotina criada:', visit.id);
    return visit;
  }

  // Criar visita LIRAa
  async createLIRAAVisit(data: CreateLIRAAVisitRequest, user: IUser): Promise<LIRAAVisitForm> {
    const visit: LIRAAVisitForm = {
      id: this.generateId(),
      type: 'liraa',
      timestamp: new Date(),
      location: data.location,
      neighborhood: data.neighborhood,
      agentName: user.name,
      agentId: user.id,
      userId: user.id, // Campo necessário para as regras do Firebase
      organizationId: user.organizationId || '',
      observations: data.observations,
      photos: data.photos || [],
      status: 'completed',
      syncStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      propertyType: data.propertyType,
      inspected: data.inspected,
      refused: data.refused,
      closed: data.closed,
      containers: data.containers,
      positiveContainers: data.positiveContainers,
      larvaeSpecies: data.larvaeSpecies,
      treatmentApplied: data.treatmentApplied,
      eliminationAction: data.eliminationAction,
      liraaIndex: this.calculateLIRAaIndex(data.containers, data.positiveContainers)
    };

    await this.saveVisitLocally(visit);
    return visit;
  }

  // Atualizar visita local (upsert no IndexedDB)
  private async updateLocalVisit(updatedVisit: VisitForm): Promise<void> {
    try {
      await db.visits.put(updatedVisit);
    } catch (error) {
      logger.error('Erro ao atualizar visita local:', error);
    }
  }

  // Atualizar visita
  async updateVisit(visitId: string, updates: UpdateVisitRequest): Promise<VisitForm | null> {
    try {
      const visit = await db.visits.get(visitId);

      if (!visit) {
        throw new Error('Visita não encontrada');
      }

      const updatedVisit = {
        ...visit,
        ...updates,
        updatedAt: new Date()
      };

      await db.visits.put(updatedVisit);
      await this.addToSyncQueue(visitId);

      return updatedVisit;
    } catch (error) {
      logger.error('Erro ao atualizar visita:', error);
      throw error;
    }
  }

  // Excluir visita
  async deleteVisit(visitId: string): Promise<void> {
    try {
      const visit = await db.visits.get(visitId);

      if (!visit) {
        throw new Error('Visita não encontrada');
      }

      // Se a visita já foi sincronizada com o Firebase, excluir também de lá
      if (visit.syncStatus === 'synced' && visit.firebaseId) {
        try {
          await firebaseVisitsService.deleteVisit(visit.firebaseId);
          logger.log('✅ Visita excluída do Firebase:', visit.firebaseId);
        } catch (firebaseError) {
          logger.warn('⚠️ Erro ao excluir do Firebase, mas continuando com exclusão local:', firebaseError);
        }
      }

      await db.visits.delete(visitId);
      await this.removeFromSyncQueue(visitId);

      logger.log('✅ Visita excluída localmente:', visitId);
    } catch (error) {
      logger.error('❌ Erro ao excluir visita:', error);
      throw error;
    }
  }

  // Sincronizar visitas com o Firebase
  async syncVisits(): Promise<{ success: boolean; synced: number; errors: number; message?: string }> {
    const queue = await this.getSyncQueue();
    let synced = 0;
    let errors = 0;

    if (queue.length === 0) {
      return { success: true, synced: 0, errors: 0, message: 'Nenhuma visita pendente para sincronizar' };
    }

    logger.log(`🔄 Sincronizando ${queue.length} visitas...`);

    for (const visitId of queue) {
      try {
        const visit = await db.visits.get(visitId);

        if (visit) {
          // Marcar como sincronizando
          await this.updateLocalVisit({ ...visit, syncStatus: 'syncing' });

          // Tentar salvar no Firebase
          const { id: firebaseId, photos: syncedPhotos } = await firebaseVisitsService.createVisit(visit);

          // Marcar como sincronizada
          await this.updateLocalVisit({
            ...visit,
            firebaseId,
            photos: syncedPhotos.length > 0 ? syncedPhotos : visit.photos,
            syncStatus: 'synced',
            updatedAt: new Date()
          });

          await this.removeFromSyncQueue(visitId);
          synced++;

          logger.log(`✅ Visita ${visitId} sincronizada com Firebase: ${firebaseId}`);
        }
      } catch (error) {
        logger.error(`❌ Erro ao sincronizar visita ${visitId}:`, error);

        const isPermissionError = error instanceof Error &&
          (error.message.includes('permission') || error.message.includes('Permission'));

        const visit = await db.visits.get(visitId);
        if (visit) {
          await this.updateLocalVisit({
            ...visit,
            syncStatus: 'error',
            syncError: isPermissionError
              ? 'Erro de permissão no Firebase. Verifique as regras de segurança.'
              : (error instanceof Error ? error.message : 'Erro desconhecido'),
            updatedAt: new Date()
          });
        }

        errors++;
      }
    }

    return { success: errors === 0, synced, errors };
  }

  // Calcular nível de risco para visitas de rotina
  private calculateRiskLevel(
    breedingSites: any,
    larvaeFound: boolean,
    pupaeFound: boolean
  ): 'low' | 'medium' | 'high' | 'critical' {
    let riskScore = 0;

    // Pontos por tipo de criadouro
    const breedingSiteScores = {
      waterReservoir: 3,
      tires: 2,
      bottles: 1,
      cans: 1,
      buckets: 2,
      plantPots: 1,
      gutters: 2,
      pools: 4,
      wells: 3,
      tanks: 2,
      drains: 1
    };

    // Calcular pontuação dos criadouros
    Object.entries(breedingSites).forEach(([key, value]) => {
      if (key !== 'others' && value && breedingSiteScores[key as keyof typeof breedingSiteScores]) {
        riskScore += breedingSiteScores[key as keyof typeof breedingSiteScores];
      }
    });

    // Pontos adicionais por presença de larvas/pupas
    if (larvaeFound) riskScore += 2;
    if (pupaeFound) riskScore += 3;

    // Classificar risco
    if (riskScore >= 8) return 'critical';
    if (riskScore >= 5) return 'high';
    if (riskScore >= 3) return 'medium';
    return 'low';
  }

  // Calcular índice LIRAa
  private calculateLIRAaIndex(
    containers: any,
    positiveContainers: any
  ): number {
    const totalContainers = Object.values(containers).reduce((sum: number, count: any) => sum + count, 0);
    const totalPositive = Object.values(positiveContainers).reduce((sum: number, count: any) => sum + count, 0);

    if (totalContainers === 0) return 0;

    return (totalPositive / totalContainers) * 100;
  }

  // Gerar ID único
  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // Tentar sincronizar uma visita específica que falhou
  async retrySyncVisit(visitId: string): Promise<boolean> {
    try {
      const visit = await db.visits.get(visitId);

      if (!visit) {
        throw new Error('Visita não encontrada');
      }

      const isConnected = await firebaseVisitsService.checkConnectivity();
      if (!isConnected) {
        throw new Error('Sem conexão com o servidor');
      }

      await this.updateLocalVisit({ ...visit, syncStatus: 'syncing' });

      const { id: firebaseId, photos: syncedPhotos } = await firebaseVisitsService.createVisit(visit);

      await this.updateLocalVisit({
        ...visit,
        firebaseId,
        photos: syncedPhotos.length > 0 ? syncedPhotos : visit.photos,
        syncStatus: 'synced',
        syncError: undefined,
        updatedAt: new Date()
      });

      await this.removeFromSyncQueue(visitId);

      logger.log(`✅ Visita ${visitId} re-sincronizada com sucesso: ${firebaseId}`);
      return true;
    } catch (error) {
      logger.error(`❌ Erro ao re-sincronizar visita ${visitId}:`, error);

      const visit = await db.visits.get(visitId);
      if (visit) {
        await this.updateLocalVisit({
          ...visit,
          syncStatus: 'error',
          syncError: error instanceof Error ? error.message : 'Erro desconhecido',
          updatedAt: new Date()
        });
      }

      return false;
    }
  }
}

export const visitsService = new VisitsService();
