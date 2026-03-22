# 📋 Plano de Implementação — Registro Geográfico (RG)

> Feature: Cadastro prévio de imóveis, quadras e endereços vinculados à organização, com upload via Excel, controle de cobertura de visitas e histórico por imóvel.

---

## 1. Contexto Atual

### O que já existe

| Recurso | Situação |
|---------|----------|
| Multi-tenancy (`organizationId`) | ✅ Funcional |
| Sidebar com Painel Geral / Formulários / Operacional | ✅ Funcional |
| Tipos de Visita (Rotina, LIRAa, Ovitrampa) | ✅ Funcional |
| Georreferenciamento (GPS + geocoding reverso) | ✅ Funcional |
| Offline-first (Dexie + pendingWrites) | ✅ Funcional |
| `FUNCIONALIDADE_RG.md` (pré-cadastro de moradores por CSV) | 📄 Documentado, não implementado |
| Conceito de "projeto" na data model | ❌ Não existe |
| Conceito de "quadra" / "imóvel" como entidade | ❌ Não existe |

### Modelo do Excel de referência

Arquivo: `Simulacao_RG_Curitiba_expandido.xlsx` — 30 registros

| Coluna | Exemplo |
|--------|---------|
| **Bairro** | Novo Mundo, Portão, Fazendinha |
| **Logradouro** | Rua Itacolomi |
| **Número** | 147 |
| **Cidade** | Curitiba |
| **UF** | PR |
| **CEP** | 81532-654 |

3 bairros distintos, 12 logradouros, 30 imóveis.

---

## 2. Arquitetura de Dados

### 2.1 Novas Collections no Firestore

```
organizations/{orgId}
  └─ (campos existentes)

geographic_registries/{rgId}            ← NOVA COLLECTION
  ├── organizationId: string
  ├── name: string                      // nome amigável do RG (ex: "LIRAa 2026/1")
  ├── description?: string
  ├── status: 'draft' | 'active' | 'archived'
  ├── totalProperties: number           // total de imóveis importados
  ├── totalBlocks: number               // total de quadras calculadas
  ├── uploadedBy: string
  ├── uploadedAt: Timestamp
  ├── updatedAt: Timestamp
  ├── fileName?: string                 // nome original do arquivo
  └── metadata?: { city, state, ... }

rg_blocks/{blockId}                     ← NOVA COLLECTION
  ├── rgId: string                      // FK → geographic_registries
  ├── organizationId: string
  ├── bairro: string
  ├── logradouro: string                // rua principal da quadra
  ├── totalProperties: number
  ├── visitedCount: number              // incrementado quando imóvel é marcado
  ├── pendingCount: number              // totalProperties − visitedCount
  └── createdAt: Timestamp

rg_properties/{propertyId}             ← NOVA COLLECTION
  ├── rgId: string                      // FK → geographic_registries
  ├── blockId: string                   // FK → rg_blocks
  ├── organizationId: string
  ├── bairro: string
  ├── logradouro: string
  ├── numero: string
  ├── cidade: string
  ├── uf: string
  ├── cep?: string
  ├── complemento?: string
  ├── nomeResponsavel?: string
  ├── lat?: number                      // geocodificação futura
  ├── lng?: number
  ├── status: 'pending' | 'visited' | 'refused' | 'closed'
  ├── lastVisitId?: string              // FK → visits
  ├── lastVisitAt?: Timestamp
  ├── visitCount: number                // quantas vezes foi visitado
  ├── visitHistory: VisitReference[]    // últimas N visitas linkadas
  └── createdAt: Timestamp

// Sub-tipo para histórico
interface VisitReference {
  visitId: string;
  visitType: 'routine' | 'liraa' | 'ovitrampas';
  date: Timestamp;
  agentId: string;
  agentName: string;
  status: 'completed' | 'refused' | 'closed';
}
```

### 2.2 Derivação de Quadras

As quadras **não existem no Excel** — serão derivadas automaticamente durante o upload:

```
Quadra = agrupamento de imóveis por (bairro + logradouro)
```

Exemplo com o Excel de referência:
- **Novo Mundo / Rua Itacolomi** → Quadra com imóveis 147 e 411
- **Novo Mundo / Rua Goiás** → Quadra com imóveis 614 e 130
- etc.

Isso gera 12 quadras (12 logradouros distintos) com 30 imóveis no total.

### 2.3 Vinculação com Visitas Existentes

Quando uma visita é registrada, o sistema tenta vincular automaticamente:

```
visitLocation.geocodingData → { neighborhood, street, houseNumber }
                             ↕ match (normalizado, case-insensitive)
rg_properties → { bairro, logradouro, numero }
```

Se encontrar match:
1. Atualiza `rg_properties.status` → `'visited'`
2. Incrementa `rg_properties.visitCount`
3. Adiciona referência em `rg_properties.visitHistory`
4. Atualiza `rg_blocks.visitedCount` / `pendingCount`

---

## 3. Tipos TypeScript

### Arquivo: `src/types/registro-geografico.ts`

```typescript
// ─── Registro Geográfico (RG) ─────────────────────────────────

export type RGStatus = 'draft' | 'active' | 'archived';
export type PropertyStatus = 'pending' | 'visited' | 'refused' | 'closed';

export interface IGeographicRegistry {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  status: RGStatus;
  totalProperties: number;
  totalBlocks: number;
  uploadedBy: string;
  uploadedAt: Date;
  updatedAt: Date;
  fileName?: string;
  metadata?: {
    city?: string;
    state?: string;
    source?: string;
  };
}

export interface IRGBlock {
  id: string;
  rgId: string;
  organizationId: string;
  bairro: string;
  logradouro: string;
  totalProperties: number;
  visitedCount: number;
  pendingCount: number;
  createdAt: Date;
}

export interface IRGProperty {
  id: string;
  rgId: string;
  blockId: string;
  organizationId: string;
  bairro: string;
  logradouro: string;
  numero: string;
  cidade: string;
  uf: string;
  cep?: string;
  complemento?: string;
  nomeResponsavel?: string;
  lat?: number;
  lng?: number;
  status: PropertyStatus;
  lastVisitId?: string;
  lastVisitAt?: Date;
  visitCount: number;
  visitHistory: IVisitReference[];
  createdAt: Date;
}

export interface IVisitReference {
  visitId: string;
  visitType: 'routine' | 'liraa' | 'ovitrampas';
  date: Date;
  agentId: string;
  agentName: string;
  status: 'completed' | 'refused' | 'closed';
}

// ─── Upload / Import ──────────────────────────────────────────

export interface RGExcelRow {
  bairro: string;
  logradouro: string;
  numero: string | number;
  cidade: string;
  uf: string;
  cep?: string;
}

export interface RGImportResult {
  success: boolean;
  totalRows: number;
  importedProperties: number;
  generatedBlocks: number;
  errors: RGImportError[];
  skipped: number;
}

export interface RGImportError {
  row: number;
  field: string;
  message: string;
  value?: string;
}

// ─── Estatísticas / Dashboard ─────────────────────────────────

export interface RGStats {
  totalRegistries: number;
  totalBlocks: number;
  totalProperties: number;
  visitedProperties: number;
  pendingProperties: number;
  refusedProperties: number;
  closedProperties: number;
  coveragePercent: number;          // visitedProperties / totalProperties * 100
  blockCoverage: BlockCoverage[];
}

export interface BlockCoverage {
  blockId: string;
  bairro: string;
  logradouro: string;
  total: number;
  visited: number;
  pending: number;
  percent: number;
}
```

---

## 4. Fases de Implementação

### FASE 1 — Fundação (Types + Service + Collection)

**Objetivo:** Criar a camada de dados sem UI.

| # | Tarefa | Arquivo |
|---|--------|---------|
| 1.1 | Criar types do RG | `src/types/registro-geografico.ts` |
| 1.2 | Criar service CRUD do Firestore | `src/services/rgService.ts` |
| 1.3 | Implementar parsing de Excel (.xlsx) | `src/services/rgImportService.ts` |
| 1.4 | Lógica de derivação de quadras | dentro do `rgImportService` |
| 1.5 | Lógica de match imóvel ↔ visita | `src/services/rgMatchService.ts` |

**Detalhes do service:**

```
rgService.ts
├── createRegistry(orgId, name, description)
├── getRegistries(orgId) → IGeographicRegistry[]
├── getRegistryById(id)
├── updateRegistryStatus(id, status)
├── deleteRegistry(id)  // cascade delete blocks + properties
├── getBlocks(rgId) → IRGBlock[]
├── getBlockProperties(blockId) → IRGProperty[]
├── getPropertyById(id)
├── updatePropertyStatus(propertyId, status, visitRef?)
├── getStats(rgId) → RGStats
└── linkVisitToProperty(propertyId, visitRef)

rgImportService.ts
├── parseExcelFile(file: File) → RGExcelRow[]
├── validateRows(rows) → { valid, errors }
├── importToFirestore(orgId, rgId, rows) → RGImportResult
└── deriveBlocks(rows) → Map<string, RGExcelRow[]>

rgMatchService.ts
├── findPropertyByAddress(orgId, bairro, logradouro, numero) → IRGProperty | null
├── normalizeAddress(input) → string  // remove acentos, lowercase, trim
└── autoLinkVisit(orgId, visitLocation, visitId, visitType, agentInfo) → boolean
```

**Dependência de pacote:**
```bash
npm install xlsx   # leitura de .xlsx no client-side
```

### FASE 2 — Navegação + Página Base

**Objetivo:** Adicionar a rota `/registro-geografico` no sidebar e criar a página shell.

| # | Tarefa | Arquivo |
|---|--------|---------|
| 2.1 | Adicionar item "Registro Geográfico" no sidebar | `src/components/Layout.tsx` |
| 2.2 | Criar rota da página | `src/app/(auth)/registro-geografico/page.tsx` |
| 2.3 | Criar componente principal | `src/components/pages/RegistroGeografico.tsx` |

**Posição no sidebar:**

```typescript
{
  path: '/registro-geografico',
  label: 'Registro Geográfico',
  icon: Map, // lucide-react
  roles: ['supervisor', 'administrator'],
  description: 'Gestão de quadras, imóveis e cobertura de visitas'
},
```

→ Entre **Formulários** e **Operacional** na ordem do menu.

**Layout da página — 3 tabs:**

```
┌──────────────────────────────────────────────────┐
│  Registro Geográfico                              │
│                                                    │
│  [Registros]  [Quadras & Imóveis]  [Cobertura]    │
│                                                    │
│  ┌─ Tab "Registros" ────────────────────────────┐ │
│  │ Lista de RGs com status, total, upload       │ │
│  │ Botão [+ Importar Excel]                     │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  ┌─ Tab "Quadras & Imóveis" ────────────────────┐ │
│  │ Seletor de RG                                │ │
│  │ Lista colapsável de quadras                  │ │
│  │   └─ Imóveis dentro de cada quadra           │ │
│  │   └─ Status badge (pendente/visitado)        │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  ┌─ Tab "Cobertura" ───────────────────────────-┐ │
│  │ KPIs: total / visitados / pendentes / %       │ │
│  │ Barra de progresso por quadra                │ │
│  │ Filtro por bairro                            │ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### FASE 3 — Upload e Importação de Excel

**Objetivo:** Permitir upload do `.xlsx`, validar e importar para o Firestore.

| # | Tarefa |
|---|--------|
| 3.1 | Componente de upload com drag & drop |
| 3.2 | Preview da planilha (tabela com primeiras 10 linhas) |
| 3.3 | Mapeamento de colunas (auto-detect + override manual) |
| 3.4 | Validação visual (linhas com erro em vermelho) |
| 3.5 | Barra de progresso durante importação |
| 3.6 | Relatório final (importados / erros / quadras geradas) |

**Fluxo de upload:**

```
Usuário arrasta .xlsx
       ↓
Parse client-side (xlsx library)
       ↓
Detecta colunas automaticamente (headers normalizados)
       ↓
Valida cada linha (bairro, logradouro, número obrigatórios)
       ↓
Preview com tabela + erros destacados
       ↓
Usuário confirma nome do RG + clica "Importar"
       ↓
Batch write Firestore:
  1. Cria document em geographic_registries
  2. Agrupa por (bairro + logradouro) → cria rg_blocks
  3. Cria rg_properties vinculando a cada block
       ↓
Exibe resultado final
```

**Mapeamento automático de colunas:**

```typescript
const COLUMN_MAP: Record<string, string> = {
  'bairro': 'bairro',
  'neighborhood': 'bairro',
  'logradouro': 'logradouro',
  'rua': 'logradouro',
  'street': 'logradouro',
  'endereco': 'logradouro',
  'número': 'numero',
  'numero': 'numero',
  'number': 'numero',
  'num': 'numero',
  'cidade': 'cidade',
  'city': 'cidade',
  'municipio': 'cidade',
  'município': 'cidade',
  'uf': 'uf',
  'estado': 'uf',
  'state': 'uf',
  'cep': 'cep',
  'zip': 'cep',
};
```

### FASE 4 — Visualização de Quadras e Imóveis

**Objetivo:** Tab "Quadras & Imóveis" com navegação hierárquica.

| # | Tarefa |
|---|--------|
| 4.1 | Seletor de RG ativo (Select/Combobox) |
| 4.2 | Lista de quadras com accordion/collapsible |
| 4.3 | Dentro de cada quadra: tabela de imóveis |
| 4.4 | Badge de status por imóvel (Pendente / Visitado / Recusado / Fechado) |
| 4.5 | Histórico de visitas por imóvel (modal ou drawer) |
| 4.6 | Filtro por bairro + busca por logradouro/número |

**Layout:**

```
[Seletor de RG: "LIRAa 2026/1" ▼]  [Filtro Bairro ▼]  [🔍 Buscar...]

📍 Novo Mundo / Rua Itacolomi                    2/2 visitados ✅
  ├── Nº 147 — 🟢 Visitado (14/03/2026)  [Ver histórico]
  └── Nº 411 — 🟢 Visitado (15/03/2026)  [Ver histórico]

📍 Novo Mundo / Rua Goiás                        0/2 visitados ⚠️
  ├── Nº 614 — 🔴 Pendente               [Marcar visitado]
  └── Nº 130 — 🔴 Pendente               [Marcar visitado]

📍 Portão / Rua João Bettega                     1/3 visitados 🔄
  ├── Nº 200 — 🟢 Visitado (12/03/2026)
  ├── Nº 350 — 🔴 Pendente
  └── Nº 501 — 🟡 Recusado (10/03/2026)
```

### FASE 5 — Painel de Cobertura e Estatísticas

**Objetivo:** Tab "Cobertura" com KPIs e gráficos.

| # | Tarefa |
|---|--------|
| 5.1 | Cards de KPI (Total / Visitados / Pendentes / % Cobertura) |
| 5.2 | Progress bar por quadra (bairro agrupado) |
| 5.3 | Filtro por bairro |
| 5.4 | Indicadores por parâmetro (bairro, logradouro) |
| 5.5 | Export de relatório de cobertura (CSV) |

**KPIs:**

```
┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
│  🏠 Total  │  │ ✅ Visit.  │  │ ⏳ Pend.   │  │ 📊 Cobert. │
│     30     │  │     18     │  │     10     │  │    60%     │
│  imóveis   │  │  imóveis   │  │  imóveis   │  │            │
└────────────┘  └────────────┘  └────────────┘  └────────────┘

▸ Novo Mundo       ████████████░░░░  75% (15/20)
▸ Portão           ████████░░░░░░░░  50% (5/10)
▸ Fazendinha        Sem visitas ainda  0% (0/10)
```

### FASE 6 — Vinculação Automática Visita ↔ Imóvel

**Objetivo:** Quando uma visita é salva, tentar vincular automaticamente a um imóvel do RG.

| # | Tarefa |
|---|--------|
| 6.1 | No `handleSubmit` de cada tipo de visita, chamar `rgMatchService.autoLinkVisit()` |
| 6.2 | Normalização de endereço para matching flexível |
| 6.3 | Atualizar contadores (`visitedCount`, `pendingCount`) na quadra |
| 6.4 | Toast informativo: "Imóvel Rua X, 123 marcado como visitado" |
| 6.5 | Permitir vinculação manual (se auto-match falhar) |

**Algoritmo de match:**

```typescript
function normalizeForMatch(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/\b(rua|av|avenida|travessa|alameda|praca)\b\.?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Match exato: bairro + logradouro + número (normalizado)
// Match parcial: logradouro + número (sem bairro, para cobrir geocoding impreciso)
```

### FASE 7 — Integração com Análises e Histórico

**Objetivo:** Vincular o RG aos dashboards e permitir drill-down.

| # | Tarefa |
|---|--------|
| 7.1 | No Painel Geral: card "Cobertura RG" com % e link para a página |
| 7.2 | No Operacional: coluna "Imóveis RG visitados" por agente |
| 7.3 | Histórico de visitas por residência (timeline no modal do imóvel) |
| 7.4 | Exportação de dados do RG com status de visitas |

---

## 5. Estrutura de Arquivos

```
src/
├── types/
│   └── registro-geografico.ts           ← NOVO
├── services/
│   ├── rgService.ts                     ← NOVO
│   ├── rgImportService.ts              ← NOVO
│   └── rgMatchService.ts              ← NOVO
├── components/
│   └── pages/
│       └── RegistroGeografico.tsx       ← NOVO (componente principal com tabs)
├── app/
│   └── (auth)/
│       └── registro-geografico/
│           └── page.tsx                ← NOVO (rota)
└── hooks/
    └── useRegistroGeografico.ts        ← NOVO (opcional, se necessário para estado)
```

---

## 6. Impacto em Arquivos Existentes

| Arquivo | Alteração |
|---------|-----------|
| `src/components/Layout.tsx` | Adicionar item "Registro Geográfico" no `navigationItems` |
| `src/components/pages/Visits.tsx` | Chamar `rgMatchService.autoLinkVisit()` no `handleSubmit` |
| `src/components/pages/Dashboard.tsx` | Card resumo de cobertura RG (Fase 7) |
| `src/components/pages/OperationalPanel.tsx` | Coluna de imóveis visitados por agente (Fase 7) |
| `package.json` | Adicionar dependência `xlsx` |

---

## 7. Segurança

### Regras Firestore (quando produção for configurada)

```javascript
// geographic_registries — apenas supervisor/admin da org
match /geographic_registries/{rgId} {
  allow read: if isAuthenticated() && belongsToOrg(resource.data.organizationId);
  allow create, update, delete: if isAuthenticated()
    && belongsToOrg(resource.data.organizationId)
    && hasRole(['supervisor', 'administrator']);
}

// rg_blocks — leitura para todos da org, escrita para supervisor/admin
match /rg_blocks/{blockId} {
  allow read: if isAuthenticated() && belongsToOrg(resource.data.organizationId);
  allow write: if isAuthenticated()
    && belongsToOrg(resource.data.organizationId)
    && hasRole(['supervisor', 'administrator']);
}

// rg_properties — leitura para todos, atualização de status para agentes também
match /rg_properties/{propId} {
  allow read: if isAuthenticated() && belongsToOrg(resource.data.organizationId);
  allow create, delete: if isAuthenticated()
    && belongsToOrg(resource.data.organizationId)
    && hasRole(['supervisor', 'administrator']);
  allow update: if isAuthenticated()
    && belongsToOrg(resource.data.organizationId);
}
```

### Validações de Upload

- Limite de tamanho: **5 MB** máximo por arquivo
- Extensões aceitas: `.xlsx`, `.xls`
- Máximo de **10.000 linhas** por importação (para evitar timeout do batch write)
- Sanitização de todos os campos de texto (XSS prevention)

---

## 8. Offline

O RG é primariamente uma feature de gestão (supervisor/admin), mas:

- **Leitura:** Cache via `withOfflineRead` (mesmo padrão dos ovitraps)
- **Match automático:** Se offline, o match será tentado contra dados cacheados localmente. Se não houver cache, a vinculação fica pendente e é processada no próximo sync.
- **Upload de Excel:** Requer conexão (o batch write no Firestore precisa de network)

---

## 9. Ordem de Execução Recomendada

```
Fase 1 ──► Fase 2 ──► Fase 3 ──► Fase 4 ──► Fase 5 ──► Fase 6 ──► Fase 7
 Types     Sidebar     Upload     Quadras    Cobertura   Vincular   Analytics
 Service    Rota       Import     Imóveis     Stats      Visitas    Dashboard
  CRUD      Shell      Excel      UI          KPIs       Match      Integrar
```

**Sugestão de entrega incremental:**

| Marco | Fases | Entrega |
|-------|-------|---------|
| **MVP** | 1 + 2 + 3 | Sidebar + Upload de Excel + lista de RGs |
| **v1** | + 4 | Navegação hierárquica por quadras e imóveis |
| **v2** | + 5 | Dashboard de cobertura com KPIs |
| **v3** | + 6 + 7 | Vinculação automática e integração com dashboards |

---

## 10. Dependências Externas

| Pacote | Versão | Uso |
|--------|--------|-----|
| `xlsx` | ^0.18.x | Parsing de arquivos .xlsx/.xls client-side |

> Alternativa: usar `exceljs` se precisar de suporte avançado (estilização, streaming).  
> O `xlsx` (SheetJS) é mais leve (~300KB) e suficiente para parsing de leitura.
