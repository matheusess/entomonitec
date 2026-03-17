import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { withOfflineRead, withOfflineWrite } from '@/lib/firebaseWrapper';
import logger from '@/lib/logger';
import {
  IOvitrap,
  CreateOvitrapRequest,
  UpdateOvitrapRequest,
} from '@/types/ovitrap';

class OvitrapService {
  private readonly COLLECTION_NAME = 'ovitraps';

  async createOvitrap(data: CreateOvitrapRequest): Promise<IOvitrap> {
    const result = await withOfflineWrite(
      {
        type: 'add',
        collection: this.COLLECTION_NAME,
        data: data as unknown as Record<string, unknown>,
        cacheKey: `ovitraps_org_${data.organizationId}`,
      },
      async () => {
        const docData = {
          ...data,
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        const docRef = await addDoc(collection(db, this.COLLECTION_NAME), docData);
        logger.log('✅ Ovitrap criada no Firebase:', docRef.id);
        return { id: docRef.id, ...docData } as unknown as IOvitrap;
      },
    );

    if (!result) {
      throw new Error('Falha ao criar ovitrap');
    }
    return result;
  }

  async getOvitraps(organizationId: string): Promise<IOvitrap[]> {
    const result = await withOfflineRead<IOvitrap[]>(
      `ovitraps_org_${organizationId}`,
      this.COLLECTION_NAME,
      async () => {
        const q = query(
          collection(db, this.COLLECTION_NAME),
          where('organizationId', '==', organizationId),
          orderBy('createdAt', 'desc'),
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as IOvitrap));
      },
    );
    return result ?? [];
  }

  async getOvitrapById(id: string): Promise<IOvitrap | null> {
    try {
      const docRef = doc(db, this.COLLECTION_NAME, id);
      const snapshot = await getDoc(docRef);
      if (!snapshot.exists()) return null;
      return { id: snapshot.id, ...snapshot.data() } as IOvitrap;
    } catch (error) {
      logger.error('Erro ao buscar ovitrap:', error);
      return null;
    }
  }

  async updateOvitrap(id: string, data: UpdateOvitrapRequest): Promise<void> {
    await withOfflineWrite(
      {
        type: 'update',
        collection: this.COLLECTION_NAME,
        docId: id,
        data: data as unknown as Record<string, unknown>,
      },
      async () => {
        const docRef = doc(db, this.COLLECTION_NAME, id);
        await updateDoc(docRef, {
          ...data,
          updatedAt: serverTimestamp(),
        });
        logger.log('✅ Ovitrap atualizada:', id);
      },
    );
  }

  async deleteOvitrap(id: string): Promise<void> {
    await withOfflineWrite(
      {
        type: 'delete',
        collection: this.COLLECTION_NAME,
        docId: id,
      },
      async () => {
        const docRef = doc(db, this.COLLECTION_NAME, id);
        await deleteDoc(docRef);
        logger.log('✅ Ovitrampa removida:', id);
      },
    );
  }
}

export const ovitrapService = new OvitrapService();
