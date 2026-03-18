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
}

export interface CreateOvitrapRequest {
  nome?: string;
  codigo?: string;
  endereco?: string;
  organizationId: string;
  createdBy: string;
}

export interface UpdateOvitrapRequest {
  nome?: string;
  codigo?: string;
  endereco?: string;
  isActive?: boolean;
}
