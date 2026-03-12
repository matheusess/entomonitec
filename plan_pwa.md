## Plan: Implementação PWA Offline-First com Dexie + Serwist

O projeto é um Next.js 15 SSR na Vercel, onde agentes de campo fazem visitas entomológicas em áreas com conexão instável. Hoje, dados ficam em `localStorage` (limite ~5-10MB, fotos em base64 o estourando facilmente), sem service worker nem manifest. O plano migra o storage para **IndexedDB via Dexie.js**, adiciona **service worker via @serwist/next** para cache do app shell, habilita **Firestore offline persistence**, implementa **sync agressivo + export manual** de dados pendentes, e disponibiliza offline as telas de **visitas (CRUD completo) e dashboard (read-only com cache)**.

> **Sobre "limpar cache do browser":** nenhuma API de browser sobrevive a "Limpar todos os dados do site". A mitigação é: sync agressivo quando online + aviso permanente de pendências + export manual como backup + re-hidratação do Firebase ao reabrir.

**Steps**

### Fase 1 — Infraestrutura PWA

1. **Instalar dependências**: `@serwist/next`, `serwist` (service worker), `dexie` (IndexedDB), `dexie-react-hooks` (bindings React).

2. **Criar manifest**: Novo arquivo `public/manifest.json` com `name: "EntomoVigilância"`, `short_name: "Entomo"`, `start_url: "/visits"`, `display: "standalone"`, `theme_color`, `background_color` e array de `icons` (192×192, 512×512 em PNG). Criar ícones correspondentes em `public/icons/`.

3. **Atualizar metadata no layout**: Em `src/app/layout.tsx`, adicionar ao objeto `metadata` do Next.js: `manifest: "/manifest.json"`, `themeColor`, `appleWebApp: { capable: true, statusBarStyle, title }`, `icons` e as meta tags via `viewport` e `other` (ex: `apple-mobile-web-app-capable`).

4. **Configurar @serwist/next**: Em `next.config.ts`, envolver a config com `withSerwist()` apontando `swSrc: "src/sw.ts"` e `swDest: "public/sw.js"`. Criar `src/sw.ts` com estratégias:
   - **Precache**: app shell (HTML, JS, CSS gerados pelo build)
   - **Runtime cache — StaleWhileRevalidate**: assets estáticos (`/icons/`, fontes Google, tiles do Leaflet)
   - **Runtime cache — NetworkFirst**: rotas de página (`/visits`, `/dashboard`, `/login`)
   - **Runtime cache — CacheFirst**: imagens Firebase Storage (fotos já sincronizadas)
   - **Background Sync**: fila `visit-sync` para POSTs ao Firestore (fallback com retry periódico para browsers sem suporte a `SyncManager`)

5. **Registrar SW no client**: Criar `src/components/ServiceWorkerRegistration.tsx` com `navigator.serviceWorker.register('/sw.js')`, importar em `src/components/providers.tsx`. Incluir lógica de atualização (prompt "Nova versão disponível — atualizar?").

### Fase 2 — Migração localStorage → IndexedDB (Dexie)

6. **Criar database schema**: Novo arquivo `src/lib/offlineDb.ts` com Dexie database `EntomonitecDB`, tabelas:
   - `visits`: `id, type, syncStatus, organizationId, agentId, neighborhood, createdAt, firebaseId` (indexed)
   - `photos`: `id, visitId, blob, syncStatus` — fotos como **Blob** (não base64), referenciadas por `visitId`
   - `syncQueue`: `id, visitId, createdAt, retries`
   - `userProfile`: `id, data` — cache do perfil do usuário + organização
   - `dashboardCache`: `id, organizationId, data, cachedAt` — cache do dashboard

7. **Reescrever `visitsService.ts`**: Em `src/services/visitsService.ts`, substituir **todos** os acessos a `localStorage.getItem/setItem` (`STORAGE_KEY`, `SYNC_QUEUE_KEY`) por operações Dexie equivalentes:
   - `getLocalVisits()` → `db.visits.toArray()`
   - `saveVisitLocally()` → `db.visits.add(visit)` + `db.syncQueue.add({visitId})`
   - `addToSyncQueue()` → `db.syncQueue.add()`
   - `getSyncQueue()` → `db.syncQueue.toArray()`
   - `removeFromSyncQueue()` → `db.syncQueue.where('visitId').equals(id).delete()`
   - `updateLocalVisit()` → `db.visits.put(updatedVisit)`
   - `clearLocalData()` → `db.visits.clear()` + `db.syncQueue.clear()` + `db.photos.clear()`
   - Todos os métodos passam a ser `async` (Dexie é assíncrono por natureza)

8. **Separar fotos do objeto visita**: Ao criar visita, extrair fotos base64, converter para Blob (via `fetch(dataUri).then(r => r.blob())`), salvar na tabela `photos` com referência ao `visitId`. O campo `photos` na visita passa a guardar apenas IDs de referência local ou URLs do Firebase (após sync). Isso resolve o problema de estourar localStorage — blobs no IndexedDB não têm limite prático (até ~50% do disco).

9. **Migração de dados existentes**: No `src/lib/offlineDb.ts`, criar função `migrateFromLocalStorage()` que, na primeira abertura do DB, verifica se existem dados nas chaves `entomonitec_visits` e `entomonitec_sync_queue` do localStorage, importa para IndexedDB, e limpa o localStorage. Chamar essa migração no `on('ready')` do Dexie.

10. **Atualizar `useVisits.ts`**: Em `src/hooks/useVisits.ts`, adaptar para o Dexie assíncrono. Usar `useLiveQuery` do `dexie-react-hooks` para reatividade automática (lista de visitas atualiza sem refresh manual).

### Fase 3 — Sync Agressivo + Export

11. **Auto-sync na reconexão**: Criar `src/hooks/useOnlineSync.ts` — hook global (montado no Layout) que escuta `window.addEventListener('online')` e dispara `visitsService.syncVisits()` imediatamente. Complementar com polling a cada 60s quando online.

12. **Banner persistente de pendências**: Criar `src/components/SyncStatusBanner.tsx` — barra fixa no topo (estilo warning) que aparece sempre que `syncQueue.count() > 0`, mostrando "X visitas aguardando sincronização". Integrar no `src/components/Layout.tsx`.

13. **Aviso antes de sair**: No hook `useOnlineSync`, adicionar `window.addEventListener('beforeunload')` que previne fechamento se há itens na sync queue, mostrando alerta nativo do browser.

14. **Export manual de dados pendentes**: Criar `src/lib/exportService.ts` com método `exportPendingVisits()` que:
    - Lê visitas com `syncStatus !== 'synced'` do Dexie
    - Inclui fotos como base64 no JSON (reconvertendo Blob → base64 para portabilidade)
    - Gera arquivo `.json` com metadata (data export, versão, agente, organização)
    - Dispara download via `URL.createObjectURL(blob)` + `<a>` tag
    - Botão de export visível no `SyncStatusBanner` e na tela de histórico de visitas

15. **Import de backup** (complemento): Em `src/lib/exportService.ts`, método `importVisitsBackup(file)` que lê o JSON exportado, valida schema, e insere no Dexie sem duplicatas (verifica `id`). Acessível via configurações.

### Fase 4 — Firestore Persistence + Dashboard Offline

16. **Habilitar Firestore offline persistence**: Em `src/lib/firebase.ts`, substituir `getFirestore(app)` por `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`. Isso faz o SDK do Firebase cachear automaticamente reads em IndexedDB e servir dados locais quando offline.

17. **Cache de dashboard**: Em `src/services/firebaseDashboardService.ts`, após cada fetch bem-sucedido de `getDashboardData`, `getNeighborhoodRisks` e `getRoutineVisitData`, salvar os resultados processados na tabela `dashboardCache` do Dexie com timestamp. Ao carregar offline, servir do cache com indicador visual "Dados de DD/MM/YYYY HH:mm".

18. **Cache de perfil do usuário**: Em `src/components/AuthContext.tsx`, ao carregar o user do Firestore, salvar em `db.userProfile.put({id: uid, data: userData})`. No `loadUserData`, tentar Dexie primeiro como fallback se Firestore falhar (offline). Substituir o `localStorage.setItem('user_organization', ...)` por Dexie.

### Fase 5 — UX e Polimento

19. **Prompt de instalação**: Criar `src/components/InstallPrompt.tsx` que captura o evento `beforeinstallprompt`, mostra um banner/modal convidando a instalar o app. Salvar preferência "Não mostrar novamente" no Dexie.

20. **Indicador offline global**: Atualizar `src/components/LocationStatus.tsx` e `src/components/FirebaseStatus.tsx` para usar um único hook `useNetworkStatus()` compartilhado, evitando múltiplos listeners. Mostrar badge "Offline" no header em todas as telas.

21. **Migrar `municipal_config` e `user_organization`**: Mover as chaves restantes de `localStorage` (`municipal_config` em `src/lib/municipalConfig.ts` e `user_organization` em `src/components/AuthContext.tsx`) para tabelas Dexie, mantendo consistência com o novo storage.

22. **Atualização do `next.config.ts`**: Além do `withSerwist`, adicionar headers de cache para assets estáticos e configurar `output` se necessário para compatibilidade Vercel + SW.

**Verification**

- **Testes manuais PWA**: Chrome DevTools → Application → verificar Manifest detectado, SW registrado e ativo, Cache Storage populado
- **Lighthouse**: rodar auditoria PWA — meta é score 100 na categoria PWA (installable, offline-capable)
- **Teste offline**: desligar rede no DevTools → verificar que `/visits` carrega, formulário funciona, visitas salvam no Dexie, fotos persistem como blobs
- **Teste de reconexão**: criar visitas offline → religar rede → verificar sync automático + banner desaparece
- **Teste de export**: criar visitas offline → exportar JSON → limpar dados do site → reimportar JSON → verificar dados restaurados
- **Teste de cache clear**: criar visitas, sincronizar → limpar cache → reabrir → verificar que Firebase recarrega tudo (dados synced não perdidos)
- **Teste de dashboard offline**: abrir dashboard online → desligar rede → recarregar → verificar dados cacheados aparecem com indicador de data
- **Testes unitários**: testar `offlineDb.ts` (CRUD Dexie), `exportService.ts` (export/import), migração localStorage→Dexie em `src/lib/utils.spec.ts` ou novos arquivos de spec

**Decisions**

- **Dexie.js sobre idb**: API mais rica com `useLiveQuery` para reatividade, suporte a migrations nativo, queries compostas — justifica os ~16KB extras
- **@serwist/next sobre next-pwa**: fork mantido, compatível com Next.js 15 e App Router, next-pwa está abandonado
- **Fotos como Blob no IndexedDB sobre base64 no localStorage**: resolve o limite de 5-10MB do localStorage — IndexedDB suporta até ~50% do disco
- **Export manual como safety net**: nenhuma API de browser sobrevive a "Limpar todos dados do site" — export JSON é o único backup que o agente controla fisicamente
- **Firestore `persistentLocalCache`**: habilita leitura offline nativa do SDK sem código custom, beneficiando dashboard e listagem de visitas do Firebase
