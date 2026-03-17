# 📐 Arquitetura do Sistema — EntomoVigilância (Entomonitec)

> **Documentação Arquitetural Completa** com diagramas Mermaid  
> Gerada seguindo as regras de `.cursor/rules/` (base, code-standards, lgpd, security)  
> Versão: 2.1.1+a | Última atualização: Março 2026

---

## Sumário

1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Arquitetura de Alto Nível](#3-arquitetura-de-alto-nível)
4. [Estrutura de Pastas](#4-estrutura-de-pastas)
5. [Fluxo de Autenticação e Autorização](#5-fluxo-de-autenticação-e-autorização)
6. [Sistema de Roles (RBAC)](#6-sistema-de-roles-rbac)
7. [Multi-Tenancy e Isolamento de Dados](#7-multi-tenancy-e-isolamento-de-dados)
8. [Modelo de Dados (Firestore)](#8-modelo-de-dados-firestore)
9. [Fluxo de Visitas (Rotina e LIRAa)](#9-fluxo-de-visitas-rotina-e-liraa)
10. [Arquitetura de Serviços](#10-arquitetura-de-serviços)
11. [Hierarquia de Componentes](#11-hierarquia-de-componentes)
12. [Rotas e Navegação](#12-rotas-e-navegação)
13. [Conformidade LGPD](#13-conformidade-lgpd)
14. [Arquitetura de Segurança](#14-arquitetura-de-segurança)
15. [Fluxo de Convite de Usuários](#15-fluxo-de-convite-de-usuários)
16. [Sincronização Offline-First](#16-sincronização-offline-first)
17. [Pipeline de Upload de Fotos](#17-pipeline-de-upload-de-fotos)
18. [Arquitetura DevOps](#18-arquitetura-devops)
19. [Roadmap e Fases do Projeto](#19-roadmap-e-fases-do-projeto)

---

## 1. Visão Geral do Sistema

O **EntomoVigilância** é uma plataforma multi-tenant de vigilância entomológica para Secretarias Municipais de Saúde do Brasil. Permite a coleta, gestão e análise de dados de visitas de campo para controle de vetores (Aedes aegypti), seguindo os protocolos do Ministério da Saúde, incluindo o índice LIRAa.

```mermaid
graph TB
    subgraph "👥 Usuários"
        AG[🦟 Agente de Campo]
        SV[👔 Supervisor]
        AD[⚙️ Administrador]
        SA[🛡️ Super Admin]
    end

    subgraph "📱 Plataforma EntomoVigilância"
        WEB[Aplicação Web<br/>Next.js 15 + React 19]
    end

    subgraph "☁️ Firebase Backend"
        AUTH[Firebase Auth]
        FS[Firestore DB]
        ST[Firebase Storage]
    end

    subgraph "🗺️ Serviços Externos"
        GEO[OpenStreetMap<br/>Nominatim]
        EMAIL[Brevo / Resend<br/>Email Service]
    end

    AG -->|Registra Visitas| WEB
    SV -->|Monitora Equipe| WEB
    AD -->|Gerencia Organização| WEB
    SA -->|Administra Sistema| WEB

    WEB <-->|Autenticação| AUTH
    WEB <-->|Dados| FS
    WEB <-->|Fotos| ST
    WEB <-->|Geocodificação| GEO
    WEB -->|Convites| EMAIL
```

---

## 2. Stack Tecnológico

```mermaid
graph LR
    subgraph "Frontend"
        NEXT[Next.js 15]
        REACT[React 19]
        TS[TypeScript 5]
        TW[Tailwind CSS 3]
        SHADCN[shadcn/ui + Radix]
    end

    subgraph "Estado"
        RQ[TanStack React Query 5]
        ZS[Zustand 5]
        RHF[React Hook Form 7]
    end

    subgraph "Mapas & Gráficos"
        LF[Leaflet + react-leaflet]
        RC[Recharts 3]
        HM[leaflet.heat]
    end

    subgraph "Backend"
        FA[Firebase Auth]
        FS[Firestore]
        FST[Firebase Storage]
        FAD[firebase-admin]
    end

    subgraph "Email"
        BV[Brevo API]
        RS[Resend API]
        FE[Firebase Email Ext.]
    end

    NEXT --> REACT
    REACT --> TS
    NEXT --> TW
    TW --> SHADCN
    REACT --> RQ
    REACT --> ZS
    REACT --> RHF
    REACT --> LF
    REACT --> RC
    NEXT --> FA
    NEXT --> FS
    NEXT --> FST
    NEXT --> FAD
    NEXT --> BV
    NEXT --> RS
```

---

## 3. Arquitetura de Alto Nível

```mermaid
C4Context
    title Diagrama de Contexto — EntomoVigilância

    Person(agent, "Agente de Campo", "Registra visitas, coleta amostras, upload de fotos")
    Person(supervisor, "Supervisor", "Monitora equipe, analisa indicadores")
    Person(admin, "Administrador", "Gerencia organização, usuários, configurações")
    Person(superadmin, "Super Admin", "Administra múltiplas organizações")

    System(entomo, "EntomoVigilância", "Plataforma Web de Vigilância Entomológica")

    System_Ext(firebase, "Firebase", "Auth + Firestore + Storage")
    System_Ext(maps, "OpenStreetMap", "Geocodificação e Tiles de Mapa")
    System_Ext(email, "Serviço de Email", "Brevo / Resend")

    Rel(agent, entomo, "Registra visitas")
    Rel(supervisor, entomo, "Monitora dados")
    Rel(admin, entomo, "Gerencia sistema")
    Rel(superadmin, entomo, "Administra plataforma")

    Rel(entomo, firebase, "Autenticação, Dados, Armazenamento")
    Rel(entomo, maps, "Geocodificação reversa")
    Rel(entomo, email, "Envio de convites")
```

---

## 4. Estrutura de Pastas

```mermaid
graph TD
    ROOT["📁 entomonitec-main"]

    ROOT --> SRC["📁 src/"]
    ROOT --> DOCS["📁 docs/"]
    ROOT --> PUBLIC["📁 public/"]
    ROOT --> SCRIPTS["📁 scripts/"]
    ROOT --> CURSOR["📁 .cursor/rules/"]

    SRC --> APP["📁 app/ <br/><i>Rotas Next.js</i>"]
    SRC --> COMP["📁 components/ <br/><i>Componentes React</i>"]
    SRC --> HOOKS["📁 hooks/ <br/><i>Custom Hooks</i>"]
    SRC --> SERVICES["📁 services/ <br/><i>Camada de Serviços</i>"]
    SRC --> TYPES["📁 types/ <br/><i>Interfaces TypeScript</i>"]
    SRC --> LIB["📁 lib/ <br/><i>Utilitários</i>"]

    APP --> AUTH_R["📁 (auth)/ login/ logout/"]
    APP --> API_R["📁 api/"]
    APP --> ORG_R["📁 organizations/"]
    APP --> SA_R["📁 super-admin/"]
    APP --> CS_R["📁 complete-signup/"]

    COMP --> PAGES["📁 pages/ <br/><i>Componentes de Página</i>"]
    COMP --> MODALS["📁 modals/ <br/><i>Modais</i>"]
    COMP --> UI["📁 ui/ <br/><i>shadcn/ui</i>"]

    CURSOR --> BASE["base.mdc"]
    CURSOR --> CSTD["code-standards.mdc"]
    CURSOR --> LGPD["lgpd.mdc"]
    CURSOR --> SEC["security.mdc"]
```

---

## 5. Fluxo de Autenticação e Autorização

### 5.1 Login

```mermaid
sequenceDiagram
    participant U as Usuário
    participant LP as /login
    participant FA as Firebase Auth
    participant FS as Firestore
    participant AC as AuthContext
    participant AR as AutoRedirect

    U->>LP: Email + Senha
    LP->>FA: signInWithEmailAndPassword()
    FA-->>LP: ✅ JWT Token
    FA->>AC: onAuthStateChanged(user)
    AC->>FS: getDoc(users/{uid})

    alt Usuário existe no Firestore
        FS-->>AC: userData (role, org, permissions)
    else Usuário NÃO existe
        AC->>FS: Cria doc com role padrão
        Note over AC,FS: @entomonitec.com → super_admin<br/>Outros → agent
        FS-->>AC: userData criado
    end

    AC->>AR: role + organizationId
    
    alt agent
        AR->>U: Redirect → /visits
    else supervisor | admin | super_admin
        AR->>U: Redirect → /dashboard
    end
```

### 5.2 Guarda de Autenticação (useAuthGuard)

```mermaid
flowchart TD
    A[Requisição de Rota Protegida] --> B{Usuário Autenticado?}
    B -->|Não| C[Redirect → /login]
    B -->|Sim| D{Verificar Role?}
    D -->|Sim| E{Role Permitida?}
    D -->|Não| H{Verificar Org?}
    E -->|Não| F[Redirect → Rota Padrão]
    E -->|Sim| H
    H -->|Sim| I{OrgId Válida?}
    H -->|Não| J[✅ Acesso Permitido]
    I -->|Não| K[Redirect → Rota Padrão]
    I -->|Sim| J

    style C fill:#ff6b6b,color:#fff
    style F fill:#ff6b6b,color:#fff
    style K fill:#ff6b6b,color:#fff
    style J fill:#51cf66,color:#fff
```

---

## 6. Sistema de Roles (RBAC)

```mermaid
graph BT
    AG["🦟 agent<br/><i>Agente de Campo</i><br/>─────<br/>• Criar/ver próprias visitas<br/>• Upload de fotos<br/>• GPS e câmera"]
    SV["👔 supervisor<br/><i>Supervisor</i><br/>─────<br/>• Todas as do agente<br/>• Ver visitas da organização<br/>• Dashboard e métricas<br/>• Painel operacional"]
    AD["⚙️ administrator<br/><i>Administrador</i><br/>─────<br/>• Todas as do supervisor<br/>• Gerenciar usuários<br/>• Convidar usuários<br/>• Configurações da org"]
    SA["🛡️ super_admin<br/><i>Super Admin</i><br/>─────<br/>• Acesso cross-organization<br/>• Criar/gerenciar organizações<br/>• Administração do sistema<br/>• Visão global"]

    AG --> SV
    SV --> AD
    AD --> SA

    style AG fill:#74c0fc,color:#000
    style SV fill:#63e6be,color:#000
    style AD fill:#ffd43b,color:#000
    style SA fill:#ff8787,color:#000
```

### Matriz de Acesso por Rota

```mermaid
graph LR
    subgraph "Rotas"
        R1["/visits"]
        R2["/dashboard"]
        R3["/collections"]
        R4["/operational"]
        R5["/settings"]
        R6["/super-admin"]
        R7["/organizations/slug"]
    end

    subgraph "Roles"
        AG2[agent]
        SV2[supervisor]
        AD2[administrator]
        SA2[super_admin]
    end

    AG2 -->|✅| R1
    AG2 -->|✅| R3

    SV2 -->|✅| R1
    SV2 -->|✅| R2
    SV2 -->|✅| R3
    SV2 -->|✅| R4

    AD2 -->|✅| R1
    AD2 -->|✅| R2
    AD2 -->|✅| R3
    AD2 -->|✅| R4
    AD2 -->|✅| R5

    SA2 -->|✅| R2
    SA2 -->|✅| R6
    SA2 -->|✅| R7

    style AG2 fill:#74c0fc,color:#000
    style SV2 fill:#63e6be,color:#000
    style AD2 fill:#ffd43b,color:#000
    style SA2 fill:#ff8787,color:#000
```

---

## 7. Multi-Tenancy e Isolamento de Dados

```mermaid
graph TB
    subgraph "🏛️ Organização A — Curitiba"
        UA1[Agente A1]
        UA2[Agente A2]
        UA3[Supervisor A]
        VA["Visitas Org A<br/>organizationId: org_a"]
    end

    subgraph "🏛️ Organização B — Fazenda Rio Grande"
        UB1[Agente B1]
        UB2[Supervisor B]
        VB["Visitas Org B<br/>organizationId: org_b"]
    end

    subgraph "🔒 Firestore Rules"
        FR["Validação: request.auth.token.organizationId<br/>== resource.data.organizationId"]
    end

    subgraph "🛡️ Super Admin"
        SA3["@entomonitec.com<br/>Acesso Global"]
    end

    UA1 --> VA
    UA2 --> VA
    UA3 --> VA
    UB1 --> VB
    UB2 --> VB

    VA -.->|❌ Bloqueado| VB
    VB -.->|❌ Bloqueado| VA

    SA3 -->|✅ Acesso| VA
    SA3 -->|✅ Acesso| VB

    FR -->|Garante| VA
    FR -->|Garante| VB

    style FR fill:#ff6b6b,color:#fff
    style SA3 fill:#ff8787,color:#000
```

> **Regra `.cursor/rules/security.mdc`**: Isolamento total por organização. NUNCA permitir acesso cross-organization. SEMPRE validar `organizationId` nas queries.

---

## 8. Modelo de Dados (Firestore)

### 8.1 Diagrama ER

```mermaid
erDiagram
    ORGANIZATIONS {
        string id PK
        string name
        string slug UK
        string fullName
        string state
        string city
        string department
        json contact
        boolean isActive
        json branding
        json features
        json healthMinistrySettings
        timestamp createdAt
        timestamp updatedAt
    }

    USERS {
        string id PK "Firebase UID"
        string name
        string email UK
        string role "agent|supervisor|administrator|super_admin"
        string organizationId FK
        array assignedNeighborhoods
        array permissions
        boolean isActive
        boolean mustChangePassword
        timestamp lastLoginAt
        timestamp createdAt
    }

    VISITS {
        string id PK
        string type "routine|liraa"
        string organizationId FK
        string userId FK
        string agentName
        json location "GPS + geocoding"
        string neighborhood
        array photoUrls
        string status "completed|pending|synced"
        string syncStatus
        boolean consentGiven
        timestamp consentDate
        timestamp createdAt
    }

    ROUTINE_VISIT {
        boolean larvaeFound
        boolean pupaeFound
        map breedingSites "boolean por tipo"
        array controlMeasures
        string riskLevel
    }

    LIRAA_VISIT {
        string propertyType
        int a1_count "Dep. águas elevados"
        int a2_count "Dep. água nível solo"
        int b_count "Dep. móveis"
        int c_count "Dep. fixos"
        int d1_count "Pneus"
        int d2_count "Outros removíveis"
        int e_count "Naturais"
        int positiveContainers
        string species
        string treatment
    }

    USER_INVITES {
        string id PK
        string email
        string name
        string role
        string organizationId FK
        string token "64-char hex"
        string status "pending|accepted|expired|cancelled"
        string invitedBy FK
        timestamp expiresAt "7 dias"
        timestamp createdAt
    }

    ALLOWED_EMAILS {
        string id PK
        string email
        string organizationId FK
        array allowedRoles
        string addedBy FK
        boolean isActive
    }

    ORGANIZATIONS ||--o{ USERS : "tem muitos"
    ORGANIZATIONS ||--o{ VISITS : "tem muitas"
    ORGANIZATIONS ||--o{ USER_INVITES : "tem muitos"
    ORGANIZATIONS ||--o{ ALLOWED_EMAILS : "tem muitos"
    USERS ||--o{ VISITS : "registra"
    USERS ||--o{ USER_INVITES : "convida"
    VISITS ||--|| ROUTINE_VISIT : "pode ser"
    VISITS ||--|| LIRAA_VISIT : "pode ser"
```

### 8.2 Políticas de Retenção (LGPD)

```mermaid
gantt
    title Períodos de Retenção de Dados (LGPD)
    dateFormat YYYY
    axisFormat %Y

    section Dados
    Visitas técnicas           :active, v, 2026, 5y
    Dados pessoais moradores   :active, d, 2026, 2y
    Logs de acesso             :active, la, 2026, 3y
    Logs de operações          :active, lo, 2026, 5y
```

> **Regra `.cursor/rules/lgpd.mdc`**: Visitas técnicas: 5 anos. Dados pessoais moradores: 2 anos após última visita. Logs de acesso: 3 anos. Logs de operações: 5 anos.

---

## 9. Fluxo de Visitas (Rotina e LIRAa)

### 9.1 Criação de Visita

```mermaid
sequenceDiagram
    participant AG as Agente
    participant VF as Formulário de Visita
    participant GPS as GPS/Geolocation API
    participant GEO as Nominatim API
    participant LS as localStorage
    participant VS as visitsService
    participant FS as Firestore
    participant ST as Firebase Storage

    AG->>VF: Inicia nova visita
    VF->>GPS: getCurrentPosition()
    GPS-->>VF: lat, lng, accuracy

    VF->>GEO: reverse(lat, lng)
    GEO-->>VF: Endereço, bairro, cidade

    AG->>VF: Preenche dados da visita
    AG->>VF: Registra consentimento LGPD ✅
    AG->>VF: Tira fotos (opcional)

    VF->>VF: Valida consentGiven === true

    alt Online
        VF->>VS: createVisit(data)
        VS->>ST: Upload fotos (comprimidas)
        ST-->>VS: photoUrls[]
        VS->>FS: addDoc(visits, {...data, photoUrls})
        FS-->>VS: visitId
        VS-->>VF: ✅ Visita salva
    else Offline
        VF->>LS: Salva na fila offline
        LS-->>VF: ✅ Aguardando sync
        Note over LS,FS: Sync automático quando online
    end
```

### 9.2 Tipos de Visita

```mermaid
graph TB
    V[Nova Visita] --> |Tipo| T{Tipo de Visita}

    T -->|routine| R["🏠 Visita de Rotina<br/>─────<br/>• Inspeção de imóvel<br/>• Criadouros (booleano por tipo)<br/>• Larvas / Pupas encontradas<br/>• Medidas de controle<br/>• Nível de risco calculado"]

    T -->|liraa| L["📊 Visita LIRAa<br/>─────<br/>• Protocolo Ministério da Saúde<br/>• Contagem por tipo de depósito:<br/>  A1: Dep. águas elevados<br/>  A2: Dep. água nível solo<br/>  B: Dep. móveis<br/>  C: Dep. fixos<br/>  D1: Pneus<br/>  D2: Outros removíveis<br/>  E: Naturais<br/>• Recipientes positivos<br/>• Espécie identificada<br/>• Tratamento aplicado"]

    R --> SAVE[💾 Salvar com<br/>organizationId + userId<br/>+ GPS + consentimento LGPD]
    L --> SAVE

    style R fill:#74c0fc,color:#000
    style L fill:#63e6be,color:#000
    style SAVE fill:#ffd43b,color:#000
```

---

## 10. Arquitetura de Serviços

```mermaid
graph TB
    subgraph "📱 Componentes React"
        PAGES[Pages / Forms]
        DASH[Dashboard]
        MAP[Mapas]
    end

    subgraph "🔌 Hooks"
        UV[useVisits]
        UA[useAuthGuard]
        UPH[usePhotoUpload]
        UBL[useBrazilianLocations]
        UN[useNotification]
    end

    subgraph "⚙️ Camada de Serviços"
        direction TB
        VS[visitsService<br/><i>Offline-first + sync</i>]
        FVS[firebaseVisitsService<br/><i>CRUD Firestore</i>]
        FDS[firebaseDashboardService<br/><i>Agregação dashboard</i>]
        OS[operationalService<br/><i>Métricas operacionais</i>]
        US[userService<br/><i>CRUD usuários</i>]
        UIS[userInviteService<br/><i>Ciclo de convites</i>]
        ORS[organizationService<br/><i>CRUD organizações</i>]
        ES[emailService<br/><i>Brevo API</i>]
        RES[resendEmailService<br/><i>Resend via API route</i>]
        FES[firebaseEmailService<br/><i>Firebase Email Ext.</i>]
        FPS[firebasePhotoService<br/><i>Upload + compressão</i>]
        GS[geocodingService<br/><i>Nominatim + cache</i>]
        NS[neighborhoodService<br/><i>Bairros por cidade</i>]
        ZMS[zoneMappingService<br/><i>Zonas geográficas</i>]
        AES[allowedEmailService<br/><i>Whitelist por org</i>]
    end

    subgraph "☁️ Firebase"
        AUTH[Auth]
        FSTORE[Firestore]
        STORAGE[Storage]
    end

    subgraph "🌐 Externo"
        NOM[Nominatim API]
        BREVO[Brevo API]
        RESEND[Resend API]
    end

    PAGES --> UV
    PAGES --> UA
    PAGES --> UPH
    PAGES --> UBL
    DASH --> FDS
    MAP --> GS

    UV --> VS
    VS --> FVS
    UPH --> FPS
    FVS --> FSTORE
    FDS --> FSTORE
    OS --> FSTORE
    US --> FSTORE
    UIS --> FSTORE
    ORS --> FSTORE
    FPS --> STORAGE
    GS --> NOM
    ES --> BREVO
    RES --> RESEND
    FES --> FSTORE
    UIS --> ES
    UIS --> RES
    UIS --> FES
    AES --> FSTORE

    UA --> AUTH
```

---

## 11. Hierarquia de Componentes

```mermaid
graph TD
    ROOT["RootLayout<br/>(layout.tsx)"]
    PROV["Providers<br/>QueryClient + Tooltip +<br/>AuthProvider + Toasters"]

    ROOT --> PROV

    PROV --> HOME["/ HomePage<br/>AutoRedirect"]
    PROV --> LOGIN["/login<br/>LoginPage"]
    PROV --> LOGOUT["/logout<br/>LogoutPage"]
    PROV --> SIGNUP["/complete-signup<br/>CompleteSignupPage"]
    PROV --> SADMIN["/super-admin<br/>SuperAdminPage"]
    PROV --> LAYOUT["Layout<br/>(Sidebar + Header)"]

    SADMIN --> SAP["SuperAdminPanel"]
    SAP --> COM["CreateOrganizationModal"]

    LAYOUT --> DASHBOARD["/dashboard"]
    LAYOUT --> VISITS["/visits"]
    LAYOUT --> COLLECTIONS["/collections"]
    LAYOUT --> OPERATIONAL["/operational"]
    LAYOUT --> SETTINGS["/settings"]
    LAYOUT --> ORGDETAIL["/organizations/slug"]

    DASHBOARD --> SAP2["SuperAdminPanel<br/>(se super_admin)"]
    DASHBOARD --> RMAP["RiskMap /<br/>DiagnosticsMapComponent"]
    DASHBOARD --> CHARTS["Recharts<br/>Bar, Line, Pie, Area"]

    VISITS --> PHOTO["PhotoUpload +<br/>CameraModal"]
    VISITS --> LOC["LocationStatus +<br/>InteractiveMap"]
    VISITS --> VDM["VisitDetailsModal"]
    VISITS --> FBST["FirebaseStatus"]

    OPERATIONAL --> OCHARTS["Recharts<br/>Bar, Line, Pie"]

    ORGDETAIL --> UMM["UserManagementModal"]
    ORGDETAIL --> COM2["CreateOrganizationModal<br/>(modo edição)"]

    style ROOT fill:#339af0,color:#fff
    style PROV fill:#339af0,color:#fff
    style LAYOUT fill:#51cf66,color:#000
    style DASHBOARD fill:#ffd43b,color:#000
    style VISITS fill:#ffd43b,color:#000
```

---

## 12. Rotas e Navegação

```mermaid
stateDiagram-v2
    [*] --> Login: Acesso inicial

    Login --> AutoRedirect: Autenticação OK

    state AutoRedirect {
        [*] --> CheckRole
        CheckRole --> Visits: agent
        CheckRole --> Dashboard: supervisor
        CheckRole --> Dashboard: administrator
        CheckRole --> Dashboard: super_admin
    }

    AutoRedirect --> Dashboard
    AutoRedirect --> Visits

    state Dashboard {
        DashKPIs: KPIs e Métricas
        DashCharts: Gráficos
        DashMap: Mapa de Risco
        DashSA: SuperAdminPanel
    }

    state Visits {
        VisitList: Lista de Visitas
        VisitForm: Formulário
        VisitDetail: Detalhes
    }

    Dashboard --> Operational: Painel Operacional
    Dashboard --> Settings: Configurações (admin)
    Dashboard --> SuperAdmin: Super Admin Panel
    SuperAdmin --> OrgDetail: /organizations/slug

    Login --> CompleteSignup: Token de convite
    CompleteSignup --> Login: Signup concluído
    
    Dashboard --> Logout
    Visits --> Logout
    Logout --> Login
```

---

## 13. Conformidade LGPD

### 13.1 Fluxo de Consentimento

```mermaid
flowchart TD
    A[Agente inicia visita] --> B[Apresenta formulário<br/>de consentimento ao morador]
    B --> C{Morador consente?}

    C -->|Sim ✅| D[Registra:<br/>consentGiven: true<br/>consentDate: timestamp<br/>consentFormId: versão]
    C -->|Não ❌| E[Visita NÃO pode<br/>ser registrada com<br/>dados pessoais]

    D --> F[Coleta APENAS dados<br/>necessários]
    F --> G{Dados proibidos?}

    G -->|CPF, RG, Email pessoal| H[❌ BLOQUEADO<br/>Coleta desnecessária]
    G -->|Nome, Telefone, Relação| I[✅ Dados permitidos]

    I --> J{Fotos contêm<br/>pessoas identificáveis?}
    J -->|Sim| K[❌ BLOQUEADO<br/>Apenas imóveis e criadouros]
    J -->|Não| L[✅ Upload permitido]

    L --> M[💾 Salvar visita com<br/>organizationId isolado]

    style C fill:#ffd43b,color:#000
    style H fill:#ff6b6b,color:#fff
    style K fill:#ff6b6b,color:#fff
    style E fill:#ff8787,color:#fff
    style I fill:#51cf66,color:#fff
    style L fill:#51cf66,color:#fff
    style M fill:#339af0,color:#fff
```

### 13.2 Dados do Morador (Interface Obrigatória)

```mermaid
classDiagram
    class ResidentData {
        +string name ⚠️ OBRIGATÓRIO
        +string phone? OPCIONAL
        +string relationship ⚠️ OBRIGATÓRIO
        +boolean consentGiven ⚠️ OBRIGATÓRIO
        +Date consentDate ⚠️ OBRIGATÓRIO
        +string consentFormId? OPCIONAL
    }

    class DadosProibidos {
        -string cpf ❌ NUNCA COLETAR
        -string rg ❌ NUNCA COLETAR
        -string emailPessoal ❌ NUNCA COLETAR
        -foto pessoasIdentificaveis ❌ NUNCA CAPTURAR
    }

    note for ResidentData "Base Legal: Art. 7º, V da LGPD\nFinalidade: Vigilância Sanitária"
    note for DadosProibidos "Princípio da Minimização\nColetar apenas o necessário"
```

### 13.3 Direitos do Titular

```mermaid
flowchart LR
    T[Titular dos Dados] --> |Solicita| DR[Direitos LGPD]

    DR --> AC[📋 Acesso<br/>Ver seus dados]
    DR --> CO[✏️ Correção<br/>Corrigir dados]
    DR --> EL[🗑️ Eliminação<br/>Apagar dados]
    DR --> PO[📦 Portabilidade<br/>Exportar dados]

    AC --> P[Prazo: 15 dias úteis]
    CO --> P
    EL --> AN{Pode eliminar?}
    PO --> P

    AN -->|Sim| P
    AN -->|Dentro do prazo<br/>de retenção| ANON[Anonimizar<br/>ao invés de deletar]

    style T fill:#339af0,color:#fff
    style P fill:#51cf66,color:#fff
    style ANON fill:#ffd43b,color:#000
```

---

## 14. Arquitetura de Segurança

```mermaid
graph TB
    subgraph "🔐 Camada 1: Autenticação"
        JWT[Firebase Auth<br/>JWT Tokens]
        PWD[Email/Password<br/>Authentication]
        RESET[Password Reset<br/>Token 1h expiry]
    end

    subgraph "🛡️ Camada 2: Autorização (RBAC)"
        GUARD[useAuthGuard Hook]
        ROLES[4-Tier Role System]
        PERMS[Granular Permissions Array]
    end

    subgraph "🏰 Camada 3: Isolamento Multi-Tenant"
        RULES[Firebase Security Rules]
        ORGID[organizationId em TODA query]
        CROSS[❌ Cross-org BLOQUEADO]
    end

    subgraph "🔒 Camada 4: Proteção de Dados"
        CRYPTO[Criptografia em repouso]
        VALID[Validação de entrada]
        SANITIZE[Sanitização de inputs]
        ERRMASK[Mascaramento de erros]
    end

    subgraph "📝 Camada 5: Auditoria"
        ACCLOG[Logs de acesso]
        OPLOG[Logs de operações CRUD]
        MONITOR[Monitoramento de<br/>tentativas não autorizadas]
    end

    JWT --> GUARD
    GUARD --> RULES
    RULES --> CRYPTO
    CRYPTO --> ACCLOG

    style JWT fill:#339af0,color:#fff
    style GUARD fill:#51cf66,color:#000
    style RULES fill:#ffd43b,color:#000
    style CRYPTO fill:#ff922b,color:#000
    style ACCLOG fill:#ff6b6b,color:#fff
```

### Proibições de Segurança (`.cursor/rules/security.mdc`)

```mermaid
mindmap
  root((🚫 Proibições<br/>de Segurança))
    Dados
      NUNCA expor dados pessoais em logs
      NUNCA expor stack traces em produção
      NUNCA armazenar senhas em texto plano
      NUNCA confiar em dados do cliente sem validação
    Acesso
      NUNCA permitir acesso cross-organization
      NUNCA acessar rotas sem autenticação
      NUNCA ignorar validação de role
    API
      NUNCA expor API keys no cliente
      NUNCA retornar info sensível em erros
```

---

## 15. Fluxo de Convite de Usuários

```mermaid
sequenceDiagram
    participant AD as Admin
    participant UIS as UserInviteService
    participant FS as Firestore
    participant ES as EmailService
    participant API as /api/send-invite-email
    participant NV as Novo Usuário
    participant CS as /complete-signup
    participant FA as Firebase Auth

    AD->>UIS: Criar convite (email, name, role, orgId)
    UIS->>UIS: Gera token (64-char hex)
    UIS->>FS: Salva em user_invites<br/>status: pending, expiresAt: 7 dias

    alt Brevo (Primário)
        UIS->>ES: Envia email via Brevo API
    else Resend (Alternativo)
        UIS->>API: POST /api/send-invite-email
        API-->>NV: Email com link de convite
    else Firebase Email
        UIS->>FS: Escreve em collection 'mail'
    end

    ES-->>NV: 📧 Email com link:<br/>/complete-signup?token=xxx

    NV->>CS: Acessa link do convite
    CS->>FS: Valida token em user_invites
    FS-->>CS: ✅ Token válido + dados do convite

    NV->>CS: Define senha
    CS->>FA: createUserWithEmailAndPassword()
    FA-->>CS: ✅ Conta criada
    CS->>FS: Cria doc em 'users' com role/org do convite
    CS->>FS: Atualiza user_invites status: accepted

    CS->>NV: Redirect → /login
    NV->>NV: Login com nova conta
```

---

## 16. Sincronização Offline-First

```mermaid
stateDiagram-v2
    [*] --> Online: App iniciada

    state Online {
        [*] --> CriarVisita
        CriarVisita --> SalvarFirestore: Conectado
        SalvarFirestore --> VisitaSalva
    }

    state Offline {
        [*] --> CriarVisitaLocal
        CriarVisitaLocal --> SalvarLocalStorage: Sem conexão
        SalvarLocalStorage --> FilaSync: Adicionado à fila
    }

    Online --> Offline: Perda de conexão
    Offline --> Sincronizando: Conexão restaurada

    state Sincronizando {
        [*] --> LerFila
        LerFila --> EnviarPendentes: Para cada item
        EnviarPendentes --> UploadFotos
        UploadFotos --> SalvarFirestore2
        SalvarFirestore2 --> LimparFila
        LimparFila --> [*]
    }

    Sincronizando --> Online: Fila vazia
```

```mermaid
flowchart LR
    A[Visita Criada] --> B{Online?}
    B -->|Sim| C[Firebase Firestore<br/>+ Storage]
    B -->|Não| D[localStorage<br/>Queue]
    D --> E{Conexão<br/>restaurada?}
    E -->|Sim| F[Sync automático]
    F --> C
    E -->|Não| D

    C --> G[✅ syncStatus: synced]
    D --> H[⏳ syncStatus: pending]

    style C fill:#51cf66,color:#000
    style D fill:#ffd43b,color:#000
    style H fill:#ff922b,color:#000
```

---

## 17. Pipeline de Upload de Fotos

```mermaid
flowchart TD
    A[📷 Agente captura foto] --> B{Tipo válido?<br/>JPEG/PNG/WebP}
    B -->|Não| C[❌ Tipo rejeitado]
    B -->|Sim| D{Tamanho ≤ 5MB?}
    D -->|Não| E[❌ Arquivo muito grande]
    D -->|Sim| F[🔄 Compressão via Canvas]

    F --> G[Redimensionar<br/>max 1920px]
    G --> H[Redução iterativa<br/>de qualidade]
    H --> I{Resultado ≤ 1MB?}
    I -->|Não| H
    I -->|Sim| J{Online?}

    J -->|Sim| K[☁️ Upload Firebase Storage<br/>com progresso]
    J -->|Não| L[💾 Armazena base64<br/>em localStorage]

    K --> M[📎 photoUrl retornada]
    L --> N[⏳ Upload quando online]

    style C fill:#ff6b6b,color:#fff
    style E fill:#ff6b6b,color:#fff
    style M fill:#51cf66,color:#000
    style N fill:#ffd43b,color:#000
```

> **Regra `.cursor/rules/security.mdc`**: NUNCA fotografar pessoas identificáveis — apenas imóveis e criadouros. Validar tipos de arquivo antes de upload.

---

## 18. Arquitetura DevOps

```mermaid
graph TB
    subgraph "🔨 Desenvolvimento"
        DEV[next dev -H 0.0.0.0]
        NGROK[ngrok tunnel<br/>Dev mobile]
        CERTS[Certificados HTTPS<br/>locais]
    end

    subgraph "🚀 Deploy"
        VERCEL[Vercel<br/>Hosting Next.js]
        SSL[SSL/TLS<br/>Let's Encrypt]
    end

    subgraph "☁️ Firebase (Produção)"
        FP[entomonitec<br/>Firebase Project]
        FAUTH[Firebase Auth]
        FFS[Firestore]
        FST[Firebase Storage]
    end

    subgraph "🌐 DNS (Planejado)"
        DDEV[dev.entomonitec.com.br]
        DHOM[homolog.entomonitec.com.br]
        DPROD[app.entomonitec.com.br]
    end

    subgraph "📊 Monitoramento (Planejado)"
        SENTRY[Sentry<br/>Error Tracking]
        VANALYTICS[Vercel Analytics]
        UPTIME[UptimeRobot<br/>Disponibilidade]
    end

    DEV --> VERCEL
    NGROK --> DEV
    VERCEL --> SSL
    VERCEL --> FP
    FP --> FAUTH
    FP --> FFS
    FP --> FST

    DDEV -.-> VERCEL
    DHOM -.-> VERCEL
    DPROD -.-> VERCEL

    VERCEL -.-> SENTRY
    VERCEL -.-> VANALYTICS
    VERCEL -.-> UPTIME

    style VERCEL fill:#339af0,color:#fff
    style FP fill:#ff922b,color:#000
```

### Ambientes Planejados

```mermaid
graph LR
    subgraph "DEV"
        D1[dev.entomonitec.com.br]
        D2[Firebase DEV Project]
        D3[Regras relaxadas]
    end

    subgraph "HOMOLOG"
        H1[homolog.entomonitec.com.br]
        H2[Firebase HOMOLOG Project]
        H3[Regras prod-like]
    end

    subgraph "PRODUÇÃO"
        P1[app.entomonitec.com.br]
        P2[Firebase PROD Project]
        P3[Regras rígidas]
    end

    D1 -->|Aprovação| H1
    H1 -->|Validação| P1

    style D1 fill:#74c0fc,color:#000
    style H1 fill:#ffd43b,color:#000
    style P1 fill:#51cf66,color:#000
```

---

## 19. Roadmap e Fases do Projeto

```mermaid
timeline
    title Roadmap EntomoVigilância
    
    section Fase 1 — MVP ✅
        2024-2025 : Auth Firebase + Login
                   : Visitas Rotina + LIRAa
                   : Dashboard com métricas
                   : Multi-tenancy
                   : Mapas Leaflet + GPS
                   : Upload de fotos
                   : Sistema de convites
                   : Sync offline-first

    section Fase 2 — Próximo 🔜
        2026 : Push notifications
             : Relatórios PDF
             : Gráficos interativos avançados
             : Integrações externas
             : Otimização de performance

    section Fase 3 — Futuro 🔮
        2026-2027 : Análise preditiva com IA
                  : Apps nativos iOS/Android
                  : Analytics avançados

    section Fase 4 — Escala 🚀
        2027+ : Caching + CDN
              : Auto-scaling
              : Conformidade LGPD completa
              : Disaster Recovery
              : Monitoramento 24/7
```

### Prioridades Atuais

```mermaid
quadrantChart
    title Matriz de Prioridade
    x-axis Baixo Esforço --> Alto Esforço
    y-axis Baixo Impacto --> Alto Impacto
    quadrant-1 Fazer Agora
    quadrant-2 Planejar
    quadrant-3 Delegar
    quadrant-4 Considerar
    Push Notifications: [0.3, 0.8]
    PDF Export: [0.4, 0.75]
    Performance Opt: [0.5, 0.7]
    Backups Auto: [0.35, 0.65]
    API Pública: [0.7, 0.6]
    App Mobile: [0.85, 0.9]
    IA Preditiva: [0.9, 0.8]
    CDN/Caching: [0.6, 0.5]
```

---

## Referências das Regras `.cursor/rules/`

| Arquivo | Escopo |
|---------|--------|
| `base.mdc` | Contexto do projeto, princípios gerais, conformidade LGPD, multi-tenancy, estrutura |
| `code-standards.mdc` | Padrões TypeScript, React/Next.js, Firebase, estrutura de dados, nomenclatura |
| `lgpd.mdc` | Coleta de dados, consentimento, segurança, direitos do titular, retenção |
| `security.mdc` | Autenticação, autorização, criptografia, auditoria, segurança mobile |

---

> **Documento gerado seguindo as diretrizes definidas em `.cursor/rules/`**  
> Base legal: Art. 7º, V da LGPD — interesse público em vigilância sanitária e controle de vetores
