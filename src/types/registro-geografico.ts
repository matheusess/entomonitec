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

export interface IVisitReference {
  visitId: string;
  visitType: 'routine' | 'liraa' | 'ovitrampas';
  date: Date;
  agentId: string;
  agentName: string;
  status: 'completed' | 'refused' | 'closed';
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

// ─── Upload / Import ──────────────────────────────────────────

export interface RGExcelRow {
  bairro: string;
  logradouro: string;
  numero: string;
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

// Preview row (with validation state, for UI)
export interface RGPreviewRow extends RGExcelRow {
  rowIndex: number;
  errors: RGImportError[];
  isValid: boolean;
}

// ─── Estatísticas / Dashboard ─────────────────────────────────

export interface BlockCoverage {
  blockId: string;
  bairro: string;
  logradouro: string;
  total: number;
  visited: number;
  refused: number;
  closed: number;
  pending: number;
  percent: number;
}

export interface RGStats {
  totalBlocks: number;
  totalProperties: number;
  visitedProperties: number;
  pendingProperties: number;
  refusedProperties: number;
  closedProperties: number;
  coveragePercent: number; // visitedProperties / totalProperties * 100
  blockCoverage: BlockCoverage[];
}
