import { useState, useEffect, useCallback } from 'react';
import { visitsService } from '@/services/visitsService';
import { firebaseVisitsService } from '@/services/firebaseVisitsService';
import { VisitForm, RoutineVisitForm, LIRAAVisitForm } from '@/types/visits';
import { useAuth } from '@/components/AuthContext';
import logger from '@/lib/logger';

export function useVisits() {
  const { user } = useAuth();
  const [visits, setVisits] = useState<VisitForm[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carregar visitas do localStorage E do Firebase
  const loadVisits = useCallback(async () => {
    try {
      setIsLoading(true);

      logger.log('🌍 AMBIENTE:', {
        hostname: typeof window !== 'undefined' ? window.location.hostname : 'server',
        isLocal: typeof window !== 'undefined' ? window.location.hostname.includes('localhost') : false,
        userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'server'
      });

      // Primeiro: carregar do IndexedDB (Dexie)
      const localVisits = await visitsService.getLocalVisits();
      logger.log('📱 Visitas locais carregadas:', localVisits.length);

      // Segundo: tentar carregar do Firebase se usuário autenticado
      if (user?.organizationId) {
        try {
          logger.log('🔥 Buscando visitas do Firebase para organização:', user.organizationId);
          const firebaseVisits = await firebaseVisitsService.getVisitsByOrganization(user.organizationId);
          logger.log('🔥 Visitas do Firebase carregadas:', firebaseVisits.length);

          // LÓGICA: Se tem visitas do Firebase, limpar LocalStorage e usar só Firebase
          if (firebaseVisits.length > 0) {
            logger.log('🧹 Limpando LocalStorage e carregando só do Firebase');

            // Filtrar apenas visitas locais que NÃO estão sincronizadas (pending)
            const pendingLocalVisits = localVisits.filter(visit => visit.syncStatus === 'pending');
            logger.log('📱 Visitas locais pendentes (mantendo):', pendingLocalVisits.length);

            // Marcar todas as visitas do Firebase como sincronizadas
            const syncedFirebaseVisits: VisitForm[] = firebaseVisits.map(fbVisit => ({
              ...fbVisit,
              syncStatus: 'synced' as const,
              firebaseId: fbVisit.id,
              id: fbVisit.id
            }));

            // Persistir visitas do Firebase no IndexedDB (preserva pendentes com IDs locais)
            await visitsService.setFirebaseVisits(syncedFirebaseVisits);

            // Remover duplicatas: filtra visitas do Firebase que têm IDs pendentes locais
            const pendingIds = new Set(pendingLocalVisits.map(v => v.id));
            const uniqueFirebaseVisits = syncedFirebaseVisits.filter(fbVisit => !pendingIds.has(fbVisit.id));

            const allVisits = [...pendingLocalVisits, ...uniqueFirebaseVisits];
            logger.log('✅ Total de visitas:', allVisits.length, '(pendentes:', pendingLocalVisits.length, '+ firebase:', uniqueFirebaseVisits.length, ')');
            setVisits(allVisits);
          } else {
            // Se não tem visitas no Firebase, usar só as locais
            logger.log('📱 Nenhuma visita no Firebase, usando apenas dados locais');
            setVisits(localVisits);
          }
        } catch (firebaseError) {
          logger.warn('⚠️ Erro ao carregar do Firebase, usando apenas dados locais:', firebaseError);
          setVisits(localVisits);
        }
      } else {
        logger.log('👤 Usuário não autenticado, usando apenas dados locais');
        setVisits(localVisits);
      }

      setError(null);
    } catch (err) {
      setError('Erro ao carregar visitas');
      logger.error('Erro ao carregar visitas:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Sincronizar visitas com o servidor
  const syncVisits = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await visitsService.syncVisits();

      if (result.success) {
        // Recarregar visitas após sincronização
        loadVisits();
        return {
          success: true,
          synced: result.synced,
          errors: result.errors,
          message: result.message
        };
      } else {
        return {
          success: false,
          synced: result.synced,
          errors: result.errors,
          message: result.message
        };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro na sincronização';
      setError(errorMessage);
      logger.error('Erro na sincronização:', err);
      return {
        success: false,
        synced: 0,
        errors: 1,
        message: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  }, [loadVisits]);

  // Excluir visita
  const deleteVisit = useCallback(async (visitId: string) => {
    try {
      await visitsService.deleteVisit(visitId);
      loadVisits(); // Recarregar lista
      setError(null);
      return true;
    } catch (err) {
      setError('Erro ao excluir visita');
      logger.error('Erro ao excluir visita:', err);
      return false;
    }
  }, [loadVisits]);

  // Atualizar visita
  const updateVisit = useCallback(async (visitId: string, updates: any) => {
    try {
      const updatedVisit = await visitsService.updateVisit(visitId, updates);
      if (updatedVisit) {
        loadVisits(); // Recarregar lista
        setError(null);
        return updatedVisit;
      }
      return null;
    } catch (err) {
      setError('Erro ao atualizar visita');
      logger.error('Erro ao atualizar visita:', err);
      return null;
    }
  }, [loadVisits]);

  // Obter estatísticas (computado do estado atual — reativo)
  const getStats = useCallback(() => ({
    total: visits.length,
    routine: visits.filter(v => v.type === 'routine').length,
    liraa: visits.filter(v => v.type === 'liraa').length,
    ovitrampas: visits.filter(v => v.type === 'ovitrampas').length,
    pendingSync: visits.filter(v => v.syncStatus === 'pending').length,
  }), [visits]);

  // Carregar visitas na inicialização e sincronizar automaticamente
  useEffect(() => {
    loadVisits();

    // Sincronizar automaticamente se o usuário estiver autenticado
    if (user) {
      logger.log('🔄 Usuário autenticado, iniciando sincronização automática...');
      syncVisits().then(result => {
        if (result.success && result.synced > 0) {
          logger.log(`✅ Sincronização automática concluída: ${result.synced} visitas sincronizadas`);
        } else if (result.message) {
          logger.log('ℹ️ Sincronização automática:', result.message);
        }
      }).catch(error => {
        logger.warn('⚠️ Erro na sincronização automática:', error);
      });
    }
  }, [loadVisits, syncVisits, user]);

  return {
    visits,
    isLoading,
    error,
    loadVisits,
    syncVisits,
    deleteVisit,
    updateVisit,
    getStats
  };
}
