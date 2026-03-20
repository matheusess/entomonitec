export interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
  accuracy: number;
  timestamp: Date;
  geocodingData?: {
    street: string;
    houseNumber: string;
    neighborhood: string;
    city: string;
    state: string;
    country: string;
    postcode: string;
    fullAddress: string;
  };
}

export interface BreedingSite {
  id: string;
  visitaId: string;
  tipoRecipiente: string;
  presencaLarvas: boolean;
  quantidadeLarvas?: number;
  observacoes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VisitFormBase {
  id: string;
  type: 'routine' | 'liraa' | 'ovitrampas';
  timestamp: Date;
  location: LocationData | null;
  neighborhood: string;
  agentName: string;
  agentId: string;
  userId: string; // Campo necessário para as regras do Firebase
  organizationId: string;
  observations: string;
  photos: string[];
  status: 'completed' | 'refused' | 'closed';
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error';
  firebaseId?: string;
  syncError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoutineVisitForm extends VisitFormBase {
  type: 'routine';
  breedingSites: {
    waterReservoir: boolean;
    tires: boolean;
    bottles: boolean;
    cans: boolean;
    buckets: boolean;
    plantPots: boolean;
    gutters: boolean;
    pools: boolean;
    wells: boolean;
    tanks: boolean;
    drains: boolean;
    others: string;
  };
  larvaeFound: boolean;
  pupaeFound: boolean;
  controlMeasures: string[];
  calculatedRiskLevel?: 'low' | 'medium' | 'high' | 'critical';
}

export interface LIRAAVisitForm extends VisitFormBase {
  type: 'liraa';
  propertyType: 'residential' | 'commercial' | 'institutional' | 'vacant';
  inspected: boolean;
  refused: boolean;
  closed: boolean;
  containers: {
    a1: number; // Reservatórios de água
    a2: number; // Depósitos móveis
    b: number;  // Depósitos fixos
    c: number;  // Passíveis de remoção
    d1: number; // Pneus
    d2: number; // Lixo
    e: number;  // Naturais
  };
  positiveContainers: {
    a1: number;
    a2: number;
    b: number;
    c: number;
    d1: number;
    d2: number;
    e: number;
  };
  larvaeFound: boolean;
  larvaeSpecies: string[];
  treatmentApplied: boolean;
  eliminationAction: boolean;
  liraaIndex?: number; // Índice calculado para o LIRAa
}
//TODO -> ajustar a interface para o tipo Ovitrampas, que tem campos diferentes do LIRAA, e criar um componente específico para esse tipo de visita (com os campos específicos)
export interface OvitrampasVisitForm extends VisitFormBase {
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
  // containers: {
  //   a1: number; // Reservatórios de água
  //   a2: number; // Depósitos móveis
  //   b: number;  // Depósitos fixos
  //   c: number;  // Passíveis de remoção
  //   d1: number; // Pneus
  //   d2: number; // Lixo
  //   e: number;  // Naturais
  // };
  // positiveContainers: {
  //   a1: number;
  //   a2: number;
  //   b: number;
  //   c: number;
  //   d1: number;
  //   d2: number;
  //   e: number;
  // };
  // larvaeSpecies: string[];
  treatmentApplied: boolean;
  eliminationAction: boolean;
  liraaIndex?: number; // Índice calculado para o LIRAa

  larvaeFound: boolean;
  manutencaoRealizada: boolean;

  // Step 2 - Quantidade de ovos e larvas
  quantidadeOvos?: number;
  quantidadeLarvas?: number;
}

export type VisitForm = RoutineVisitForm | LIRAAVisitForm | OvitrampasVisitForm;

// Interfaces para criação de visitas
export interface CreateRoutineVisitRequest {
  neighborhood: string;
  location: LocationData;
  observations: string;
  photos: string[];
  breedingSites: {
    waterReservoir: boolean;
    tires: boolean;
    bottles: boolean;
    cans: boolean;
    buckets: boolean;
    plantPots: boolean;
    gutters: boolean;
    pools: boolean;
    wells: boolean;
    tanks: boolean;
    drains: boolean;
    others: string;
  };
  larvaeFound: boolean;
  pupaeFound: boolean;
  controlMeasures: string[];
}

export interface CreateLIRAAVisitRequest {
  neighborhood: string;
  location: LocationData;
  observations: string;
  photos: string[];
  propertyType: 'residential' | 'commercial' | 'institutional' | 'vacant';
  inspected: boolean;
  refused: boolean;
  closed: boolean;
  containers: {
    a1: number;
    a2: number;
    b: number;
    c: number;
    d1: number;
    d2: number;
    e: number;
  };
  positiveContainers: {
    a1: number;
    a2: number;
    b: number;
    c: number;
    d1: number;
    d2: number;
    e: number;
  };
  larvaeSpecies: string[];
  larvaeFound: boolean;
  treatmentApplied: boolean;
  eliminationAction: boolean;
}

export interface CreateOvitrampasVisitRequest {
  neighborhood: string;
  location: LocationData;
  observations: string;
  photos: string[];
  dataVisita: Date;
  ovitrapId?: string;
  ovitrapNome?: string;
  ovitrapCodigo?: string;
  ovitrapEndereco?: string;
  propertyType: 'residential' | 'commercial' | 'institutional' | 'vacant';
  inspected: boolean;
  refused: boolean;
  closed: boolean;
  larvaeFound: boolean;
  manutencaoRealizada: boolean;
  treatmentApplied: boolean;
  eliminationAction: boolean;
  quantidadeOvos?: number;
  quantidadeLarvas?: number;
}

// Interfaces para atualização
export interface UpdateVisitRequest {
  observations?: string;
  status?: 'completed' | 'refused' | 'closed';
  photos?: string[];
  quantidadeOvos?: number;
  quantidadeLarvas?: number;
  // Ovitrampas fields
  ovitrapId?: string;
  ovitrapNome?: string;
  ovitrapCodigo?: string;
  ovitrapEndereco?: string;
  inspected?: boolean;
  refused?: boolean;
  closed?: boolean;
  larvaeFound?: boolean;
  manutencaoRealizada?: boolean;
  dataVisita?: Date;
  neighborhood?: string;
}

// Interfaces para respostas da API
export interface VisitResponse {
  success: boolean;
  data?: VisitForm;
  message?: string;
  error?: string;
}

export interface VisitsListResponse {
  success: boolean;
  data?: VisitForm[];
  total?: number;
  page?: number;
  limit?: number;
  message?: string;
  error?: string;
}
