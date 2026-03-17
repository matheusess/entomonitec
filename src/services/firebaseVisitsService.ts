import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { firebasePhotoService } from './firebasePhotoService';
import { withOfflineRead, withOfflineWrite, isOnline } from '@/lib/firebaseWrapper';
import logger from '@/lib/logger';
import { parseVisitTimestamp } from '@/lib/utils';
import {
  VisitForm,
  RoutineVisitForm,
  LIRAAVisitForm,
  CreateRoutineVisitRequest,
  CreateLIRAAVisitRequest,
  UpdateVisitRequest
} from '@/types/visits';
import { IUser } from '@/types/organization';

class FirebaseVisitsService {
  private readonly COLLECTION_NAME = 'visits';

  private normalizeVisitDocument(docId: string, data: Record<string, any>): VisitForm {
    return {
      ...data,
      id: docId,
      timestamp: parseVisitTimestamp(data.timestamp),
      createdAt: parseVisitTimestamp(data.createdAt),
      updatedAt: parseVisitTimestamp(data.updatedAt),
      location: data.location
        ? {
          ...data.location,
          timestamp: parseVisitTimestamp(data.location.timestamp),
        }
        : null,
    } as VisitForm;
  }

  // Criar visita no Firebase
  async createVisit(visit: VisitForm): Promise<{ id: string; photos: string[] }> {
    const localId = visit.id;
    const result = await withOfflineWrite(
      {
        type: 'add',
        collection: this.COLLECTION_NAME,
        localId,
        data: visit as unknown as Record<string, unknown>,
        cacheKey: `visits_org_${visit.organizationId}`,
      },
      async () => {
        const photos = visit.photos || [];
        const existingPhotoUrls = photos.filter(photo => photo.startsWith('http'));
        const base64Photos = photos.filter(photo => photo.startsWith('data:'));

        const visitData = {
          ...visit,
          photos: existingPhotoUrls,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, this.COLLECTION_NAME), visitData);
        logger.log('✅ Visita criada no Firebase:', docRef.id);

        if (base64Photos.length > 0) {
          try {
            logger.log('📸 Fazendo upload de fotos para o Storage...');
            const photoFiles = await this.convertBase64ToFiles(base64Photos);
            const uploadResults = await firebasePhotoService.uploadPhotos(photoFiles, docRef.id);
            const photoUrls = uploadResults.map(result => result.url);
            const allPhotoUrls = [...existingPhotoUrls, ...photoUrls];
            await updateDoc(docRef, { photos: allPhotoUrls, updatedAt: serverTimestamp() });
            logger.log('✅ Fotos enviadas para o Storage:', photoUrls.length);
            return { id: docRef.id, photos: allPhotoUrls };
          } catch (photoError) {
            logger.error('⚠️ Erro no upload das fotos, mas visita foi salva:', photoError);
            return { id: docRef.id, photos: existingPhotoUrls };
          }
        }

        return { id: docRef.id, photos: existingPhotoUrls };
      },
    );
    // Offline: return placeholder with local ID so callers get a stable reference
    return result ?? { id: localId, photos: visit.photos ?? [] };
  }

  // Atualizar visita no Firebase
  async updateVisit(visitId: string, updates: UpdateVisitRequest): Promise<void> {
    await withOfflineWrite(
      {
        type: 'update',
        collection: this.COLLECTION_NAME,
        docId: visitId,
        data: updates as unknown as Record<string, unknown>,
      },
      async () => {
        const visitRef = doc(db, this.COLLECTION_NAME, visitId);
        await updateDoc(visitRef, { ...updates, updatedAt: serverTimestamp() });
        logger.log('✅ Visita atualizada no Firebase:', visitId);
      },
    );
  }

  // Excluir visita do Firebase
  async deleteVisit(visitId: string): Promise<void> {
    await withOfflineWrite(
      {
        type: 'delete',
        collection: this.COLLECTION_NAME,
        docId: visitId,
      },
      async () => {
        const visitRef = doc(db, this.COLLECTION_NAME, visitId);
        await deleteDoc(visitRef);
        logger.log('✅ Visita excluída do Firebase:', visitId);
      },
    );
  }

  // Buscar visitas por organização
  async getVisitsByOrganization(organizationId: string, limitCount: number = 100): Promise<VisitForm[]> {
    return withOfflineRead<VisitForm[]>(
      `visits_org_${organizationId}_${limitCount}`,
      this.COLLECTION_NAME,
      async () => {
        const q = query(
          collection(db, this.COLLECTION_NAME),
          where('organizationId', '==', organizationId),
          orderBy('createdAt', 'desc'),
          limit(limitCount)
        );
        const querySnapshot = await getDocs(q);
        const visits: VisitForm[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          visits.push(this.normalizeVisitDocument(doc.id, data));
        });
        logger.log(`✅ ${visits.length} visitas carregadas do Firebase`);
        return visits;
      },
    );
  }

  // Buscar visitas por agente
  async getVisitsByAgent(agentId: string, limitCount: number = 100): Promise<VisitForm[]> {
    return withOfflineRead<VisitForm[]>(
      `visits_agent_${agentId}_${limitCount}`,
      this.COLLECTION_NAME,
      async () => {
        const q = query(
          collection(db, this.COLLECTION_NAME),
          where('agentId', '==', agentId),
          orderBy('createdAt', 'desc'),
          limit(limitCount)
        );
        const querySnapshot = await getDocs(q);
        const visits: VisitForm[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          visits.push(this.normalizeVisitDocument(doc.id, data));
        });
        logger.log(`✅ ${visits.length} visitas do agente carregadas do Firebase`);
        return visits;
      },
    );
  }

  // Buscar visitas por período
  async getVisitsByPeriod(
    organizationId: string,
    startDate: Date,
    endDate: Date
  ): Promise<VisitForm[]> {
    const cacheKey = `visits_period_${organizationId}_${startDate.getTime()}_${endDate.getTime()}`;
    return withOfflineRead<VisitForm[]>(
      cacheKey,
      this.COLLECTION_NAME,
      async () => {
        const q = query(
          collection(db, this.COLLECTION_NAME),
          where('organizationId', '==', organizationId),
          where('createdAt', '>=', startDate),
          where('createdAt', '<=', endDate),
          orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);
        const visits: VisitForm[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          visits.push(this.normalizeVisitDocument(doc.id, data));
        });
        logger.log(`✅ ${visits.length} visitas do período carregadas do Firebase`);
        return visits;
      },
    );
  }

  // Verificar conectividade com Firebase
  async checkConnectivity(): Promise<boolean> {
    if (!isOnline()) return false;
    try {
      const testQuery = query(collection(db, this.COLLECTION_NAME), limit(1));
      await getDocs(testQuery);
      return true;
    } catch (error) {
      logger.warn('Firebase offline:', (error as Error).message);
      return false;
    }
  }

  // Converter base64 para File objects
  private async convertBase64ToFiles(base64Photos: string[]): Promise<File[]> {
    return Promise.all(
      base64Photos.map(async (base64, index) => {
        // Extrair o tipo MIME e os dados
        const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          throw new Error('Formato base64 inválido');
        }

        const mimeType = matches[1];
        const base64Data = matches[2];

        // Converter base64 para blob
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);

        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }

        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });

        // Criar File object
        const fileName = `visita-foto-${index + 1}-${Date.now()}.${mimeType.split('/')[1]}`;
        return new File([blob], fileName, { type: mimeType });
      })
    );
  }
}

export const firebaseVisitsService = new FirebaseVisitsService();
