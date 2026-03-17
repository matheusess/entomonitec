import { db } from '@/lib/firebase';
import { withOfflineRead, withOfflineWrite } from '@/lib/firebaseWrapper';
import logger from '@/lib/logger';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp 
} from 'firebase/firestore';

export interface IOrganization {
  id: string;
  name: string;
  slug: string; // URL-friendly identifier
  fullName: string;
  state: string;
  city: string;
  department: string;
  phone: string;
  email: string;
  address?: string;
  website?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrganizationData {
  name: string;
  fullName: string;
  state: string;
  city: string;
  department: string;
  phone: string;
  email: string;
  address?: string;
  website?: string;
}

export class OrganizationService {
  private static readonly COLLECTION_NAME = 'organizations';

  /**
   * Verifica se usuário é super admin baseado no email
   */
  static isSuperAdmin(email: string): boolean {
    const superAdminDomains = [
      'entomonitec.com.br', // Domínio principal
      'entomonitec.com',    // Domínio alternativo
      process.env.NEXT_PUBLIC_SUPER_ADMIN_DOMAIN || 'entomonitec.com.br'
    ];
    return superAdminDomains.some(domain => email.endsWith(`@${domain}`));
  }

  /**
   * Cria uma nova organização
   */
  static async createOrganization(data: CreateOrganizationData): Promise<IOrganization> {
    const localId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const result = await withOfflineWrite(
      {
        type: 'add',
        collection: this.COLLECTION_NAME,
        localId,
        data: data as unknown as Record<string, unknown>,
        cacheKey: 'orgs_all',
      },
      async () => {
        try {
          logger.log('🏢 Criando organização no Firebase:', data);
          const slug = await this.generateUniqueSlug(data.name);
          const organizationData = {
            ...data,
            slug,
            isActive: true,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          };
          const docRef = await addDoc(collection(db, this.COLLECTION_NAME), organizationData);
          logger.log('✅ Organização criada com ID e slug:', docRef.id, slug);
          return {
            id: docRef.id,
            ...data,
            slug,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          } as IOrganization;
        } catch (error) {
          logger.error('❌ Erro ao criar organização:', error);
          throw new Error('Falha ao criar organização');
        }
      },
    );
    if (result) return result;
    // Offline placeholder
    const slug = this.generateSlug(data.name);
    return { id: localId, ...data, slug, isActive: true, createdAt: new Date(), updatedAt: new Date() };
  }

  /**
   * Gera slug amigável a partir do nome
   */
  static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[áàâãä]/g, 'a')
      .replace(/[éèêë]/g, 'e')
      .replace(/[íìîï]/g, 'i')
      .replace(/[óòôõö]/g, 'o')
      .replace(/[úùûü]/g, 'u')
      .replace(/[ç]/g, 'c')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  /**
   * Gera slug único verificando se já existe
   */
  static async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = this.generateSlug(name);
    let slug = baseSlug;
    let counter = 1;

    // Verificar se slug já existe
    while (await this.slugExists(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Verifica se slug já existe
   */
  private static async slugExists(slug: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('slug', '==', slug)
      );
      
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      logger.error('❌ Erro ao verificar slug:', error);
      return false;
    }
  }

  /**
   * Busca organização por slug
   */
  static async getOrganizationBySlug(slug: string): Promise<IOrganization | null> {
    return withOfflineRead<IOrganization | null>(
      `org_slug_${slug}`,
      this.COLLECTION_NAME,
      async () => {
        try {
          logger.log('🔍 Buscando organização por slug:', slug);
          const q = query(
            collection(db, this.COLLECTION_NAME),
            where('slug', '==', slug)
          );
          const querySnapshot = await getDocs(q);
          if (querySnapshot.empty) {
            logger.log('🔄 Slug não encontrado, tentando busca por nome...');
            return await this.getOrganizationBySlugFallback(slug);
          }
          const doc = querySnapshot.docs[0];
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            slug: data.slug || this.generateSlug(data.name),
            fullName: data.fullName,
            state: data.state,
            city: data.city,
            department: data.department,
            email: data.email,
            phone: data.phone,
            address: data.address,
            website: data.website,
            isActive: data.isActive ?? true,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date()
          };
        } catch (error) {
          logger.error('❌ Erro ao buscar organização por slug:', error);
          return null;
        }
      },
    );
  }

  /**
   * Busca por slug gerado dinamicamente (fallback para organizações antigas)
   */
  private static async getOrganizationBySlugFallback(slug: string): Promise<IOrganization | null> {
    try {
      const q = query(
        collection(db, this.COLLECTION_NAME),
        where('isActive', '==', true)
      );
      
      const querySnapshot = await getDocs(q);
      
      for (const doc of querySnapshot.docs) {
        const data = doc.data();
        const generatedSlug = this.generateSlug(data.name);
        
        if (generatedSlug === slug) {
          // Aproveitar para salvar o slug na organização
          await this.updateOrganizationSlug(doc.id, generatedSlug);
          
          return {
            id: doc.id,
            name: data.name,
            slug: generatedSlug,
            fullName: data.fullName,
            state: data.state,
            city: data.city,
            department: data.department,
            email: data.email,
            phone: data.phone,
            address: data.address,
            website: data.website,
            isActive: data.isActive ?? true,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date()
          };
        }
      }
      
      return null;
    } catch (error) {
      logger.error('❌ Erro no fallback de busca por slug:', error);
      return null;
    }
  }

  /**
   * Atualiza slug de organização existente
   */
  private static async updateOrganizationSlug(orgId: string, slug: string): Promise<void> {
    try {
      await updateDoc(doc(db, this.COLLECTION_NAME, orgId), {
        slug,
        updatedAt: Timestamp.now()
      });
      logger.log('✅ Slug atualizado para organização:', orgId, slug);
    } catch (error) {
      logger.error('❌ Erro ao atualizar slug:', error);
    }
  }

  /**
   * Lista todas as organizações
   */
  static async listOrganizations(): Promise<IOrganization[]> {
    return withOfflineRead<IOrganization[]>(
      'orgs_all',
      this.COLLECTION_NAME,
      async () => {
        try {
          logger.log('📋 Buscando organizações...');
          const q = query(
            collection(db, this.COLLECTION_NAME),
            orderBy('createdAt', 'desc')
          );
          const querySnapshot = await getDocs(q);
          const organizations: IOrganization[] = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            organizations.push({
              id: doc.id,
              name: data.name,
              slug: data.slug || this.generateSlug(data.name),
              fullName: data.fullName,
              state: data.state,
              city: data.city,
              department: data.department,
              phone: data.phone,
              email: data.email,
              address: data.address,
              website: data.website,
              isActive: data.isActive ?? true,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date()
            });
          });
          logger.log('✅ Organizações carregadas:', organizations.length);
          return organizations;
        } catch (error) {
          logger.error('❌ Erro ao listar organizações:', error);
          throw new Error('Falha ao carregar organizações');
        }
      },
    );
  }

  /**
   * Busca uma organização por ID
   */
  static async getOrganization(id: string): Promise<IOrganization | null> {
    return withOfflineRead<IOrganization | null>(
      `org_${id}`,
      this.COLLECTION_NAME,
      async () => {
        try {
          const docRef = doc(db, this.COLLECTION_NAME, id);
          const docSnap = await getDoc(docRef);
          if (!docSnap.exists()) return null;
          const data = docSnap.data();
          return {
            id: docSnap.id,
            name: data.name,
            fullName: data.fullName,
            state: data.state,
            city: data.city,
            department: data.department,
            phone: data.phone,
            email: data.email,
            address: data.address,
            website: data.website,
            isActive: data.isActive ?? true,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            slug: data.slug || this.generateSlug(data.name)
          };
        } catch (error) {
          logger.error('❌ Erro ao buscar organização:', error);
          return null;
        }
      },
    );
  }

  /**
   * Atualiza uma organização
   */
  static async updateOrganization(id: string, data: Partial<CreateOrganizationData>): Promise<void> {
    await withOfflineWrite(
      {
        type: 'update',
        collection: this.COLLECTION_NAME,
        docId: id,
        data: data as unknown as Record<string, unknown>,
      },
      async () => {
        try {
          const docRef = doc(db, this.COLLECTION_NAME, id);
          await updateDoc(docRef, { ...data, updatedAt: Timestamp.now() });
          logger.log('✅ Organização atualizada:', id);
        } catch (error) {
          logger.error('❌ Erro ao atualizar organização:', error);
          throw new Error('Falha ao atualizar organização');
        }
      },
    );
  }

  /**
   * Desativa uma organização (soft delete)
   */
  static async deactivateOrganization(id: string): Promise<void> {
    await withOfflineWrite(
      {
        type: 'update',
        collection: this.COLLECTION_NAME,
        docId: id,
        data: { isActive: false },
      },
      async () => {
        try {
          const docRef = doc(db, this.COLLECTION_NAME, id);
          await updateDoc(docRef, { isActive: false, updatedAt: Timestamp.now() });
          logger.log('✅ Organização desativada:', id);
        } catch (error) {
          logger.error('❌ Erro ao desativar organização:', error);
          throw new Error('Falha ao desativar organização');
        }
      },
    );
  }

  /**
   * Remove uma organização permanentemente
   */
  static async deleteOrganization(id: string): Promise<void> {
    await withOfflineWrite(
      {
        type: 'delete',
        collection: this.COLLECTION_NAME,
        docId: id,
      },
      async () => {
        try {
          const docRef = doc(db, this.COLLECTION_NAME, id);
          await deleteDoc(docRef);
          logger.log('✅ Organização removida:', id);
        } catch (error) {
          logger.error('❌ Erro ao remover organização:', error);
          throw new Error('Falha ao remover organização');
        }
      },
    );
  }
}