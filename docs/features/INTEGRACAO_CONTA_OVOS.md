# Integração com API Conta Ovos

## Visão Geral

Integração do sistema de Ovitrampas do Entomonitec com a API pública do [Conta Ovos](https://contaovos.com), permitindo:

1. **Buscar ovitrampas existentes** da API por estado/município para seleção no formulário
2. **Enviar leituras (contagens)** de ovitrampas para a API ao registrar visitas
3. **Instalar novas ovitrampas** na API ao criar uma nova identificação no sistema

---

## Estado Atual

### O que já existe

- **Select de ovitrampas**: busca ovitraps do Firebase (banco local) para selecionar
- **Criar nova ovitrampa**: formulário com 3 campos (nome, código, endereço), salva no Firebase
- **Formulário de visita**: situação, presença de larvas, manutenção, data, agente responsável
- **Modal de contagem**: preenchimento posterior de quantidade de ovos e larvas
- **Suporte offline**: ovitraps criadas offline são sincronizadas com Firebase quando online

### Modelos atuais

```typescript
// src/types/ovitrap.ts
interface IOvitrap {
  id: string;
  nome?: string;
  codigo?: string;
  endereco?: string;
  organizationId: string;
  isActive: boolean;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  createdBy: string;
}
```

```typescript
// src/types/visits.ts
interface OvitrampasVisitForm extends VisitFormBase {
  type: 'ovitrampas';
  dataVisita: Date;
  ovitrapId?: string;
  ovitrapNome?: string;
  ovitrapCodigo?: string;
  ovitrapEndereco?: string;
  propertyType: 'residential' | 'commercial' | 'institutional' | 'vacant';
  inspected: boolean;
  refused: boolean;
  closed: boolean;
  treatmentApplied: boolean;
  eliminationAction: boolean;
  larvaeFound: boolean;
  manutencaoRealizada: boolean;
  quantidadeOvos?: number;
  quantidadeLarvas?: number;
}
```

### Lacunas identificadas

| Campo necessário para API | Existe no modelo? | Ação |
|---------------------------|-------------------|------|
| `ovitrap_group_id`        | Não               | Adicionar a `IOvitrap` |
| `ovitrap_lat` / `ovitrap_lng` | Não (existe `currentLocation` no form) | Adicionar a `IOvitrap` |
| `counting_observation_id` | Não               | Adicionar a `OvitrampasVisitForm` |
| `counting_observation`    | Não               | Adicionar a `OvitrampasVisitForm` |
| Endereço detalhado (rua, número, bairro, setor, complemento) | Não (só `endereco` genérico) | Expandir `IOvitrap` |
| `ovitrap_responsable`     | Não               | Adicionar a `IOvitrap` |
| `ovitrap_block_id`        | Não               | Adicionar a `IOvitrap` |
| `counting_date_collect`   | Não               | Adicionar a `OvitrampasVisitForm` |
| Filtro por estado         | Não               | Adicionar ao fluxo de busca |

---

## API Conta Ovos — Referência

### 1. Buscar últimas contagens (GET)

**Endpoint:** `GET https://contaovos.com/pt-br/api/lastcountingpublic`

Retorna as últimas contagens lançadas por localização com dados da ovitrampa.

**Parâmetros (query string):**

| Parâmetro       | Descrição                                          | Exemplo                         |
|-----------------|----------------------------------------------------|---------------------------------|
| `state`         | Código do estado (UF)                              | `state=RJ`                      |
| `municipality`  | Nome do município                                  | `municipality=Ponta%20Pora`     |
| `country`       | Nome do país (default: "Brasil")                   | `country=Brasil`                |
| `page`          | Página da paginação (default: 1)                   | `page=2`                        |
| `id`            | Exibe ocorrências a partir do ID                   | `id=7876`                       |
| `date`          | Exibe a partir da data de inclusão                 | `date=2025-01-01`               |
| `date_collect`  | Exibe a partir da data de coleta                   | `date_collect=2024-12-12`       |

**Exemplos:**
```bash
curl -G -d "municipality=Ponta%20Pora" https://contaovos.com/pt-br/api/lastcountingpublic
curl -G -d "state=MG" https://contaovos.com/pt-br/api/lastcountingpublic
```

### 2. Enviar leitura / Instalar ovitrampa (POST)

**Endpoint:** `POST https://contaovos.com/pt-br/api/postcounting`

**Autenticação:** campo `key` no payload (API key)

#### 2a. Envio para ovitrampa existente

Todos os campos são **obrigatórios**:

```json
{
  "ovitrap_group_id": 97,
  "ovitrap_lat": -7.000000,
  "ovitrap_lng": -8.000000,
  "date": "2025-01-20",
  "counting_observation_id": 1,
  "counting_observation": "caso o counting_observation_id seja 9",
  "counting_eggs": 5
}
```

#### 2b. Instalar nova ovitrampa + envio

Campos obrigatórios: `ovitrap_lat`, `ovitrap_lng`, `ovitrap_group_id`

```json
{
  "ovitrap_group_id": 96,
  "ovitrap_address_district": "Distrito",
  "ovitrap_address_street": "Rua",
  "ovitrap_address_number": "Numero",
  "ovitrap_address_complement": "Complemento",
  "ovitrap_address_loc_inst": "",
  "ovitrap_lat": -7.000000,
  "ovitrap_lng": -8.000000,
  "ovitrap_address_sector": "Setor",
  "ovitrap_responsable": "Responsável",
  "ovitrap_block_id": "Quarteirão",
  "date": "2025-01-20",
  "counting_date_collect": "2025-01-27",
  "counting_observation_id": 1,
  "counting_observation": "caso o counting_observation_id seja 9",
  "counting_eggs": 5
}
```

#### Tabela de Observações (`counting_observation_id`)

| ID | Significado |
|----|-------------|
| 1  | Sem Observações |
| 2  | Intervalo entre instalação e coleta maior que o previsto |
| 3  | Ovitrampa ou paleta desaparecida |
| 4  | Ovitrampa ou paleta quebrada |
| 5  | Ovitrampa ou paleta removida |
| 6  | Ovitrampa seca |
| 7  | Casa fechada |
| 8  | Ovitrampa cheia de água |
| 9  | Ovitrampa com pouca água |
| 10 | Outra Observação |

> **Nota:** Quando `counting_observation_id = 10`, o campo `counting_observation` deve conter o texto descritivo.

---

## Plano de Implementação

### Fase 1 — Infraestrutura de API (Backend)

#### 1.1 Criar API Route proxy server-side

**Arquivo:** `src/app/api/contaovos/route.ts`

Proxy Next.js para não expor a API key no client-side. Dois handlers:

- `GET` → proxy para `lastcountingpublic` (buscar ovitraps)
- `POST` → proxy para `postcounting` (enviar leitura, com `key` injetada server-side)

```
Client (browser) → /api/contaovos (Next.js Route Handler) → https://contaovos.com/pt-br/api/*
                                                              ↑ key inserida aqui (server-side)
```

**Validações no proxy:**
- Sanitizar parâmetros de entrada (state, municipality, page)
- Validar payload do POST antes de repassar
- Rate limiting básico (opcional)
- Não logar a API key

#### 1.2 Variável de ambiente

Adicionar ao `.env.local`:

```env
CONTAOVOS_API_KEY=sua_chave_aqui
```

> **Importante:** SEM prefixo `NEXT_PUBLIC_` para que fique disponível apenas server-side.

#### 1.3 Criar service client-side

**Arquivo:** `src/services/contaOvosService.ts`

Service que chama `/api/contaovos` (rota interna) e expõe métodos tipados:

```typescript
class ContaOvosService {
  async getLastCounting(params: ContaOvosSearchParams): Promise<IContaOvosOvitrap[]>
  async postCounting(data: ContaOvosPostData): Promise<ContaOvosPostResponse>
  async installAndCount(data: ContaOvosInstallData): Promise<ContaOvosPostResponse>
}
```

---

### Fase 2 — Atualizar Tipos e Modelos

#### 2.1 Criar tipos da API externa

**Arquivo:** `src/types/contaovos.ts`

```typescript
// Resposta do GET /lastcountingpublic
export interface IContaOvosOvitrap {
  id: number;
  ovitrap_group_id: number;
  ovitrap_lat: number;
  ovitrap_lng: number;
  ovitrap_address_district?: string;
  ovitrap_address_street?: string;
  ovitrap_address_number?: string;
  ovitrap_address_complement?: string;
  ovitrap_address_sector?: string;
  ovitrap_responsable?: string;
  ovitrap_block_id?: string;
  date?: string;
  counting_date_collect?: string;
  counting_observation_id?: number;
  counting_eggs?: number;
  // ... demais campos retornados pela API
}

// Parâmetros de busca
export interface ContaOvosSearchParams {
  state?: string;        // UF: "RJ", "MG", etc.
  municipality?: string; // Nome do município
  country?: string;      // Default: "Brasil"
  page?: number;
  id?: number;
  date?: string;         // YYYY-MM-DD
  date_collect?: string; // YYYY-MM-DD
}

// Payload para envio de leitura (ovitrampa existente)
export interface ContaOvosPostData {
  ovitrap_group_id: number;
  ovitrap_lat: number;
  ovitrap_lng: number;
  date: string;                    // YYYY-MM-DD
  counting_observation_id: number; // 1-10
  counting_observation?: string;   // Obrigatório se observation_id = 10
  counting_eggs: number;
}

// Payload para instalação + leitura (nova ovitrampa)
export interface ContaOvosInstallData extends ContaOvosPostData {
  ovitrap_address_district?: string;
  ovitrap_address_street?: string;
  ovitrap_address_number?: string;
  ovitrap_address_complement?: string;
  ovitrap_address_loc_inst?: string;
  ovitrap_address_sector?: string;
  ovitrap_responsable?: string;
  ovitrap_block_id?: string;
  counting_date_collect?: string;  // YYYY-MM-DD
}

// Tabela de observações
export const COUNTING_OBSERVATIONS = [
  { id: 1,  label: 'Sem Observações' },
  { id: 2,  label: 'Intervalo entre instalação e coleta maior que o previsto' },
  { id: 3,  label: 'Ovitrampa ou paleta desaparecida' },
  { id: 4,  label: 'Ovitrampa ou paleta quebrada' },
  { id: 5,  label: 'Ovitrampa ou paleta removida' },
  { id: 6,  label: 'Ovitrampa seca' },
  { id: 7,  label: 'Casa fechada' },
  { id: 8,  label: 'Ovitrampa cheia de água' },
  { id: 9,  label: 'Ovitrampa com pouca água' },
  { id: 10, label: 'Outra Observação' },
] as const;
```

#### 2.2 Atualizar `IOvitrap`

**Arquivo:** `src/types/ovitrap.ts`

Novos campos para suportar a integração:

```typescript
export interface IOvitrap {
  // Campos existentes
  id: string;
  nome?: string;
  codigo?: string;
  endereco?: string;
  organizationId: string;
  isActive: boolean;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  createdBy: string;

  // Novos campos — Integração Conta Ovos
  contaOvosGroupId?: number;       // ovitrap_group_id da API
  lat?: number;                     // ovitrap_lat
  lng?: number;                     // ovitrap_lng
  district?: string;                // ovitrap_address_district (bairro)
  street?: string;                  // ovitrap_address_street (rua)
  addressNumber?: string;           // ovitrap_address_number
  complement?: string;              // ovitrap_address_complement
  sector?: string;                  // ovitrap_address_sector
  responsable?: string;             // ovitrap_responsable
  blockId?: string;                 // ovitrap_block_id (quarteirão)
  source?: 'local' | 'contaovos';   // Origem do registro
}
```

#### 2.3 Atualizar `OvitrampasVisitForm`

**Arquivo:** `src/types/visits.ts`

Novos campos para observação e integração:

```typescript
export interface OvitrampasVisitForm extends VisitFormBase {
  // ... campos existentes ...

  // Novos campos — Integração Conta Ovos
  countingObservationId?: number;    // 1-10
  countingObservation?: string;      // Texto livre quando id=10
  contaOvosGroupId?: number;         // ID do grupo na API
  countingDateCollect?: Date;        // Data da coleta
  contaOvosSynced?: boolean;         // Se já foi enviado para API
}
```

---

### Fase 3 — Buscar Ovitraps da API (GET)

#### 3.1 Fluxo de busca

```
┌─────────────────────────────────────────────────┐
│  Formulário de Ovitrampa                        │
│                                                 │
│  ┌─────────────────────────────────────┐        │
│  │ Estado: [  MG  ▼ ]  (default: org)  │        │
│  └─────────────────────────────────────┘        │
│           │                                      │
│           ▼ onChange → fetch API                 │
│  ┌─────────────────────────────────────┐        │
│  │ Identificação: [ Selecione ▼ ]      │        │
│  │   ├─ 🌐 OVT-001 • Escola A (API)   │        │
│  │   ├─ 🌐 OVT-002 • Praça B (API)    │        │
│  │   ├─ 📱 OVT-Local • Rua X (Local)  │        │
│  │   └─ ➕ Adicionar um novo           │        │
│  └─────────────────────────────────────┘        │
│                                                 │
└─────────────────────────────────────────────────┘
```

#### 3.2 Alterações na UI (`OvitrampasFormContent`)

1. **Adicionar Select de Estado** antes do Select de Identificação
   - Default: `user.organization.state` (UF da organização)
   - Lista de UFs brasileiras
   - onChange: busca ovitraps da API por estado

2. **Modificar Select de Identificação**
   - Mesclar ovitraps locais (Firebase) + ovitraps da API
   - Distinguir por badge/ícone: 🌐 API | 📱 Local
   - Manter opção "Adicionar um novo"

3. **Loading state** durante busca na API

#### 3.3 Mapeamento API → IOvitrap

```typescript
function mapContaOvosToOvitrap(apiItem: IContaOvosOvitrap): IOvitrap {
  return {
    id: `contaovos_${apiItem.id}`,
    nome: apiItem.ovitrap_responsable || '',
    codigo: `GRP-${apiItem.ovitrap_group_id}`,
    endereco: [
      apiItem.ovitrap_address_street,
      apiItem.ovitrap_address_number,
      apiItem.ovitrap_address_district
    ].filter(Boolean).join(', '),
    contaOvosGroupId: apiItem.ovitrap_group_id,
    lat: apiItem.ovitrap_lat,
    lng: apiItem.ovitrap_lng,
    source: 'contaovos',
    // ... demais campos
  };
}
```

---

### Fase 4 — Enviar Leitura para a API (POST)

#### 4.1 Quando enviar

O envio para a API Conta Ovos acontece em **dois momentos**:

1. **Ao salvar a visita** (`handleSubmit` no `Visits.tsx`) — quando a visita é registrada
2. **Ao preencher contagem** (`OvitrampasQuantitiesModal`) — quando ovos/larvas são informados

#### 4.2 Mapeamento do status da visita → observation_id

| Status no Entomonitec | `counting_observation_id` sugerido |
|------------------------|-------------------------------------|
| `inspected = true`     | Definido pelo usuário no novo select |
| `refused = true`       | 5 (removida) ou definido pelo usuário |
| `closed = true`        | 7 (casa fechada) |

> O ideal é que o usuário selecione explicitamente o tipo de observação.

#### 4.3 Adicionar Select de observação ao formulário

Novo card no `OvitrampasFormContent`:

```
┌────────────────────────────────────────┐
│ 📋 Observação da Coleta               │
│                                        │
│ [ Sem Observações              ▼ ]     │
│                                        │
│ (Se "Outra Observação" selecionada:)   │
│ [ Descreva a observação...       ]     │
└────────────────────────────────────────┘
```

#### 4.4 Payload montado automaticamente

Ao submeter a visita, o sistema monta o payload combinando:

```typescript
const payload: ContaOvosPostData = {
  ovitrap_group_id: form.contaOvosGroupId!,        // Do select de ovitrampa
  ovitrap_lat: currentLocation.latitude,            // GPS do dispositivo
  ovitrap_lng: currentLocation.longitude,            // GPS do dispositivo
  date: format(form.dataVisita, 'yyyy-MM-dd'),       // Data da visita
  counting_observation_id: form.countingObservationId || 1,
  counting_observation: form.countingObservation || '',
  counting_eggs: form.quantidadeOvos || 0,
};
```

---

### Fase 5 — Formulário de Nova Ovitrampa (Expandido)

#### 5.1 Campos atuais vs. campos necessários

| Campo atual       | Campo API                      | Ação          |
|-------------------|--------------------------------|---------------|
| `nome`            | `ovitrap_responsable`          | Manter        |
| `codigo`          | (sem correspondência direta)   | Manter        |
| `endereco`        | Decompor em campos detalhados  | Expandir      |
| —                 | `ovitrap_address_district`     | **Adicionar** |
| —                 | `ovitrap_address_street`       | **Adicionar** |
| —                 | `ovitrap_address_number`       | **Adicionar** |
| —                 | `ovitrap_address_complement`   | **Adicionar** |
| —                 | `ovitrap_address_sector`       | **Adicionar** |
| —                 | `ovitrap_responsable`          | **Adicionar** |
| —                 | `ovitrap_block_id`             | **Adicionar** |
| —                 | `ovitrap_lat` / `ovitrap_lng`  | **Auto (GPS)** |

#### 5.2 Novo layout do formulário de criação

```
┌──────────────────────────────────────────────────────┐
│ 📍 Nova Ovitrampa                                    │
│                                                       │
│ Nome/Código    [___________]  Código    [___________] │
│                                                       │
│ Responsável    [___________]  Quarteirão [__________] │
│                                                       │
│ Rua            [___________________]  Número [______] │
│                                                       │
│ Bairro/Distrito [___________]  Setor   [___________]  │
│                                                       │
│ Complemento    [___________________________________]   │
│                                                       │
│ 📌 Lat: -22.9068  Lng: -43.1729  (GPS automático)    │
│                                                       │
│                     [ Salvar nova ovitrampa ]          │
└──────────────────────────────────────────────────────┘
```

#### 5.3 Dupla gravação

Ao criar uma nova ovitrampa:

1. **Firebase** (local): salvar `IOvitrap` com todos os campos expandidos
2. **API Conta Ovos** (se online): `POST /api/contaovos` com payload de instalação

Se offline, o envio para a API fica em fila de pendentes e é sincronizado depois.

---

### Fase 6 — Contagem de Ovos (Modal existente)

#### 6.1 Alterações no `OvitrampasQuantitiesModal`

- Adicionar campo **"Data da coleta"** (`counting_date_collect`)
- Ao salvar, além de atualizar no Firebase, enviar `POST /api/contaovos` com:
  - `counting_eggs` = quantidade de ovos informada
  - `date` = data da visita original
  - `counting_date_collect` = data de coleta informada no modal

---

## Estrutura de Arquivos

### Novos arquivos

```
src/
  app/api/contaovos/
    route.ts                      ← Proxy server-side (GET + POST)
  services/
    contaOvosService.ts           ← Client service para /api/contaovos
  types/
    contaovos.ts                  ← Tipos da API Conta Ovos
```

### Arquivos modificados

```
src/
  types/
    ovitrap.ts                    ← Novos campos (lat, lng, groupId, endereço detalhado)
    visits.ts                     ← Novos campos (observationId, contaOvosSynced)
  services/
    ovitrapService.ts             ← Integrar criação com API Conta Ovos
  components/pages/
    Visits.tsx                    ← UI: select estado, select observação, formulário expandido
.env.local                        ← CONTAOVOS_API_KEY
```

---

## Ordem de Implementação

```
Fase 1: Infraestrutura
  1.1  src/types/contaovos.ts              → Tipos da API
  1.2  src/types/ovitrap.ts                → Atualizar IOvitrap
  1.3  src/types/visits.ts                 → Atualizar OvitrampasVisitForm
  1.4  .env.local                          → CONTAOVOS_API_KEY
  1.5  src/app/api/contaovos/route.ts      → Proxy seguro

Fase 2: Services
  2.1  src/services/contaOvosService.ts    → Client service
  2.2  src/services/ovitrapService.ts      → Expandir createOvitrap

Fase 3: UI — Busca
  3.1  Select de Estado no formulário
  3.2  Mesclar ovitraps API + locais no Select
  3.3  Loading states e tratamento de erros

Fase 4: UI — Formulário expandido
  4.1  Expandir formulário de criação (endereço detalhado)
  4.2  GPS automático (lat/lng)
  4.3  Dupla gravação (Firebase + API)

Fase 5: UI — Observações e envio
  5.1  Select de tipo de observação (counting_observation_id)
  5.2  Enviar leitura ao salvar visita
  5.3  Enviar contagem ao preencher ovos no modal

Fase 6: Sincronização offline
  6.1  Fila de envios pendentes para API Conta Ovos
  6.2  Sincronizar na reconexão
```

---

## Considerações de Segurança

1. **API Key server-side only**: A `CONTAOVOS_API_KEY` nunca é exposta ao client. Toda comunicação passa pelo proxy em `/api/contaovos`
2. **Validação de entrada**: O proxy valida e sanitiza todos os parâmetros antes de repassar à API
3. **CORS**: O proxy elimina problemas de CORS ao chamar a API externa
4. **Rate limiting**: Considerar implementar rate limiting no proxy para evitar abuso
5. **Dados sensíveis**: Lat/lng do GPS são dados sensíveis — já tratados pela política LGPD existente

## Considerações Técnicas

- A API `lastcountingpublic` é pública (não precisa de key para GET), mas o POST precisa
- O endpoint GET retorna dados paginados — implementar paginação ou carregar todas as páginas
- A organização (`IOrganization`) já possui `state` e `city`, que podem ser usados como defaults
- O `currentLocation` já está disponível no formulário — reutilizar para lat/lng
- O sistema offline existente (Dexie + pendingWrites) pode ser reutilizado para fila de envios à API
