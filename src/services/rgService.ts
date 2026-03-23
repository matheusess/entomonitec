import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  IGeographicRegistry,
  IRGBlock,
  IRGProperty,
  IVisitReference,
  PropertyStatus,
  RGStatus,
  RGStats,
  BlockCoverage,
} from '@/types/registro-geografico';

// ─── Helpers ──────────────────────────────────────────────────

function toDate(ts: unknown): Date {
  if (!ts) return new Date();
  if (ts instanceof Date) return ts;
  if (typeof ts === 'object' && 'toDate' in (ts as object)) {
    return (ts as Timestamp).toDate();
  }
  return new Date(ts as string);
}

function registryFromDoc(d: { id: string; data(): Record<string, unknown> }): IGeographicRegistry {
  const data = d.data();
  return {
    id: d.id,
    organizationId: data.organizationId as string,
    name: data.name as string,
    description: data.description as string | undefined,
    status: data.status as RGStatus,
    totalProperties: (data.totalProperties as number) ?? 0,
    totalBlocks: (data.totalBlocks as number) ?? 0,
    uploadedBy: data.uploadedBy as string,
    uploadedAt: toDate(data.uploadedAt),
    updatedAt: toDate(data.updatedAt),
    fileName: data.fileName as string | undefined,
    metadata: data.metadata as IGeographicRegistry['metadata'],
  };
}

function blockFromDoc(d: { id: string; data(): Record<string, unknown> }): IRGBlock {
  const data = d.data();
  return {
    id: d.id,
    rgId: data.rgId as string,
    organizationId: data.organizationId as string,
    bairro: data.bairro as string,
    logradouro: data.logradouro as string,
    totalProperties: (data.totalProperties as number) ?? 0,
    visitedCount: (data.visitedCount as number) ?? 0,
    pendingCount: (data.pendingCount as number) ?? 0,
    createdAt: toDate(data.createdAt),
  };
}

function propertyFromDoc(d: { id: string; data(): Record<string, unknown> }): IRGProperty {
  const data = d.data();
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
    complemento: data.complemento as string | undefined,
    nomeResponsavel: data.nomeResponsavel as string | undefined,
    lat: data.lat as number | undefined,
    lng: data.lng as number | undefined,
    status: (data.status as PropertyStatus) ?? 'pending',
    lastVisitId: data.lastVisitId as string | undefined,
    lastVisitAt: data.lastVisitAt ? toDate(data.lastVisitAt) : undefined,
    visitCount: (data.visitCount as number) ?? 0,
    visitHistory: ((data.visitHistory as unknown[]) ?? []).map((v) => {
      const vr = v as Record<string, unknown>;
      return {
        visitId: vr.visitId as string,
        visitType: vr.visitType as IVisitReference['visitType'],
        date: toDate(vr.date),
        agentId: vr.agentId as string,
        agentName: vr.agentName as string,
        status: vr.status as IVisitReference['status'],
      };
    }),
    createdAt: toDate(data.createdAt),
  };
}

// ─── Registries CRUD ─────────────────────────────────────────

export async function createRegistry(
  orgId: string,
  name: string,
  description?: string,
  fileName?: string,
  metadata?: IGeographicRegistry['metadata']
): Promise<string> {
  const ref = await addDoc(collection(db, 'geographic_registries'), {
    organizationId: orgId,
    name,
    description: description ?? '',
    status: 'draft',
    totalProperties: 0,
    totalBlocks: 0,
    uploadedBy: '',
    uploadedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    fileName: fileName ?? '',
    metadata: metadata ?? {},
  });
  return ref.id;
}

export async function getRegistries(orgId: string): Promise<IGeographicRegistry[]> {
  const q = query(
    collection(db, 'geographic_registries'),
    where('organizationId', '==', orgId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(registryFromDoc)
    .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
}

export async function getRegistryById(id: string): Promise<IGeographicRegistry | null> {
  const snap = await getDoc(doc(db, 'geographic_registries', id));
  if (!snap.exists()) return null;
  return registryFromDoc(snap);
}

export async function updateRegistryStatus(id: string, status: RGStatus): Promise<void> {
  await updateDoc(doc(db, 'geographic_registries', id), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function updateRegistryMeta(
  id: string,
  fields: Partial<Pick<IGeographicRegistry, 'name' | 'description' | 'totalProperties' | 'totalBlocks'>>
): Promise<void> {
  await updateDoc(doc(db, 'geographic_registries', id), {
    ...fields,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRegistry(id: string): Promise<void> {
  // Delete blocks
  const blocksSnap = await getDocs(
    query(collection(db, 'rg_blocks'), where('rgId', '==', id))
  );
  // Delete properties
  const propsSnap = await getDocs(
    query(collection(db, 'rg_properties'), where('rgId', '==', id))
  );

  const BATCH_SIZE = 499;
  const allDocs = [...blocksSnap.docs, ...propsSnap.docs];

  for (let i = 0; i < allDocs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    allDocs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  await deleteDoc(doc(db, 'geographic_registries', id));
}

// ─── Blocks ──────────────────────────────────────────────────

export async function getBlocks(rgId: string): Promise<IRGBlock[]> {
  const q = query(
    collection(db, 'rg_blocks'),
    where('rgId', '==', rgId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(blockFromDoc)
    .sort((a, b) => a.bairro.localeCompare(b.bairro) || a.logradouro.localeCompare(b.logradouro));
}

export async function updateBlockCounters(
  blockId: string,
  delta: { visitedDelta?: number; pendingDelta?: number }
): Promise<void> {
  const ref = doc(db, 'rg_blocks', blockId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  await updateDoc(ref, {
    visitedCount: Math.max(0, ((data.visitedCount as number) ?? 0) + (delta.visitedDelta ?? 0)),
    pendingCount: Math.max(0, ((data.pendingCount as number) ?? 0) + (delta.pendingDelta ?? 0)),
  });
}

// ─── Properties ──────────────────────────────────────────────

export async function getBlockProperties(blockId: string): Promise<IRGProperty[]> {
  const q = query(
    collection(db, 'rg_properties'),
    where('blockId', '==', blockId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(propertyFromDoc)
    .sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));
}

export async function getPropertiesByRg(rgId: string): Promise<IRGProperty[]> {
  const q = query(
    collection(db, 'rg_properties'),
    where('rgId', '==', rgId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(propertyFromDoc);
}

export async function getPropertyById(id: string): Promise<IRGProperty | null> {
  const snap = await getDoc(doc(db, 'rg_properties', id));
  if (!snap.exists()) return null;
  return propertyFromDoc(snap);
}

export async function updatePropertyStatus(
  propertyId: string,
  status: PropertyStatus,
  visitRef?: IVisitReference
): Promise<void> {
  const propRef = doc(db, 'rg_properties', propertyId);
  const snap = await getDoc(propRef);
  if (!snap.exists()) return;

  const data = snap.data();
  const prevStatus = (data.status as PropertyStatus) ?? 'pending';
  const visitHistory = (data.visitHistory as unknown[]) ?? [];
  const visitCount = (data.visitCount as number) ?? 0;

  const updateData: Record<string, unknown> = {
    status,
    updatedAt: serverTimestamp(),
  };

  if (visitRef) {
    updateData.lastVisitId = visitRef.visitId;
    updateData.lastVisitAt = Timestamp.fromDate(visitRef.date);
    updateData.visitCount = visitCount + 1;
    updateData.visitHistory = [
      ...visitHistory.slice(-9), // keep last 10
      {
        ...visitRef,
        date: Timestamp.fromDate(visitRef.date),
      },
    ];
  }

  await updateDoc(propRef, updateData);

  // Update block counters
  const blockId = data.blockId as string;
  const wasVisited = prevStatus === 'visited';
  const isNowVisited = status === 'visited';
  if (wasVisited !== isNowVisited) {
    await updateBlockCounters(blockId, {
      visitedDelta: isNowVisited ? 1 : -1,
      pendingDelta: isNowVisited ? -1 : 1,
    });
  }
}

export async function linkVisitToProperty(
  propertyId: string,
  visitRef: IVisitReference
): Promise<void> {
  await updatePropertyStatus(propertyId, 'visited', visitRef);
}

// ─── Stats ───────────────────────────────────────────────────

export async function getStats(rgId: string): Promise<RGStats> {
  const [blocks, properties] = await Promise.all([
    getBlocks(rgId),
    getPropertiesByRg(rgId),
  ]);

  const total = properties.length;
  const visited = properties.filter((p) => p.status === 'visited').length;
  const refused = properties.filter((p) => p.status === 'refused').length;
  const closed = properties.filter((p) => p.status === 'closed').length;
  const pending = total - visited - refused - closed;

  const blockCoverage: BlockCoverage[] = blocks.map((b) => {
    const blockProps = properties.filter((p) => p.blockId === b.id);
    const bVisited = blockProps.filter((p) => p.status === 'visited').length;
    const bRefused = blockProps.filter((p) => p.status === 'refused').length;
    const bClosed = blockProps.filter((p) => p.status === 'closed').length;
    const bPending = blockProps.length - bVisited - bRefused - bClosed;
    return {
      blockId: b.id,
      bairro: b.bairro,
      logradouro: b.logradouro,
      total: blockProps.length,
      visited: bVisited,
      refused: bRefused,
      closed: bClosed,
      pending: bPending,
      percent: blockProps.length > 0 ? Math.round((bVisited / blockProps.length) * 100) : 0,
    };
  });

  return {
    totalBlocks: blocks.length,
    totalProperties: total,
    visitedProperties: visited,
    pendingProperties: pending,
    refusedProperties: refused,
    closedProperties: closed,
    coveragePercent: total > 0 ? Math.round((visited / total) * 100) : 0,
    blockCoverage,
  };
}

const rgService = {
  createRegistry,
  getRegistries,
  getRegistryById,
  updateRegistryStatus,
  updateRegistryMeta,
  deleteRegistry,
  getBlocks,
  getBlockProperties,
  getPropertiesByRg,
  getPropertyById,
  updatePropertyStatus,
  linkVisitToProperty,
  getStats,
  updateBlockCounters,
};

export default rgService;
