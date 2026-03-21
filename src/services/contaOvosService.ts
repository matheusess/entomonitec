import logger from '@/lib/logger';
import {
  ContaOvosSearchParams,
  ContaOvosPostData,
  ContaOvosInstallData,
  ContaOvosPostResponse,
  IContaOvosOvitrap,
} from '@/types/contaovos';
import { IOvitrap } from '@/types/ovitrap';
import { db as localDb } from '@/lib/offlineDb';

const CONTAOVOS_COLLECTION = 'contaovos_post';

const PROXY_URL = '/api/contaovos';

class ContaOvosService {
  /**
   * Busca ovitrampas/últimas contagens por estado ou município na API Conta Ovos.
   */
  async getLastCounting(params: ContaOvosSearchParams): Promise<IContaOvosOvitrap[]> {
    const query = new URLSearchParams();

    if (params.state) query.set('state', params.state);
    if (params.municipality) query.set('municipality', params.municipality);
    if (params.country) query.set('country', params.country);
    if (params.page) query.set('page', String(params.page));
    if (params.id) query.set('id', String(params.id));
    if (params.date) query.set('date', params.date);
    if (params.date_collect) query.set('date_collect', params.date_collect);

    try {
      const response = await fetch(`${PROXY_URL}?${query.toString()}`);
      if (!response.ok) {
        logger.warn('ContaOvos GET falhou:', response.status);
        return [];
      }
      const data = await response.json();
      // A API retorna um array diretamente ou dentro de uma chave — normalizar
      let items: IContaOvosOvitrap[];
      if (Array.isArray(data)) items = data as IContaOvosOvitrap[];
      else if (Array.isArray(data?.data)) items = data.data as IContaOvosOvitrap[];
      else return [];

      // Deduplica por ovitrap_id — a API retorna múltiplos registros
      // (uma contagem por semana) para a mesma ovitrampa; manter apenas o mais recente.
      const seen = new Map<string, IContaOvosOvitrap>();
      for (const item of items) {
        const oid = item.ovitrap_id;
        if (oid == null) continue;
        if (!seen.has(oid)) {
          seen.set(oid, item);
        }
      }
      return Array.from(seen.values());
    } catch (error) {
      logger.error('Erro ao buscar dados do Conta Ovos:', error);
      return [];
    }
  }

  /**
   * Envia uma leitura para uma ovitrampa existente.
   */
  async postCounting(data: ContaOvosPostData): Promise<ContaOvosPostResponse> {
    try {
      const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (!response.ok) {
        logger.warn('ContaOvos POST falhou:', result);
        return { success: false, message: result?.error ?? 'Erro desconhecido' };
      }
      return { success: true, ...result };
    } catch (error) {
      logger.error('Erro ao enviar leitura para Conta Ovos:', error);
      return { success: false, message: 'Falha na comunicação com a API' };
    }
  }

  /**
   * Instala uma nova ovitrampa E envia a leitura inicial.
   */
  async installAndCount(data: ContaOvosInstallData): Promise<ContaOvosPostResponse> {
    return this.postCounting(data);
  }

  /**
   * Tenta enviar para a API se online; caso contrário (ou em caso de falha),
   * persiste no IndexedDB para sync posterior.
   */
  async queueInstallAndCount(data: ContaOvosInstallData, isOnline: boolean): Promise<void> {
    if (isOnline) {
      try {
        const result = await this.postCounting(data);
        if (result.success) {
          logger.log('✅ Conta Ovos: ovitrampa registrada com sucesso');
          return;
        }
        logger.warn('Conta Ovos POST falhou, enfileirando para retry:', result.message);
      } catch (err) {
        logger.warn('Conta Ovos POST lançou exceção, enfileirando:', err);
      }
    }

    // Offline ou falha — salva na fila
    await localDb.pendingWrites.add({
      type: 'add',
      collection: CONTAOVOS_COLLECTION,
      data: JSON.stringify(data),
      createdAt: new Date(),
      status: 'pending',
      retries: 0,
    });
    logger.log('📥 Conta Ovos POST enfileirado para sync posterior');
  }

  /**
   * Processa a fila de POSTs pendentes do Conta Ovos.
   * Chamado automaticamente pelo useOnlineSync ao reconectar.
   */
  async syncPendingContaOvos(): Promise<{ synced: number; errors: number }> {
    try {
      const pending = await localDb.pendingWrites
        .where('collection')
        .equals(CONTAOVOS_COLLECTION)
        .and((r) => r.status === 'pending')
        .toArray();

      if (pending.length === 0) return { synced: 0, errors: 0 };

      logger.log(`🔄 Sincronizando ${pending.length} POST(s) pendente(s) do Conta Ovos...`);
      let synced = 0;
      let errors = 0;

      for (const op of pending) {
        if (!op.data) continue;
        try {
          const data: ContaOvosInstallData = JSON.parse(op.data);
          const result = await this.postCounting(data);
          if (result.success) {
            if (op.id) await localDb.pendingWrites.delete(op.id);
            synced++;
          } else {
            errors++;
            if (op.id)
              await localDb.pendingWrites.update(op.id, {
                status: 'error',
                error: result.message,
                retries: (op.retries ?? 0) + 1,
              });
          }
        } catch (err) {
          errors++;
          if (op.id)
            await localDb.pendingWrites.update(op.id, {
              status: 'error',
              error: err instanceof Error ? err.message : 'Erro',
              retries: (op.retries ?? 0) + 1,
            });
        }
      }

      logger.log(`📊 Sync Conta Ovos concluído: ${synced} ok, ${errors} erros`);
      return { synced, errors };
    } catch (err) {
      logger.error('Erro ao sincronizar fila Conta Ovos:', err);
      return { synced: 0, errors: 0 };
    }
  }

  /**
   * Converte um item da API Conta Ovos para o formato IOvitrap usado internamente.
   */
  mapToOvitrap(apiItem: IContaOvosOvitrap, organizationId: string): IOvitrap {
    return {
      id: `contaovos_${apiItem.ovitrap_id}`,
      nome: apiItem.municipality ? `${apiItem.municipality} (${apiItem.ovitrap_id})` : `Ovitrampa ${apiItem.ovitrap_id}`,
      codigo: `OVT-${apiItem.ovitrap_id}`,
      endereco: [apiItem.municipality, apiItem.state_name].filter(Boolean).join(' - '),
      organizationId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'contaovos_api',
      contaOvosGroupId: apiItem.ovitrap_website_id,
      lat: apiItem.latitude,
      lng: apiItem.longitude,
      source: 'contaovos',
    };
  }
}

export const contaOvosService = new ContaOvosService();
