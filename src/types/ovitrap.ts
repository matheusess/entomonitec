import { Timestamp } from 'firebase/firestore';

export interface IOvitrap {
  id: string;
  nome?: string;
  codigo?: string;
  endereco?: string;
  organizationId: string;
  isActive: boolean;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  createdBy: string;

  // Integração Conta Ovos
  contaOvosGroupId?: number;   // ovitrap_group_id na API
  lat?: number;                 // ovitrap_lat
  lng?: number;                 // ovitrap_lng
  district?: string;            // ovitrap_address_district
  street?: string;              // ovitrap_address_street
  addressNumber?: string;       // ovitrap_address_number
  complement?: string;          // ovitrap_address_complement
  sector?: string;              // ovitrap_address_sector
  responsable?: string;         // ovitrap_responsable
  blockId?: string;             // ovitrap_block_id
  source?: 'local' | 'contaovos'; // Origem do registro
}

export interface CreateOvitrapRequest {
  nome?: string;
  codigo?: string;
  endereco?: string;
  organizationId: string;
  createdBy: string;

  // Integração Conta Ovos
  contaOvosGroupId?: number;
  lat?: number;
  lng?: number;
  district?: string;
  street?: string;
  addressNumber?: string;
  complement?: string;
  sector?: string;
  responsable?: string;
  blockId?: string;
}

export interface UpdateOvitrapRequest {
  nome?: string;
  codigo?: string;
  endereco?: string;
  isActive?: boolean;
  contaOvosGroupId?: number;
  lat?: number;
  lng?: number;
  district?: string;
  street?: string;
  addressNumber?: string;
  complement?: string;
  sector?: string;
  responsable?: string;
  blockId?: string;
}
