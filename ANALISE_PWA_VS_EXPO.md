# Análise: PWA (Serwist + Dexie) vs Expo Web — EntomoVigilância

> **Data:** 11/03/2026  
> **Versão:** 1.0  
> **Contexto:** Avaliação da melhor abordagem para tornar o sistema offline-first  
> **Referência:** [plan_pwa.md](../plan_pwa.md)

---

## 1. Estado Atual do Projeto

O EntomoVigilância é uma aplicação **Next.js 15 + React 19** em produção na Vercel, com a seguinte stack:

| Camada | Tecnologias |
|--------|-------------|
| **Framework** | Next.js 15 (App Router, SSR) |
| **UI** | React 19, shadcn/ui, Radix UI, Tailwind CSS |
| **Mapas** | Leaflet 1.9 + react-leaflet 5 + leaflet.heat |
| **Gráficos** | Recharts 3 |
| **Estado** | Zustand 5, TanStack React Query 5, React Hook Form 7 |
| **Backend** | Firebase Auth, Firestore, Storage |
| **Email** | Brevo API |
| **Deploy** | Vercel |

### APIs do Browser Utilizadas

- `navigator.mediaDevices.getUserMedia()` — captura de câmera (CameraModal)
- `navigator.geolocation.getCurrentPosition()` — GPS com alta precisão
- `navigator.permissions.query()` — status de permissões
- `canvas.toBlob()` / `canvas.getContext('2d')` — processamento de fotos
- `localStorage` — persistência de visitas e fila de sync
- `window.addEventListener('online'/'offline')` — detecção de rede
- `URL.createObjectURL()` — preview de fotos

### Persistência Offline Atual (localStorage)

| Chave | Conteúdo | Limitação |
|-------|----------|-----------|
| `entomonitec_visits` | Array de visitas (com fotos base64) | ~5-10 MB máximo |
| `entomonitec_sync_queue` | IDs de visitas pendentes | — |
| `user_organization` | Organização do usuário | — |

**Problema principal:** Fotos em base64 estouramos limite do localStorage facilmente. Sem Service Worker, a página sequer carrega quando offline.

---

## 2. Comparativo Detalhado

### 2.1 Compatibilidade com o Código Existente

| Componente/Lib | PWA (Serwist + Dexie) | Expo Web |
|---|---|---|
| **Next.js 15 (SSR, API Routes)** | ✅ Mantém 100% | ❌ Perde SSR, API Routes, middleware |
| **shadcn/ui + Radix UI** | ✅ Sem alteração | ❌ Incompatível — reescrita total |
| **Tailwind CSS** | ✅ Sem alteração | ⚠️ Parcial via NativeWind (subconjunto) |
| **Leaflet + react-leaflet** | ✅ Sem alteração | ❌ Incompatível — trocar para `react-native-maps` |
| **leaflet.heat (heatmap)** | ✅ Sem alteração | ❌ Sem equivalente direto |
| **Recharts** | ✅ Sem alteração | ❌ Incompatível — trocar para SVG charts RN |
| **Firebase SDK web** | ✅ Sem alteração | ✅ Mesmo SDK funciona |
| **30+ componentes React** | ✅ Sem alteração | ❌ Reescrita (`<div>`→`<View>`, etc.) |
| **Framer Motion** | ✅ Sem alteração | ❌ Trocar para `react-native-reanimated` |
| **sonner (toasts)** | ✅ Sem alteração | ❌ Trocar para toast RN |
| **Vercel deploy** | ✅ Sem alteração | ⚠️ Funciona, mas perde Edge/SSR |

### 2.2 Capacidades Offline

| Capacidade | PWA (Serwist + Dexie) | Expo Web |
|---|---|---|
| **App shell offline** | ✅ SW precache serve HTML/JS/CSS | ❌ Sem SW = página não carrega |
| **Service Worker** | ✅ `@serwist/next` gera SW completo | ❌ Expo Web não gera SW |
| **Cache de rotas** | ✅ NetworkFirst strategy | ❌ Não disponível |
| **Cache de tiles de mapa** | ✅ StaleWhileRevalidate | ❌ Não disponível |
| **Background Sync** | ✅ Via SW `SyncManager` | ❌ Não disponível |
| **IndexedDB (storage grande)** | ✅ Dexie.js (~50% do disco) | ⚠️ `expo-sqlite` ou AsyncStorage |
| **Fotos como Blob** | ✅ IndexedDB sem limite prático | ⚠️ Depende da implementação |
| **Firestore persistence** | ✅ `persistentLocalCache` | ✅ Mesmo SDK |
| **Sync automático on reconnect** | ✅ Listener `online` + polling | ⚠️ Implementação manual igual |
| **Export de backup** | ✅ Download JSON via blob URL | ⚠️ Possível, mas com share sheet |

### 2.3 Experiência do Usuário

| Aspecto | PWA (Serwist + Dexie) | Expo Web |
|---|---|---|
| **Instalação no celular** | ✅ "Adicionar à tela inicial" (Chrome Android) | ⚠️ Mesmo mecanismo, mas sem SW atrás |
| **Tela cheia (standalone)** | ✅ `display: standalone` no manifest | ✅ Mesmo mecanismo |
| **Câmera** | ✅ `getUserMedia` (já funciona) | ⚠️ `expo-camera` — API diferente |
| **GPS** | ✅ `navigator.geolocation` (já funciona) | ⚠️ `expo-location` — API diferente |
| **Notificações Push** | ✅ Suporte via SW (futuro) | ❌ Web Push não funciona em Expo Web |
| **Performance inicial (SSR)** | ✅ HTML renderizado no servidor | ❌ SPA — loading spinner até JS carregar |
| **SEO** | ✅ SSR gera HTML semântico | ❌ SPA sem SSR |

### 2.4 Esforço de Implementação

| Métrica | PWA (Serwist + Dexie) | Expo Web |
|---|---|---|
| **Arquivos a criar** | ~10-15 novos | — |
| **Arquivos a modificar** | ~8-10 existentes | — |
| **Arquivos a reescrever** | 0 | **30+ componentes** |
| **Bibliotecas a trocar** | 0 | **6+ (Leaflet, Recharts, shadcn, Radix, Framer, sonner)** |
| **Abordagem** | Incremental (5 fases) | Big-bang (reescrita) |
| **Risco** | Baixo — cada fase é independente | Alto — tudo ou nada |
| **Rollback** | Fácil — revert por fase | Impossível sem manter dois projetos |

---

## 3. Cenário dos Agentes de Campo

Os agentes de campo operam em áreas com **conexão instável** usando **smartphones Android com Chrome**. Para esse cenário:

### O que o agente precisa offline:
1. Abrir o app (app shell precacheado)
2. Criar visita com formulário completo
3. Capturar fotos (câmera)
4. Registrar GPS (geolocalização)
5. Salvar tudo localmente (IndexedDB)
6. Sincronizar automaticamente quando voltar à rede
7. Ver dashboard com dados cacheados

### PWA no Android com Chrome suporta:
- ✅ Instalação na home screen com ícone
- ✅ Tela cheia sem barra do browser
- ✅ Câmera (front/rear)
- ✅ GPS com alta precisão
- ✅ Notificações push
- ✅ Background sync
- ✅ IndexedDB com limite generoso (~50% do disco)
- ✅ Service Worker com cache offline completo

### Expo Web NÃO suporta:
- ❌ Service Worker (página não carrega offline)
- ❌ Background sync
- ❌ Precache do app shell
- ❌ Cache de tiles de mapa para uso offline

---

## 4. Quando Expo Web Seria a Escolha Certa?

Expo Web seria superior **apenas** se:

1. O projeto começasse **do zero** (sem código existente para migrar)
2. O objetivo primário fosse gerar **apps nativos iOS e Android** simultaneamente
3. Não houvesse dependência de **Leaflet**, **Recharts** ou **shadcn/ui**
4. O offline fosse resolvido no **app nativo** (com SQLite + file system) em vez do web

Nenhuma dessas condições se aplica ao EntomoVigilância.

---

## 5. Estratégia Futura para App Nativo

O roadmap prevê apps nativos como Fase 3 (prioridade média). A estratégia recomendada:

```
Agora:  Web App (Next.js) + PWA offline-first
        ↓
        Mesma API / Firebase backend
        ↓
Futuro: App React Native/Expo SEPARADO
        Consome o mesmo Firebase
        Compartilha types/interfaces TypeScript
        UI nativa otimizada para mobile
```

Isso permite que o PWA continue servindo supervisores e administradores (que usam desktop), enquanto o app nativo atenda agentes de campo com recursos que PWA não alcança (acesso ao file system, better background processing, etc.).

---

## 6. O Plano PWA Resolve Cada Problema

| Problema Atual | Solução no Plano (plan_pwa.md) | Fase |
|---|---|---|
| localStorage estoura com fotos base64 | Dexie.js + fotos como **Blob** no IndexedDB | Fase 2 |
| Página não carrega offline | `@serwist/next` com precache do app shell | Fase 1 |
| Tiles de mapa não carregam offline | Cache **StaleWhileRevalidate** para tiles Leaflet | Fase 1 |
| Sem sync automático ao reconectar | Hook `useOnlineSync` com listener `online` + polling | Fase 3 |
| Sem indicação de pendências | `SyncStatusBanner` com contagem da fila | Fase 3 |
| Sem proteção contra limpeza de dados | Export/import manual JSON como safety net | Fase 3 |
| Dashboard inútil offline | Cache em Dexie + indicador de data | Fase 4 |
| Sem instalação como app | `manifest.json` + `InstallPrompt` component | Fase 1/5 |
| Firebase não persiste offline | `persistentLocalCache` + `persistentMultipleTabManager` | Fase 4 |

---

## 7. Conclusão e Recomendação

### Veredicto: **PWA com Serwist + Dexie**

| Critério | PWA | Expo Web |
|---|---|---|
| Custo de migração | 🟢 Baixo (incremental) | 🔴 Altíssimo (reescrita) |
| Resolve offline | 🟢 Completamente | 🔴 Não resolve (sem SW) |
| Preserva investimento | 🟢 100% do código existente | 🔴 Perde 90%+ |
| Risco técnico | 🟢 Baixo | 🔴 Alto |
| Cenário do agente (Android) | 🟢 Experiência de app nativo | 🔴 Inferior ao PWA |
| Caminho para app nativo | 🟢 Coexiste | 🟡 Substitui (mas não resolve offline web) |

**PWA é a escolha correta** porque:

1. **É incremental** — o plano executa em 5 fases independentes, cada uma entregando valor
2. **Resolve offline de verdade** — Service Worker é a única tecnologia web que habilita app shell offline
3. **Preserva todo o investimento** — 30+ componentes, Leaflet, Recharts, shadcn/ui, Next.js SSR
4. **Atende o cenário real** — agentes de campo em Android com Chrome
5. **Não impede app nativo futuro** — a arquitetura PWA coexiste com um app nativo separado

**Expo Web seria a escolha errada** porque exigiria reescrita completa do projeto e, paradoxalmente, **não resolveria o problema offline** — que é o motivador desta decisão.

---

> **Próximo passo:** Iniciar implementação da Fase 1 do plano PWA (infraestrutura: dependências, manifest, Service Worker, @serwist/next)

---

*Documento gerado em: 11/03/2026*  
*Baseado em: [plan_pwa.md](../plan_pwa.md), [ARQUITETURA_SISTEMA.md](../ARQUITETURA_SISTEMA.md), análise do código-fonte*
