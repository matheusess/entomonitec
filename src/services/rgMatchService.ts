import { getDocs, query, collection, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { IRGProperty, IVisitReference } from '@/types/registro-geografico';
import { linkVisitToProperty } from '@/services/rgService';

// ─── Address normalizer ────────────────────────────────────────

export function normalizeForMatch(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/\b(rua|av|avenida|r\.|travessa|alameda|praca|pca|via)\b\.?/gi, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeNumber(s: string): string {
  return s.replace(/[^0-9a-zA-Z]/g, '').toLowerCase().trim();
}

// ─── Find property by address ──────────────────────────────────

export async function findPropertyByAddress(
  orgId: string,
  bairro: string,
  logradouro: string,
  numero: string
): Promise<IRGProperty | null> {
  // Query by orgId + bairro (normalized)
  const normBairro = normalizeForMatch(bairro);
  const normLogradouro = normalizeForMatch(logradouro);
  const normNumero = normalizeNumber(numero);

  // We can't do full-text search on Firestore, so query by orgId
  // and filter client-side (acceptable since RG data per org is bounded)
  const q = query(
    collection(db, 'rg_properties'),
    where('organizationId', '==', orgId),
    where('status', '==', 'pending')
  );

  const snap = await getDocs(q);

  for (const d of snap.docs) {
    const data = d.data();
    const dbBairro = normalizeForMatch(String(data.bairro ?? ''));
    const dbLogradouro = normalizeForMatch(String(data.logradouro ?? ''));
    const dbNumero = normalizeNumber(String(data.numero ?? ''));

    const bairroMatch = dbBairro === normBairro || dbBairro.includes(normBairro) || normBairro.includes(dbBairro);
    const logradouroMatch = dbLogradouro === normLogradouro;
    const numeroMatch = dbNumero === normNumero;

    if (bairroMatch && logradouroMatch && numeroMatch) {
      return {
        id: d.id,
        rgId: data.rgId as string,
        blockId: data.blockId as string,
        organizationId: data.organizationId as string,
        bairro: data.bairro as string,
        logradouro: data.logradouro as string,
        numero: data.numero as string,
        cidade: data.cidade as string,
        uf: data.uf as string,
        cep: data.cep as string | undefined,
        status: data.status as IRGProperty['status'],
        visitCount: (data.visitCount as number) ?? 0,
        visitHistory: [],
        createdAt: new Date(),
      };
    }
  }

  return null;
}

// ─── Auto-link a visit to a property ─────────────────────────

export interface VisitLocationInfo {
  neighborhood?: string;
  street?: string;
  houseNumber?: string;
}

export async function autoLinkVisit(
  orgId: string,
  location: VisitLocationInfo,
  visitId: string,
  visitType: IVisitReference['visitType'],
  visitStatus: IVisitReference['status'],
  agentInfo: { id: string; name: string },
  visitDate: Date
): Promise<{ linked: boolean; propertyId?: string; propertyAddress?: string }> {
  if (!location.street || !location.houseNumber) {
    return { linked: false };
  }

  try {
    const property = await findPropertyByAddress(
      orgId,
      location.neighborhood ?? '',
      location.street,
      location.houseNumber
    );

    if (!property) return { linked: false };

    const visitRef: IVisitReference = {
      visitId,
      visitType,
      date: visitDate,
      agentId: agentInfo.id,
      agentName: agentInfo.name,
      status: visitStatus,
    };

    await linkVisitToProperty(property.id, visitRef);

    return {
      linked: true,
      propertyId: property.id,
      propertyAddress: `${property.logradouro}, ${property.numero}`,
    };
  } catch (err) {
    // Non-fatal — don't break visit submission if RG link fails
    console.warn('[rgMatchService] autoLinkVisit failed silently:', err);
    return { linked: false };
  }
}
