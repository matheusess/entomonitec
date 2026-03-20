import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { toast } from '@/components/ui/use-toast';
import PhotoUpload from '@/components/PhotoUpload';
import VisitDetailsModal from '@/components/VisitDetailsModal';
import FirebaseStatus from '@/components/FirebaseStatus';

import {
  MapPin,
  Clock,
  Save,
  Plus,
  FileText,
  Camera,
  Droplets,
  Bug,
  AlertTriangle,
  Home,
  Building,
  Zap,
  CheckCircle,
  AlertCircle,
  Loader2,
  WifiOff,
  Eye,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  LocationData,
  RoutineVisitForm,
  LIRAAVisitForm,
  CreateRoutineVisitRequest,
  CreateLIRAAVisitRequest,
  CreateOvitrampasVisitRequest,
  OvitrampasVisitForm
} from '@/types/visits';
import { useVisits } from '@/hooks/useVisits';
import LocationStatus from '@/components/LocationStatus';
import InteractiveMap from '@/components/InteractiveMap';
import GPSPermissionHelper from '@/components/GPSPermissionHelper';
import { visitsService } from '@/services/visitsService';
import { geocodingService } from '@/services/geocodingService';
import { firebaseVisitsService } from '@/services/firebaseVisitsService';
import { useOnlineSync } from '@/hooks/useOnlineSync';
import logger from '@/lib/logger';
import { parseVisitTimestamp } from '@/lib/utils';
import { ovitrapService } from '@/services/ovitrapService';
import { IOvitrap } from '@/types/ovitrap';
import { IUser } from '@/types/organization';
import { UserService, IUserWithId } from '@/services/userService';

export default function Visits() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('new');
  const [visitType, setVisitType] = useState<'routine' | 'liraa' | 'ovitrampa'>('routine');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<RoutineVisitForm | LIRAAVisitForm | OvitrampasVisitForm | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [visitPhotos, setVisitPhotos] = useState<string[]>([]);
  const [uploadedPhotoUrls, setUploadedPhotoUrls] = useState<string[]>([]);
  const [ovitraps, setOvitraps] = useState<IOvitrap[]>([]);
  const [isSavingOvitrap, setIsSavingOvitrap] = useState(false);
  const [agents, setAgents] = useState<IUserWithId[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [isEditingOvitrampas, setIsEditingOvitrampas] = useState(false);
  const [editingOvitrampasVisit, setEditingOvitrampasVisit] = useState<OvitrampasVisitForm | null>(null);
  const [tempOvitrampasQuantities, setTempOvitrampasQuantities] = useState({ ovos: 0, larvas: 0 });
  const [isEditingOvitrampasFullForm, setIsEditingOvitrampasFullForm] = useState(false);
  const [editingOvitrampasFullFormVisit, setEditingOvitrampasFullFormVisit] = useState<OvitrampasVisitForm | null>(null);
  const [editingOvitrampasFullFormData, setEditingOvitrampasFullFormData] = useState<Partial<OvitrampasVisitForm>>({});
  const [editingOvitrampasFullFormAgentId, setEditingOvitrampasFullFormAgentId] = useState('');

  // Hook para gerenciar visitas
  const { visits: savedVisits, syncVisits, getStats, loadVisits } = useVisits();

  // Sincronização offline
  const { isOnline, pendingCount: wrapperPendingCount, isSyncing: isWrapperSyncing, lastSyncAt, syncNow } = useOnlineSync();

  const [routineForm, setRoutineForm] = useState<Partial<RoutineVisitForm>>({
    type: 'routine',
    timestamp: new Date(),
    neighborhood: '',
    observations: '',
    breedingSites: {
      waterReservoir: false,
      tires: false,
      bottles: false,
      cans: false,
      buckets: false,
      plantPots: false,
      gutters: false,
      pools: false,
      wells: false,
      tanks: false,
      drains: false,
      others: ''
    },
    larvaeFound: false,
    pupaeFound: false,
    controlMeasures: []
  });

  const [liraaForm, setLIRAAForm] = useState<Partial<LIRAAVisitForm>>({
    type: 'liraa',
    timestamp: new Date(),
    neighborhood: '',
    observations: '',
    propertyType: 'residential',
    inspected: true,
    refused: false,
    closed: false,
    containers: { a1: 0, a2: 0, b: 0, c: 0, d1: 0, d2: 0, e: 0 },
    positiveContainers: { a1: 0, a2: 0, b: 0, c: 0, d1: 0, d2: 0, e: 0 },
    larvaeSpecies: [],
    treatmentApplied: false,
    eliminationAction: false
  });

  const [ovitrampasForm, setOvitrampasForm] = useState<Partial<OvitrampasVisitForm>>({
    type: 'ovitrampas',
    timestamp: new Date(),
    dataVisita: new Date(),
    neighborhood: '',
    observations: '',
    propertyType: 'residential',
    inspected: true,
    refused: false,
    closed: false,
    // containers: { a1: 0, a2: 0, b: 0, c: 0, d1: 0, d2: 0, e: 0 },
    // positiveContainers: { a1: 0, a2: 0, b: 0, c: 0, d1: 0, d2: 0, e: 0 },
    larvaeFound: false,
    manutencaoRealizada: false,
    // larvaeSpecies: [],
    treatmentApplied: false,
    eliminationAction: false
  });



  const controlMeasures = [
    'Orientação ao morador',
    'Remoção de criadouros',
    'Aplicação de larvicida',
    'Vedação de reservatórios',
    'Limpeza de calhas',
    'Eliminação de água parada',
    'Notificação de foco'
  ];

  const larvaeSpecies = [
    'Aedes aegypti',
    'Aedes albopictus',
    'Culex quinquefasciatus',
    'Anopheles darlingi',
    'Outros'
  ];

  // Função para converter fotos em base64
  const convertPhotosToBase64 = (photos: any[]): Promise<string[]> => {
    return Promise.all(
      photos.map((photo) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(photo.file);
        });
      })
    );
  };

  // Função para lidar com mudanças nas fotos
  const handlePhotosChange = useCallback(async (photos: any[]) => {
    try {
      const base64Photos = await convertPhotosToBase64(photos);
      setVisitPhotos(base64Photos);
    } catch (error) {
      logger.error('Erro ao converter fotos:', error);
    }
  }, []);

  // Função para lidar com URLs das fotos enviadas
  const handleUploadUrls = useCallback((urls: string[]) => {
    setUploadedPhotoUrls(urls);
  }, []);

  // Função para capturar localização atual
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      setIsGettingLocation(true);

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const location: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date(),
            address: 'Capturando endereço...'
          };

          // Obter endereço real via geocoding
          try {
            logger.log('🌍 Obtendo endereço real para:', location.latitude, location.longitude);
            const geocodingResult = await geocodingService.getAddressFromCoordinatesWithCache(
              location.latitude,
              location.longitude
            );

            // Usar endereço completo ou fallback
            location.address = geocodingResult.fullAddress || geocodingResult.address;

            // Incluir dados do geocoding para os cards (se disponível)
            if (geocodingResult.street && geocodingResult.city) {
              location.geocodingData = {
                street: geocodingResult.street || '',
                houseNumber: geocodingResult.number || '',
                neighborhood: geocodingResult.neighborhood || '',
                city: geocodingResult.city || '',
                state: geocodingResult.state || '',
                country: 'Brasil',
                postcode: geocodingResult.postalCode || '',
                fullAddress: geocodingResult.fullAddress
              };
            }

            logger.log('✅ Endereço real obtido:', location.address);
            logger.log('📋 Dados do geocoding:', location.geocodingData);

            // Preencher automaticamente o bairro baseado na localização GPS
            const autoNeighborhood = geocodingResult.neighborhood ||
              (geocodingResult.address.includes('Cajuru') ? 'Cajuru' :
                geocodingResult.address.includes('Centro') ? 'Centro' :
                  'Bairro não identificado');

            // Update forms with current timestamp, location and auto-filled neighborhood
            const now = new Date();
            setRoutineForm(prev => ({ ...prev, timestamp: now, location, neighborhood: autoNeighborhood }));
            setLIRAAForm(prev => ({ ...prev, timestamp: now, location, neighborhood: autoNeighborhood }));
          } catch (error) {
            logger.warn('⚠️ Falha no geocoding, usando fallback:', error);
            // Fallback para coordenadas se geocoding falhar
            location.address = `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;

            // Update forms with current timestamp and location (sem bairro)
            const now = new Date();
            setRoutineForm(prev => ({ ...prev, timestamp: now, location }));
            setLIRAAForm(prev => ({ ...prev, timestamp: now, location }));
          }

          setCurrentLocation(location);
          setIsGettingLocation(false);
        },
        (error) => {
          logger.warn('Geolocation error:', error);
          setIsGettingLocation(false);

          let errorMessage = "Erro desconhecido";
          let errorDescription = "Tente novamente mais tarde.";

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Permissão de localização negada";
              errorDescription = "Clique no ícone de localização na barra de endereços e permita o acesso, ou vá em Configurações > Privacidade > Localização.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "GPS indisponível";
              errorDescription = "Verifique se o GPS está ativado no seu dispositivo e se você está em uma área aberta.";
              break;
            case error.TIMEOUT:
              errorMessage = "Timeout do GPS";
              errorDescription = "O GPS demorou muito para responder. Tente novamente em uma área mais aberta.";
              break;
          }

          // Fallback for offline or permission denied
          const now = new Date();
          setRoutineForm(prev => ({ ...prev, timestamp: now }));
          setLIRAAForm(prev => ({ ...prev, timestamp: now }));

          toast({
            title: errorMessage,
            description: errorDescription,
            variant: "destructive",
            duration: 8000
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 300000 // 5 minutos
        }
      );
    }
  };

  // Auto-capture location and timestamp
  useEffect(() => {
    getCurrentLocation();

    // Update every minute to keep timestamp current
    const interval = setInterval(getCurrentLocation, 60000);

    return () => clearInterval(interval);
  }, []);

  // Verificar status de conexão
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const isConnected = await firebaseVisitsService.checkConnectivity();
        setConnectionStatus(isConnected ? 'online' : 'offline');
      } catch (error) {
        setConnectionStatus('offline');
      }
    };

    checkConnection();
    // Verificar a cada 30 segundos
    const interval = setInterval(checkConnection, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadOvitraps = async () => {
      if (!user?.organizationId) {
        setOvitraps([]);
        return;
      }

      try {
        const items = await ovitrapService.getOvitraps(user.organizationId);
        setOvitraps(items.filter(item => item.isActive));
        logger.log('✅ Ovitraps carregadas:', items.length);
      } catch (error) {
        logger.error('Erro ao carregar identificações de ovitrampa:', error);
      }
    };

    loadOvitraps();
  }, [user?.organizationId]);

  // Recarregar ovitraps quando voltar para a aba "new"
  useEffect(() => {
    if (activeTab === 'new' && user?.organizationId) {
      const loadOvitraps = async () => {
        try {
          const items = await ovitrapService.getOvitraps(user?.organizationId ?? '');
          setOvitraps(items.filter(item => item.isActive));
        } catch (error) {
          logger.error('Erro ao recarregar ovitraps:', error);
        }
      };

      loadOvitraps();
    }
  }, [activeTab, user?.organizationId]);

  // Recarregar ovitraps após sincronização
  useEffect(() => {
    if (lastSyncAt && user?.organizationId) {
      const loadOvitraps = async () => {
        try {
          const items = await ovitrapService.getOvitraps(user?.organizationId ?? '');
          setOvitraps(items.filter(item => item.isActive));
          logger.log('🔄 Ovitraps recarregadas após sincronização:', items.length);
        } catch (error) {
          logger.error('Erro ao recarregar ovitraps após sincronização:', error);
        }
      };

      loadOvitraps();
    }
  }, [lastSyncAt, user?.organizationId]);

  useEffect(() => {
    const loadAgents = async () => {
      if (!user?.organizationId) {
        setAgents([]);
        setSelectedAgentId('');
        return;
      }

      setIsLoadingAgents(true);
      try {
        const users = await UserService.listUsersByOrganization(user.organizationId);
        const activeAgents = users.filter((item) => item.role === 'agent' && item.isActive);
        setAgents(activeAgents);

        if (activeAgents.some((item) => item.id === user.id)) {
          setSelectedAgentId(user.id);
        } else if (activeAgents.length > 0) {
          setSelectedAgentId(activeAgents[0].id);
        } else {
          setSelectedAgentId('');
        }
      } catch (error) {
        logger.error('Erro ao carregar agentes da ovitrampa:', error);
        setAgents([]);
      } finally {
        setIsLoadingAgents(false);
      }
    };

    loadAgents();
  }, [user?.organizationId, user?.id]);

  const handleCreateOvitrap = async (payload: { nome: string; codigo: string; endereco: string }) => {
    if (!user?.organizationId || !user?.id) {
      toast({
        title: 'Não foi possível salvar a identificação',
        description: 'Usuário sem organização vinculada.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingOvitrap(true);
    try {
      const created = await ovitrapService.createOvitrap({
        ...payload,
        organizationId: user.organizationId,
        createdBy: user.id,
      });

      // Limpar cache para forçar recarga
      await ovitrapService.clearOvitrapsCache(user.organizationId);

      // Recarregar lista de ovitraps
      const updatedOvitraps = await ovitrapService.getOvitraps(user.organizationId);
      setOvitraps(updatedOvitraps.filter(item => item.isActive));

      setOvitrampasForm(prev => ({
        ...prev,
        ovitrapId: created.id,
        ovitrapNome: created.nome || payload.nome,
        ovitrapCodigo: created.codigo || payload.codigo,
        ovitrapEndereco: created.endereco || payload.endereco,
      }));

      toast({
        title: 'Identificação salva',
        description: 'A nova identificação da ovitrampa foi cadastrada com sucesso.',
      });
    } catch (error) {
      logger.error('Erro ao salvar identificação de ovitrampa:', error);
      toast({
        title: 'Erro ao salvar identificação',
        description: 'Tente novamente em alguns instantes.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingOvitrap(false);
    }
  };

  const handleEditOvitrampasVisit = (visit: OvitrampasVisitForm) => {
    setEditingOvitrampasVisit(visit);
    setTempOvitrampasQuantities({
      ovos: visit.quantidadeOvos || 0,
      larvas: visit.quantidadeLarvas || 0,
    });
    setIsEditingOvitrampas(true);
  };

  const handleEditOvitrampasFullForm = (visit: OvitrampasVisitForm) => {
    setEditingOvitrampasFullFormVisit(visit);
    setEditingOvitrampasFullFormData({ ...visit });
    setEditingOvitrampasFullFormAgentId((visit as any).agentId || '');
    setIsEditingOvitrampasFullForm(true);
  };

  const handleSaveOvitrampasFullForm = async () => {
    if (!editingOvitrampasFullFormVisit) return;

    try {
      await visitsService.updateVisit(editingOvitrampasFullFormVisit.id, {
        ovitrapId: editingOvitrampasFullFormData.ovitrapId || undefined,
        ovitrapNome: editingOvitrampasFullFormData.ovitrapNome,
        ovitrapCodigo: editingOvitrampasFullFormData.ovitrapCodigo,
        ovitrapEndereco: editingOvitrampasFullFormData.ovitrapEndereco,
        inspected: editingOvitrampasFullFormData.inspected,
        refused: editingOvitrampasFullFormData.refused,
        closed: editingOvitrampasFullFormData.closed,
        larvaeFound: editingOvitrampasFullFormData.larvaeFound,
        manutencaoRealizada: editingOvitrampasFullFormData.manutencaoRealizada,
        dataVisita: editingOvitrampasFullFormData.dataVisita,
        observations: editingOvitrampasFullFormData.observations,
        neighborhood: editingOvitrampasFullFormData.neighborhood,
      });

      // Verificar conectividade e sincronizar se online
      if (isOnline) {
        try {
          await syncNow();
          toast({
            title: "Visita atualizada e sincronizada!",
            description: "Os dados foram salvos e enviados ao servidor.",
          });
        } catch (syncError) {
          logger.warn('Erro ao sincronizar automaticamente:', syncError);
          toast({
            title: "Visita salva localmente",
            description: "Os dados serão sincronizados quando a conexão for restaurada.",
          });
        }
      } else {
        // Offline - apenas salva localmente e será sincronizado depois
        toast({
          title: "Visita salva",
          description: "Modo offline detectado. Os dados serão sincronizados quando a internet for restaurada.",
          variant: "default",
        });
      }

      setIsEditingOvitrampasFullForm(false);
      setEditingOvitrampasFullFormVisit(null);
      loadVisits();
    } catch (error) {
      logger.error('Erro ao atualizar visita de ovitrampa:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível atualizar a visita. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleSaveOvitrampasQuantities = async () => {
    if (!editingOvitrampasVisit) return;

    try {
      await visitsService.updateVisit(editingOvitrampasVisit.id, {
        quantidadeOvos: tempOvitrampasQuantities.ovos,
        quantidadeLarvas: tempOvitrampasQuantities.larvas,
      });

      // Verificar conectividade e sincronizar se online
      if (isOnline) {
        try {
          await syncNow();
          toast({
            title: "Contagem atualizada e sincronizada!",
            description: "Os dados foram salvos e enviados ao servidor.",
          });
        } catch (syncError) {
          logger.warn('Erro ao sincronizar automaticamente:', syncError);
          toast({
            title: "Contagem salva localmente",
            description: "Os dados serão sincronizados quando a conexão for restaurada.",
          });
        }
      } else {
        // Offline - apenas salva localmente e será sincronizado depois
        toast({
          title: "Contagem salva",
          description: "Modo offline detectado. Os dados serão sincronizados quando a internet for restaurada.",
          variant: "default",
        });
      }

      setIsEditingOvitrampas(false);
      setEditingOvitrampasVisit(null);
      loadVisits();
    } catch (error) {
      logger.error('Erro ao atualizar contagem de ovitrampas:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível atualizar a contagem. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      if (!currentLocation) {
        throw new Error('Localização não disponível');
      }

      let newVisit: RoutineVisitForm | LIRAAVisitForm | OvitrampasVisitForm;

      // Handles Ovitrampas form
      if (visitType === 'ovitrampa') {
        const visitData: CreateOvitrampasVisitRequest = {
          neighborhood: ovitrampasForm.neighborhood || 'Bairro não identificado',
          location: currentLocation,
          observations: ovitrampasForm.observations || '',
          photos: uploadedPhotoUrls.length > 0 ? uploadedPhotoUrls : visitPhotos,
          dataVisita: ovitrampasForm.dataVisita || new Date(),
          ovitrapId: ovitrampasForm.ovitrapId || undefined,
          ovitrapNome: ovitrampasForm.ovitrapNome || '',
          ovitrapCodigo: ovitrampasForm.ovitrapCodigo || '',
          ovitrapEndereco: ovitrampasForm.ovitrapEndereco || '',
          propertyType: ovitrampasForm.propertyType || 'residential',
          inspected: ovitrampasForm.inspected || true,
          refused: ovitrampasForm.refused || false,
          closed: ovitrampasForm.closed || false,
          larvaeFound: ovitrampasForm.larvaeFound || false,
          manutencaoRealizada: ovitrampasForm.manutencaoRealizada || false,
          treatmentApplied: ovitrampasForm.treatmentApplied || false,
          eliminationAction: ovitrampasForm.eliminationAction || false,
          quantidadeOvos: 0,
          quantidadeLarvas: 0,
        };

        newVisit = await visitsService.createOvitrampasVisit(visitData, user as unknown as IUser);

        // Reset form
        setOvitrampasForm({
          type: 'ovitrampas',
          timestamp: new Date(),
          dataVisita: new Date(),
          neighborhood: '',
          observations: '',
          propertyType: 'residential',
          inspected: true,
          refused: false,
          closed: false,
          larvaeFound: false,
          manutencaoRealizada: false,
          treatmentApplied: false,
          eliminationAction: false,
        });
        setVisitPhotos([]);

        toast({
          title: "Visita de ovitrampa registrada com sucesso!",
          description: "Acesse o histórico para preencher os dados de contagem de ovos e larvas.",
        });

        setActiveTab('history');
        return;
      }

      if (visitType === 'routine') {
        const visitData: CreateRoutineVisitRequest = {
          neighborhood: routineForm.neighborhood || 'Bairro não identificado',
          location: currentLocation,
          observations: routineForm.observations || '',
          photos: uploadedPhotoUrls.length > 0 ? uploadedPhotoUrls : visitPhotos,
          breedingSites: routineForm.breedingSites || {
            waterReservoir: false,
            tires: false,
            bottles: false,
            cans: false,
            buckets: false,
            plantPots: false,
            gutters: false,
            pools: false,
            wells: false,
            tanks: false,
            drains: false,
            others: ''
          },
          larvaeFound: routineForm.larvaeFound || false,
          pupaeFound: routineForm.pupaeFound || false,
          controlMeasures: routineForm.controlMeasures || []
        };

        newVisit = await visitsService.createRoutineVisit(visitData, user as unknown as IUser);

        // Reset routine form
        setRoutineForm({
          type: 'routine',
          timestamp: new Date(),
          neighborhood: '',
          observations: '',
          breedingSites: {
            waterReservoir: false,
            tires: false,
            bottles: false,
            cans: false,
            buckets: false,
            plantPots: false,
            gutters: false,
            pools: false,
            wells: false,
            tanks: false,
            drains: false,
            others: ''
          },
          larvaeFound: false,
          pupaeFound: false,
          controlMeasures: []
        });
      } else {
        const visitData: CreateLIRAAVisitRequest = {
          neighborhood: liraaForm.neighborhood || 'Bairro não identificado',
          location: currentLocation,
          observations: liraaForm.observations || '',
          photos: uploadedPhotoUrls.length > 0 ? uploadedPhotoUrls : visitPhotos,
          propertyType: liraaForm.propertyType || 'residential',
          inspected: liraaForm.inspected || true,
          refused: liraaForm.refused || false,
          closed: liraaForm.closed || false,
          containers: liraaForm.containers || { a1: 0, a2: 0, b: 0, c: 0, d1: 0, d2: 0, e: 0 },
          positiveContainers: liraaForm.positiveContainers || { a1: 0, a2: 0, b: 0, c: 0, d1: 0, d2: 0, e: 0 },
          larvaeSpecies: liraaForm.larvaeSpecies || [],
          treatmentApplied: liraaForm.treatmentApplied || false,
          eliminationAction: liraaForm.eliminationAction || false,
          larvaeFound: Object.values(liraaForm.positiveContainers || {}).some(count => count > 0)
        };

        newVisit = await visitsService.createLIRAAVisit(visitData, user as unknown as IUser);

        // Reset LIRAa form
        setLIRAAForm({
          type: 'liraa',
          timestamp: new Date(),
          neighborhood: '',
          observations: '',
          propertyType: 'residential',
          inspected: true,
          refused: false,
          closed: false,
          containers: { a1: 0, a2: 0, b: 0, c: 0, d1: 0, d2: 0, e: 0 },
          positiveContainers: { a1: 0, a2: 0, b: 0, c: 0, d1: 0, d2: 0, e: 0 },
          larvaeSpecies: [],
          treatmentApplied: false,
          eliminationAction: false
        });
      }


      // Recarregar a lista de visitas para mostrar a nova visita
      loadVisits();

      // Limpar fotos após salvar
      setVisitPhotos([]);

      toast({
        title: "Visita registrada com sucesso!",
        description: `Visita ${visitType === 'routine' ? 'de rotina' : 'LIRAa'} salva no sistema.`,
      });

      setActiveTab('history');
    } catch (error) {
      toast({
        title: "Erro ao salvar visita",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentForm = visitType === 'routine' ? routineForm : visitType === 'liraa' ? liraaForm : ovitrampasForm;

  // Função para sincronizar visitas
  const handleSyncVisits = async () => {
    setIsSyncing(true);
    try {
      // Sincronizar visitas
      const visitResult = await syncVisits();

      // Sincronizar ovitraps pendentes
      const ovitrapResult = await ovitrapService.syncPendingOvitraps();

      const totalSynced = (visitResult.synced || 0) + ovitrapResult.synced;
      const totalErrors = (visitResult.errors || 0) + ovitrapResult.errors;
      const success = totalErrors === 0;

      if (success) {
        if (totalSynced === 0) {
          toast({
            title: "Sincronização",
            description: visitResult.message || "Nenhum dado pendente para sincronizar",
          });
        } else {
          toast({
            title: "Sincronização concluída!",
            description: `${visitResult.synced || 0} visitas e ${ovitrapResult.synced} identificações sincronizadas com sucesso.`,
          });
        }
        // Recarregar ovitraps após sincronização
        if (ovitrapResult.synced > 0 && user?.organizationId) {
          const updated = await ovitrapService.getOvitraps(user.organizationId);
          setOvitraps(updated.filter(item => item.isActive));
        }
      } else {
        toast({
          title: "Sincronização com problemas",
          description: `${totalSynced} itens sincronizados, ${totalErrors} com erro.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Erro na sincronização",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Obter estatísticas das visitas
  const visitStats = getStats();

  return (
    <>

      <div className="space-y-2 mb-6 ">
        <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
          <MapPin className="h-8 w-8 text-primary" />
          <span>Vigilância Entomológica</span>
        </h1>
        <p className="text-muted-foreground">
          Sistema de campo para coleta de dados conforme diretrizes do Ministério da Saúde
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="new" className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Nova Visita</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>Histórico ({savedVisits.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="space-y-6 pt-6">
          {/* Status Cards Essenciais */}
          <div className="grid grid-cols-3 gap-4">
            {/* GPS Status */}
            <div className="bg-white p-3 rounded-lg shadow-sm border">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${currentLocation ? 'bg-green-500' :
                  isGettingLocation ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                <span className="text-xs font-medium text-gray-700">GPS</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {currentLocation ? 'Ativo' :
                  isGettingLocation ? 'Capturando...' : 'Indisponível'}
              </p>
            </div>

            {/* Conectividade */}
            <div className="bg-white p-3 rounded-lg shadow-sm border">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                <span className="text-xs font-medium text-gray-700">Internet</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {isOnline ? 'Online' : 'Offline'}
              </p>
            </div>

            {/* Coordenadas */}
            <div className="bg-white p-3 rounded-lg shadow-sm border">
              <div className="flex items-center gap-2">
                <MapPin className="h-3 w-3 text-gray-600" />
                <span className="text-xs font-medium text-gray-700">Local</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {currentLocation ? 'Capturado' : 'Aguardando...'}
              </p>
            </div>
          </div>

          {/* Helper de Permissões GPS */}
          {!currentLocation && (
            <div className="space-y-4">
              <GPSPermissionHelper
                onPermissionGranted={getCurrentLocation}
                className="mb-4"
              />

              {/* Botão para tentar capturar GPS */}
              <div className="text-center">
                <Button
                  onClick={getCurrentLocation}
                  disabled={isGettingLocation}
                  variant="outline"
                  className="w-full max-w-sm"
                >
                  {isGettingLocation ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Capturando GPS...
                    </>
                  ) : (
                    <>
                      <MapPin className="h-4 w-4 mr-2" />
                      Tentar Capturar GPS
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Mapa Interativo */}
          <InteractiveMap
            currentLocation={currentLocation}
            onLocationUpdate={async (newLocation) => {
              setCurrentLocation(newLocation);

              // Obter bairro automaticamente via geocoding
              try {
                const geocodingResult = await geocodingService.getAddressFromCoordinatesWithCache(
                  newLocation.latitude,
                  newLocation.longitude
                );

                const autoNeighborhood = geocodingResult.neighborhood ||
                  (geocodingResult.address.includes('Cajuru') ? 'Cajuru' :
                    geocodingResult.address.includes('Centro') ? 'Centro' :
                      'Bairro não identificado');

                // Atualizar formulários com nova localização e bairro
                setRoutineForm(prev => ({ ...prev, location: newLocation, neighborhood: autoNeighborhood }));
                setLIRAAForm(prev => ({ ...prev, location: newLocation, neighborhood: autoNeighborhood }));
              } catch (error) {
                logger.warn('⚠️ Falha ao obter bairro via geocoding:', error);
                // Atualizar apenas com localização
                setRoutineForm(prev => ({ ...prev, location: newLocation }));
                setLIRAAForm(prev => ({ ...prev, location: newLocation }));
              }
            }}
            isGettingLocation={isGettingLocation}
            onRefreshLocation={getCurrentLocation}
          />

          {/* Visit Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Tipo de Visita</CardTitle>
              <CardDescription>
                Selecione o tipo de levantamento a ser realizado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={visitType} onValueChange={(value: 'routine' | 'liraa' | 'ovitrampa') => setVisitType(value)}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2 p-4 border rounded-lg cursor-pointer hover:bg-muted">
                    <RadioGroupItem value="routine" id="routine" />
                    <Label htmlFor="routine" className="cursor-pointer flex-1">
                      <div className="flex items-center space-x-3">
                        <Home className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">Visita de Rotina</p>
                          <p className="text-sm text-muted-foreground">Pesquisa de criadouros e controle vetorial</p>
                        </div>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2 p-4 border rounded-lg cursor-pointer hover:bg-muted">
                    <RadioGroupItem value="liraa" id="liraa" />
                    <Label htmlFor="liraa" className="cursor-pointer flex-1">
                      <div className="flex items-center space-x-3">
                        <Bug className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">LIRAa</p>
                          <p className="text-sm text-muted-foreground">Levantamento de Índice Rápido para Aedes aegypti</p>
                        </div>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2 p-4 border rounded-lg cursor-pointer hover:bg-muted">
                    <RadioGroupItem value="ovitrampa" id="ovitrampa" />
                    <Label htmlFor="ovitrampa" className="cursor-pointer flex-1">
                      <div className="flex items-center space-x-3">
                        {/*TODO -> alterar icone para representar Ovos */}
                        <Bug className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">Ovitrampa</p>
                          <p className="text-sm text-muted-foreground">Registro de manutenção de Ovitrampa </p>
                        </div>
                      </div>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Auto-captured Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Informações Automáticas</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data e Horário</Label>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="font-medium">
                        {format(currentForm.timestamp || new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                      <p className="text-xs text-muted-foreground">Capturado automaticamente</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Localização GPS</Label>
                    {currentLocation ? (
                      <div className="grid grid-cols-2 gap-3">
                        {/* Cidade */}
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-xs text-blue-600 font-medium mb-1">Cidade</p>
                          <p className="text-sm font-semibold text-blue-900">
                            {currentLocation.geocodingData?.city || 'Cidade'}
                          </p>
                        </div>

                        {/* Bairro */}
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-xs text-green-600 font-medium mb-1">Bairro</p>
                          <p className="text-sm font-semibold text-green-900">
                            {currentLocation.geocodingData?.neighborhood || 'Bairro'}
                          </p>
                        </div>

                        {/* Rua */}
                        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                          <p className="text-xs text-purple-600 font-medium mb-1">Rua</p>
                          <p className="text-sm font-semibold text-purple-900">
                            {currentLocation.geocodingData?.street || 'Rua'}
                          </p>
                        </div>

                        {/* Número */}
                        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                          <p className="text-xs text-orange-600 font-medium mb-1">Número</p>
                          <p className="text-sm font-semibold text-orange-900">
                            {currentLocation.geocodingData?.houseNumber || 'Número'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">Capturando localização...</p>
                      </div>
                    )}
                  </div>
                </div>


              </CardContent>
            </Card>

            {/* Visit Type Specific Forms */}
            {/* //TODO -> Adicionar formulário específico para ovitrampas */}
            {visitType === 'routine' ? (
              <RoutineVisitFormContent
                form={routineForm}
                setForm={setRoutineForm}
                controlMeasures={controlMeasures}
              />
            ) : visitType === 'liraa' ? (
              <LIRAAFormContent
                form={liraaForm}
                setForm={setLIRAAForm}
                larvaeSpecies={larvaeSpecies}
              />
            ) : (
              <OvitrampasFormContent
                form={ovitrampasForm}
                setForm={setOvitrampasForm}
                larvaeSpecies={[]}
                ovitraps={ovitraps}
                onCreateOvitrap={handleCreateOvitrap}
                isSavingOvitrap={isSavingOvitrap}
                agents={agents}
                selectedAgentId={selectedAgentId}
                onSelectedAgentChange={setSelectedAgentId}
                isLoadingAgents={isLoadingAgents}
              />
            )}

            {/* Photos */}
            {visitType !== 'ovitrampa' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Camera className="h-5 w-4" />
                    <span>Evidências Fotográficas</span>
                  </CardTitle>
                  <CardDescription>
                    Registre fotos dos criadouros e ações realizadas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PhotoUpload
                    maxPhotos={5}
                    onPhotosChange={handlePhotosChange}
                    onUploadUrls={handleUploadUrls}
                    visitId={currentLocation ? 'temp-visit-id' : undefined}
                    autoUpload={false}
                  />
                </CardContent>
              </Card>
            )}

            {/* Observations */}
            <Card>
              <CardHeader>
                <CardTitle>Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={currentForm.observations}
                  onChange={(e) => {
                    if (visitType === 'routine') {
                      setRoutineForm(prev => ({ ...prev, observations: e.target.value }));
                    } else if (visitType === 'liraa') {
                      setLIRAAForm(prev => ({ ...prev, observations: e.target.value }));
                    } else {
                      setOvitrampasForm(prev => ({ ...prev, observations: e.target.value }));
                    }
                  }}
                  placeholder="Observações adicionais sobre a visita..."
                  rows={4}
                />
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4">
              <Button type="submit" disabled={isSubmitting} className="min-w-32">
                {isSubmitting ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>Salvando...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Save className="h-4 w-4" />
                    <span>Salvar Visita</span>
                  </div>
                )}
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="history" className="space-y-4 pt-6">
          {/* Estatísticas e Sincronização */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{visitStats.total}</p>
                    <p className="text-xs text-muted-foreground">Total de Visitas</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Home className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold">{visitStats.routine}</p>
                    <p className="text-xs text-muted-foreground">Rotina</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Bug className="h-4 w-4 text-orange-600" />
                  <div>
                    <p className="text-2xl font-bold">{visitStats.liraa}</p>
                    <p className="text-xs text-muted-foreground">LIRAa</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Zap className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold">{visitStats.pendingSync}</p>
                    <p className="text-xs text-muted-foreground">Pendentes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Offline notice */}
          {!isOnline && (
            <Card className="border-yellow-300 bg-yellow-50">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-yellow-800">
                  <WifiOff className="h-4 w-4 flex-shrink-0" />
                  <p className="text-sm font-medium">Você está offline. As visitas serão salvas localmente e sincronizadas quando a conexão voltar.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Botão de Sincronização */}
          {(visitStats.pendingSync > 0 || wrapperPendingCount > 0) && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Sincronização Pendente</h3>
                    <p className="text-sm text-muted-foreground">
                      {visitStats.pendingSync + wrapperPendingCount} ite{visitStats.pendingSync + wrapperPendingCount === 1 ? 'm aguardando' : 'ns aguardando'} sincronização com o servidor
                    </p>
                    {lastSyncAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Última sincronização: {format(lastSyncAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                  <Button onClick={handleSyncVisits} disabled={isSyncing || isWrapperSyncing || !isOnline} className="flex items-center space-x-2">
                    {(isSyncing || isWrapperSyncing) ? (
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    <span>{(isSyncing || isWrapperSyncing) ? 'Sincronizando...' : 'Sincronizar'}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <VisitHistory
            visits={savedVisits}
            onVisitClick={(visit) => {
              setSelectedVisit(visit);
              setIsDetailsModalOpen(true);
            }}
            onVisitUpdated={loadVisits}
            user={user}
            onEditOvitrampasVisit={handleEditOvitrampasFullForm}
            onFillOvitrampasQuantities={handleEditOvitrampasVisit}
          />
        </TabsContent>
      </Tabs>

      {/* Modal de Detalhes da Visita */}
      <VisitDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedVisit(null);
        }}
        visit={selectedVisit}
      />

      {/* Modal para editar contagens de ovitrampas */}
      <OvitrampasQuantitiesModal
        isOpen={isEditingOvitrampas}
        visit={editingOvitrampasVisit}
        quantities={tempOvitrampasQuantities}
        onQuantitiesChange={setTempOvitrampasQuantities}
        onSave={handleSaveOvitrampasQuantities}
        onClose={() => {
          setIsEditingOvitrampas(false);
          setEditingOvitrampasVisit(null);
        }}
        isSaving={false}
      />

      {/* Modal para editar formulário completo de ovitrampas */}
      <OvitrampasFullEditModal
        isOpen={isEditingOvitrampasFullForm}
        visit={editingOvitrampasFullFormVisit}
        formData={editingOvitrampasFullFormData}
        onFormDataChange={setEditingOvitrampasFullFormData}
        ovitraps={ovitraps}
        onCreateOvitrap={handleCreateOvitrap}
        isSavingOvitrap={isSavingOvitrap}
        agents={agents}
        selectedAgentId={editingOvitrampasFullFormAgentId}
        onSelectedAgentChange={setEditingOvitrampasFullFormAgentId}
        isLoadingAgents={isLoadingAgents}
        onSave={handleSaveOvitrampasFullForm}
        onClose={() => {
          setIsEditingOvitrampasFullForm(false);
          setEditingOvitrampasFullFormVisit(null);
        }}
      />
    </>
  );
}

// Routine Visit Form Component
function RoutineVisitFormContent({
  form,
  setForm,
  controlMeasures
}: {
  form: Partial<RoutineVisitForm>;
  setForm: React.Dispatch<React.SetStateAction<Partial<RoutineVisitForm>>>;
  controlMeasures: string[];
}) {
  const breedingSiteOptions = [
    { key: 'waterReservoir', label: 'Reservatórios de água', icon: Droplets },
    { key: 'tires', label: 'Pneus', icon: Zap },
    { key: 'bottles', label: 'Garrafas/Recipientes', icon: Building },
    { key: 'cans', label: 'Latas/Embalagens', icon: Building },
    { key: 'buckets', label: 'Baldes/Bacias', icon: Droplets },
    { key: 'plantPots', label: 'Vasos de plantas', icon: Home },
    { key: 'gutters', label: 'Calhas/Lajes', icon: Building },
    { key: 'pools', label: 'Piscinas/Fontes', icon: Droplets },
    { key: 'wells', label: 'Poços/Cisternas', icon: Droplets },
    { key: 'tanks', label: 'Caixas d\'água', icon: Droplets },
    { key: 'drains', label: 'Ralos/Bueiros', icon: Building }
  ];

  return (
    <>
      {/* Breeding Sites */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Droplets className="h-5 w-5" />
            <span>Tipos de Criadouros Encontrados</span>
          </CardTitle>
          <CardDescription>
            Marque os tipos de criadouros identificados no local (conforme Manual MS)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {breedingSiteOptions.map(({ key, label, icon: Icon }) => (
              <div key={key} className="flex items-center space-x-2">
                <Checkbox
                  id={key}
                  checked={Boolean(form.breedingSites![key as keyof typeof form.breedingSites])}
                  onCheckedChange={(checked) => {
                    setForm(prev => ({
                      ...prev,
                      breedingSites: {
                        ...prev.breedingSites!,
                        [key]: checked as boolean
                      }
                    }));
                  }}
                />
                <Label htmlFor={key} className="flex items-center space-x-2 cursor-pointer">
                  <Icon className="h-4 w-4" />
                  <span className="text-sm">{label}</span>
                </Label>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            <Label htmlFor="others">Outros criadouros</Label>
            <Input
              id="others"
              value={form.breedingSites!.others || ''}
              onChange={(e) => setForm(prev => ({
                ...prev,
                breedingSites: { ...prev.breedingSites!, others: e.target.value }
              }))}
              placeholder="Descreva outros tipos de criadouros encontrados"
            />
          </div>
        </CardContent>
      </Card>

      {/* Larvae and Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bug className="h-5 w-5" />
            <span>Presença de Larvas e Controle</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="larvaeFound"
                checked={form.larvaeFound || false}
                onCheckedChange={(checked) => setForm(prev => ({ ...prev, larvaeFound: checked as boolean }))}
              />
              <Label htmlFor="larvaeFound">Larvas encontradas</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="pupaeFound"
                checked={form.pupaeFound || false}
                onCheckedChange={(checked) => setForm(prev => ({ ...prev, pupaeFound: checked as boolean }))}
              />
              <Label htmlFor="pupaeFound">Pupas encontradas</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Medidas de controle aplicadas</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {controlMeasures.map(measure => (
                <div key={measure} className="flex items-center space-x-2">
                  <Checkbox
                    id={measure}
                    checked={form.controlMeasures!.includes(measure) || false}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setForm(prev => ({
                          ...prev,
                          controlMeasures: [...(prev.controlMeasures || []), measure]
                        }));
                      } else {
                        setForm(prev => ({
                          ...prev,
                          controlMeasures: prev.controlMeasures?.filter(m => m !== measure) || []
                        }));
                      }
                    }}
                  />
                  <Label htmlFor={measure} className="text-sm">{measure}</Label>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              💡 O nível de risco será calculado automaticamente com base nos dados inseridos e índices gerados.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// LIRAa Form Component
function LIRAAFormContent({
  form,
  setForm,
  larvaeSpecies
}: {
  form: Partial<LIRAAVisitForm>;
  setForm: React.Dispatch<React.SetStateAction<Partial<LIRAAVisitForm>>>;
  larvaeSpecies: string[];
}) {
  const containerTypes = [
    { key: 'a1', label: 'A1 – Depósitos de águas elevados (Caixas d\'água, tambores, etc.)' },
    { key: 'a2', label: 'A2 – Depósitos de água a nível de solo (Caixas d\'água, tanques, cisternas, etc)' },
    { key: 'b', label: 'B – Depósitos móveis (Vasos de planta, recipientes, fontes, etc)' },
    { key: 'c', label: 'C – Depósitos fixos (Calhas, lajes, toldos, etc)' },
    { key: 'd1', label: 'D1 – Passíveis de remoção – Pneus e materiais rodantes' },
    { key: 'd2', label: 'D2 – Passíveis de remoção – Outros depósitos (garrafas, plásticos, lixo)' },
    { key: 'e', label: 'E – Naturais (Plantas, buracos em rochas, etc)' }
  ];

  return (
    <>
      {/* Property Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building className="h-5 w-5" />
            <span>Informações do Imóvel</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de imóvel</Label>
            <Select
              value={form.propertyType}
              onValueChange={(value: any) => setForm(prev => ({ ...prev, propertyType: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="residential">Residencial</SelectItem>
                <SelectItem value="commercial">Comercial</SelectItem>
                <SelectItem value="institutional">Institucional</SelectItem>
                <SelectItem value="vacant">Terreno baldio</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="inspected"
                checked={form.inspected || false}
                onCheckedChange={(checked) => setForm(prev => ({ ...prev, inspected: checked as boolean }))}
              />
              <Label htmlFor="inspected">Inspecionado</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="refused"
                checked={form.refused || false}
                onCheckedChange={(checked) => setForm(prev => ({ ...prev, refused: checked as boolean }))}
              />
              <Label htmlFor="refused">Recusado</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="closed"
                checked={form.closed || false}
                onCheckedChange={(checked) => setForm(prev => ({ ...prev, closed: checked as boolean }))}
              />
              <Label htmlFor="closed">Fechado</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Container Inspection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Droplets className="h-5 w-5" />
            <span>Inspeção de Recipientes</span>
          </CardTitle>
          <CardDescription>
            Registre a quantidade de recipientes por categoria (conforme LIRAa/MS)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {containerTypes.map(({ key, label }) => (
              <div key={key} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{label}</Label>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor={`${key}-total`} className="text-xs">Total:</Label>
                    <Input
                      id={`${key}-total`}
                      type="number"
                      min="0"
                      value={form.containers![key as keyof typeof form.containers] || 0}
                      onChange={(e) => setForm(prev => ({
                        ...prev,
                        containers: {
                          ...prev.containers!,
                          [key]: parseInt(e.target.value) || 0
                        }
                      }))}
                      className="w-20"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Positivos para larvas</Label>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor={`${key}-positive`} className="text-xs">Positivos:</Label>
                    <Input
                      id={`${key}-positive`}
                      type="number"
                      min="0"
                      max={form.containers![key as keyof typeof form.containers] || 0}
                      value={form.positiveContainers![key as keyof typeof form.positiveContainers] || 0}
                      onChange={(e) => setForm(prev => ({
                        ...prev,
                        positiveContainers: {
                          ...prev.positiveContainers!,
                          [key]: parseInt(e.target.value) || 0
                        }
                      }))}
                      className="w-20"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Species and Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bug className="h-5 w-5" />
            <span>Espécies e Ações Realizadas</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Espécies de larvas identificadas</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {larvaeSpecies.map(species => (
                <div key={species} className="flex items-center space-x-2">
                  <Checkbox
                    id={species}
                    checked={form.larvaeSpecies!.includes(species) || false}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setForm(prev => ({
                          ...prev,
                          larvaeSpecies: [...(prev.larvaeSpecies || []), species]
                        }));
                      } else {
                        setForm(prev => ({
                          ...prev,
                          larvaeSpecies: prev.larvaeSpecies?.filter(s => s !== species) || []
                        }));
                      }
                    }}
                  />
                  <Label htmlFor={species} className="text-sm">{species}</Label>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="treatmentApplied"
                checked={form.treatmentApplied || false}
                onCheckedChange={(checked) => setForm(prev => ({ ...prev, treatmentApplied: checked as boolean }))}
              />
              <Label htmlFor="treatmentApplied">Tratamento aplicado</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="eliminationAction"
                checked={form.eliminationAction || false}
                onCheckedChange={(checked) => setForm(prev => ({ ...prev, eliminationAction: checked as boolean }))}
              />
              <Label htmlFor="eliminationAction">Ação de eliminação</Label>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// Ovitrampas Form Component
function OvitrampasFormContent({
  form,
  setForm,
  ovitraps,
  onCreateOvitrap,
  isSavingOvitrap,
  agents,
  selectedAgentId,
  onSelectedAgentChange,
  isLoadingAgents,
}: {
  form: Partial<OvitrampasVisitForm>;
  setForm: React.Dispatch<React.SetStateAction<Partial<OvitrampasVisitForm>>>;
  larvaeSpecies: string[];
  ovitraps: IOvitrap[];
  onCreateOvitrap: (payload: { nome: string; codigo: string; endereco: string }) => Promise<void>;
  isSavingOvitrap: boolean;
  agents: IUserWithId[];
  selectedAgentId: string;
  onSelectedAgentChange: (value: string) => void;
  isLoadingAgents: boolean;
}) {
  const ADD_NEW_OVITRAP = '__add_new_ovitrap__';
  const [showCreateIdentificationForm, setShowCreateIdentificationForm] = useState(false);
  const [newIdentification, setNewIdentification] = useState({
    nome: '',
    codigo: '',
    endereco: '',
  });

  const handleSelectIdentification = (value: string) => {
    if (value === ADD_NEW_OVITRAP) {
      setShowCreateIdentificationForm(true);
      return;
    }

    const selected = ovitraps.find(item => item.id === value);
    if (!selected) {
      return;
    }

    setShowCreateIdentificationForm(false);
    setForm(prev => ({
      ...prev,
      ovitrapId: selected.id,
      ovitrapNome: selected.nome || '',
      ovitrapCodigo: selected.codigo || '',
      ovitrapEndereco: selected.endereco || '',
    }));
  };

  const handleSaveNewIdentification = async () => {
    const nome = newIdentification.nome.trim();
    const codigo = newIdentification.codigo.trim();
    const endereco = newIdentification.endereco.trim();

    if (!nome && !codigo && !endereco) {
      toast({
        title: 'Preencha ao menos um dos campos',
        description: 'Nome, código e endereço para criar essa identificação.',
        variant: 'destructive',
      });
      return;
    }

    await onCreateOvitrap({ nome, codigo, endereco });
    setShowCreateIdentificationForm(false);
    setNewIdentification({ nome: '', codigo: '', endereco: '' });
  };

  const selectedIdentificationLabel =
    form.ovitrapNome || form.ovitrapCodigo || form.ovitrapEndereco
      ? `${form.ovitrapNome || 'Sem nome'} • ${form.ovitrapCodigo || 'Sem código'} • ${form.ovitrapEndereco || 'Sem endereço'}`
      : undefined;

  return (
    <>
      {/* Property Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building className="h-5 w-5" />
            <span>Identificação da Ovitrampa</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Identificação</Label>
            <Select
              value={showCreateIdentificationForm ? ADD_NEW_OVITRAP : (form.ovitrapId || undefined)}
              onValueChange={handleSelectIdentification}
            >
              <SelectTrigger>
                <SelectValue placeholder={selectedIdentificationLabel || "Selecione por nome, código ou endereço"} />
              </SelectTrigger>
              <SelectContent>
                {ovitraps.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.nome || 'Sem nome'} • {item.codigo || 'Sem código'} • {item.endereco || 'Sem endereço'}
                  </SelectItem>
                ))}
                <SelectItem value={ADD_NEW_OVITRAP}>Adicionar um novo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showCreateIdentificationForm && (
            <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="new-ovitrap-nome">Nome</Label>
                  <Input
                    id="new-ovitrap-nome"
                    value={newIdentification.nome}
                    onChange={(e) => setNewIdentification(prev => ({ ...prev, nome: e.target.value }))}
                    placeholder="Ex.: Escola Municipal A"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-ovitrap-codigo">Código</Label>
                  <Input
                    id="new-ovitrap-codigo"
                    value={newIdentification.codigo}
                    onChange={(e) => setNewIdentification(prev => ({ ...prev, codigo: e.target.value }))}
                    placeholder="Ex.: OVT-001"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-ovitrap-endereco">Endereço</Label>
                  <Input
                    id="new-ovitrap-endereco"
                    value={newIdentification.endereco}
                    onChange={(e) => setNewIdentification(prev => ({ ...prev, endereco: e.target.value }))}
                    placeholder="Ex.: Rua das Flores, 123"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleSaveNewIdentification}
                  disabled={isSavingOvitrap}
                >
                  {isSavingOvitrap ? 'Salvando...' : 'Salvar nova identificação'}
                </Button>
              </div>
            </div>
          )}

          {(form.ovitrapNome || form.ovitrapCodigo || form.ovitrapEndereco) && !showCreateIdentificationForm && (
            <div className="rounded-lg border p-3 bg-muted/30 text-sm">
              <p><strong>Nome:</strong> {form.ovitrapNome || 'Não informado'}</p>
              <p><strong>Código:</strong> {form.ovitrapCodigo || 'Não informado'}</p>
              <p><strong>Endereço:</strong> {form.ovitrapEndereco || 'Não informado'}</p>
            </div>
          )}

        </CardContent>
      </Card>

      {/* Container Situation Ovitrampa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Droplets className="h-5 w-5" />
            <span>Situação da ovitrampa</span>
          </CardTitle>
          <CardDescription>
            Selecione o status atual da ovitrampa durante a visita
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={form.refused ? 'refused' : form.closed ? 'closed' : 'inspected'}
            onValueChange={(value) => {
              setForm((prev) => ({
                ...prev,
                inspected: value === 'inspected',
                refused: value === 'refused',
                closed: value === 'closed',
              }));
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="inspected" id="ovitrap-status-inspected" />
                <Label htmlFor="ovitrap-status-inspected" className="cursor-pointer">Inspecionada</Label>
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="refused" id="ovitrap-status-refused" />
                <Label htmlFor="ovitrap-status-refused" className="cursor-pointer">Recusada</Label>
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="closed" id="ovitrap-status-closed" />
                <Label htmlFor="ovitrap-status-closed" className="cursor-pointer">Fechada</Label>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Larvae Presence */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Droplets className="h-5 w-5" />
            <span>Presença de larvas</span>
          </CardTitle>
          <CardDescription>
            Identifique se há presença de larvas na ovitrampa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={form.larvaeFound ? 'sim' : 'nao'}
            onValueChange={(value) => {
              setForm((prev) => ({
                ...prev,
                larvaeFound: value === 'sim',
              }));
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="sim" id="ovitrap-larvae-yes" />
                <Label htmlFor="ovitrap-larvae-yes" className="cursor-pointer">Sim</Label>
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="nao" id="ovitrap-larvae-no" />
                <Label htmlFor="ovitrap-larvae-no" className="cursor-pointer">Não</Label>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Maintenance Performed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Droplets className="h-5 w-5" />
            <span>Manutenção realizada</span>
          </CardTitle>
          <CardDescription>
            Informe se a manutenção da ovitrampa foi realizada nesta visita
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={form.manutencaoRealizada ? 'sim' : 'nao'}
            onValueChange={(value) => {
              setForm((prev) => ({
                ...prev,
                manutencaoRealizada: value === 'sim',
              }));
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="sim" id="ovitrap-maintenance-yes" />
                <Label htmlFor="ovitrap-maintenance-yes" className="cursor-pointer">Sim</Label>
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="nao" id="ovitrap-maintenance-no" />
                <Label htmlFor="ovitrap-maintenance-no" className="cursor-pointer">Não</Label>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Visit Date */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Droplets className="h-5 w-5" />
            <span>Data da visita</span>
          </CardTitle>
          <CardDescription>
            Informe a data da visita da ovitrampa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-sm">
            <Label htmlFor="ovitrampa-data-visita">Data</Label>
            <DatePickerInput
              id="ovitrampa-data-visita"
              value={form.dataVisita}
              onChange={(date) => setForm(prev => ({
                ...prev,
                dataVisita: date
              }))}
              placeholder="Selecione a data da visita"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agente Responsável</CardTitle>
          <CardDescription>
            Selecione o agente que está realizando esta visita
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedAgentId} onValueChange={onSelectedAgentChange}>
            <SelectTrigger disabled={isLoadingAgents || agents.length === 0}>
              <SelectValue placeholder={isLoadingAgents ? 'Carregando agentes...' : 'Selecione um agente'} />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {agents.length === 0 && !isLoadingAgents && (
            <p className="text-sm text-muted-foreground mt-2">
              Nenhum agente ativo encontrado para esta organização.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// Ovitrampas Quantities Modal
function OvitrampasQuantitiesModal({
  isOpen,
  visit,
  quantities,
  onQuantitiesChange,
  onSave,
  onClose,
  isSaving,
}: {
  isOpen: boolean;
  visit: OvitrampasVisitForm | null;
  quantities: { ovos: number; larvas: number };
  onQuantitiesChange: (quantities: { ovos: number; larvas: number }) => void;
  onSave: () => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
}) {
  if (!isOpen || !visit) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="border-b sticky top-0 bg-white">
          <CardTitle className="flex items-center space-x-2">
            <Droplets className="h-5 w-5 text-blue-500" />
            <span>Preencher Contagem de Ovos e Larvas</span>
          </CardTitle>
          <CardDescription>
            Ovitrampa: {visit.ovitrapNome} ({visit.ovitrapCodigo})
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          {/* Summary */}
          <div className="space-y-3 text-sm bg-muted p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Status</p>
                <p className="font-semibold">
                  {visit.refused ? 'Recusada' : visit.closed ? 'Fechada' : 'Inspecionada'}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Larvas Encontradas</p>
                <p className="font-semibold">{visit.larvaeFound ? 'Sim' : 'Não'}</p>
              </div>
            </div>
          </div>

          {/* Quantity Inputs */}
          <div className="space-y-4">
            {/* Eggs Count */}
            <div className="space-y-3">
              <Label htmlFor="modal-ovos-count" className="text-base font-semibold flex items-center space-x-2">
                <Droplets className="h-5 w-5 text-blue-500" />
                <span>Quantidade de Ovos</span>
              </Label>
              <Input
                id="modal-ovos-count"
                type="number"
                min="0"
                max="999999"
                value={quantities.ovos}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  onQuantitiesChange({ ...quantities, ovos: Math.max(0, value) });
                }}
                placeholder="0"
                className="text-lg p-3"
              />
            </div>

            {/* Larvae Count */}
            <div className="space-y-3">
              <Label htmlFor="modal-larvas-count" className="text-base font-semibold flex items-center space-x-2">
                <Bug className="h-5 w-5 text-red-500" />
                <span>Quantidade de Larvas</span>
              </Label>
              <Input
                id="modal-larvas-count"
                type="number"
                min="0"
                max="999999"
                value={quantities.larvas}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  onQuantitiesChange({ ...quantities, larvas: Math.max(0, value) });
                }}
                placeholder="0"
                className="text-lg p-3"
              />
            </div>

            {/* Summary Box */}
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>Total a registrar:</strong> {quantities.ovos + quantities.larvas} indivíduos
              </p>
            </div>
          </div>
        </CardContent>

        <div className="border-t bg-muted/30 p-6 flex justify-end space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Contagem
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// Visit History Component
function VisitHistory({
  visits,
  onVisitClick,
  onVisitUpdated,
  user,
  onEditOvitrampasVisit,
  onFillOvitrampasQuantities
}: {
  visits: (RoutineVisitForm | LIRAAVisitForm | OvitrampasVisitForm)[];
  onVisitClick: (visit: RoutineVisitForm | LIRAAVisitForm | OvitrampasVisitForm) => void;
  onVisitUpdated: () => void;
  user: any;
  onEditOvitrampasVisit?: (visit: OvitrampasVisitForm) => void;
  onFillOvitrampasQuantities?: (visit: OvitrampasVisitForm) => void;
}) {
  // Função para renderizar status de sincronização
  const getSyncStatusBadge = (syncStatus: string, syncError?: string) => {
    switch (syncStatus) {
      case 'synced':
        return (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Sincronizada
          </Badge>
        );
      case 'syncing':
        return (
          <Badge variant="secondary" className="bg-blue-500 hover:bg-blue-600 text-white">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Sincronizando
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="bg-red-500 hover:bg-red-600">
            <AlertCircle className="h-3 w-3 mr-1" />
            Erro
          </Badge>
        );
      case 'pending':
      default:
        return (
          <Badge variant="outline" className="bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500">
            <WifiOff className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
    }
  };

  const formatVisitDate = (timestamp: unknown) => {
    return format(parseVisitTimestamp(timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  if (visits.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhuma visita registrada</h3>
          <p className="text-muted-foreground mb-4">
            Comece registrando sua primeira visita de campo
          </p>
        </CardContent>
      </Card>
    );
  }



  return (
    <div className="grid gap-4">
      {visits.map((visit) => {
        const timestampDate = parseVisitTimestamp(visit.timestamp);
        return (
          <Card key={visit.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onVisitClick(visit)}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-medium text-lg">{visit.neighborhood}</h3>
                    {visit.type === 'routine' ? (
                      <Badge className="bg-blue-500 hover:bg-blue-600 text-white border-0">
                        <Home className="h-3 w-3 mr-1" />
                        Rotina
                      </Badge>
                    ) : visit.type === 'liraa' ? (
                      <Badge className="bg-orange-500 hover:bg-orange-600 text-white border-0">
                        <Bug className="h-3 w-3 mr-1" />
                        LIRAa
                      </Badge>
                    ) : (
                      <Badge className="bg-purple-500 hover:bg-purple-600 text-white border-0">
                        <Droplets className="h-3 w-3 mr-1" />
                        Ovitrampa
                      </Badge>
                    )}
                    {getSyncStatusBadge(visit.syncStatus, visit.syncError)}
                    {visit.type === 'ovitrampas' && (
                      (visit as OvitrampasVisitForm).quantidadeOvos === undefined || (visit as OvitrampasVisitForm).quantidadeOvos === null || (visit as OvitrampasVisitForm).quantidadeLarvas === undefined || (visit as OvitrampasVisitForm).quantidadeLarvas === null
                    ) ? (
                      <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white border-0">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Incompleto
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <Eye className="h-3 w-3" />
                    <span>Clique para ver detalhes</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {visit.location?.address || 'Localização não disponível'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatVisitDate(timestampDate)}
                  </p>
                  {visit.syncError && (
                    <div className="flex items-center space-x-2">
                      <p className="text-xs text-red-500">
                        Erro: {visit.syncError}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const success = await visitsService.retrySyncVisit(visit.id);
                          if (success) {
                            toast({
                              title: "Visita sincronizada!",
                              description: "A visita foi enviada com sucesso para o servidor.",
                            });
                            // Recarregar visitas
                            onVisitUpdated();
                          } else {
                            toast({
                              title: "Erro na sincronização",
                              description: "Não foi possível sincronizar a visita. Tente novamente.",
                              variant: "destructive"
                            });
                          }
                        }}
                        className="h-6 px-2 text-xs"
                      >
                        <Zap className="h-3 w-3 mr-1" />
                        Tentar Novamente
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  {/* Botão de Contagem (Step 2) - acessível a agentes de laboratório */}
                  {visit.type === 'ovitrampas' && onFillOvitrampasQuantities && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onFillOvitrampasQuantities(visit as OvitrampasVisitForm);
                      }}
                      className="h-8 px-3 border-blue-300 text-blue-700 hover:bg-blue-50"
                    >
                      <Droplets className="h-4 w-4 mr-1" />
                      Contagem
                    </Button>
                  )}

                  {/* Botão Editar e Excluir - só para Supervisores e Administradores */}
                  {user?.role && user.role !== 'agent' && (
                    <>
                      {visit.type === 'ovitrampas' && onEditOvitrampasVisit && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditOvitrampasVisit(visit as OvitrampasVisitForm);
                          }}
                          className="h-8 px-3"
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={async (e) => {
                          e.stopPropagation(); // Evita abrir o modal de detalhes

                          if (confirm(`Tem certeza que deseja excluir esta visita?\n\nBairro: ${visit.neighborhood}\nData: ${formatVisitDate(timestampDate)}\n\nEsta ação não pode ser desfeita.`)) {
                            try {
                              await visitsService.deleteVisit(visit.id);
                              toast({
                                title: "Visita excluída!",
                                description: "A visita foi removida do sistema.",
                              });
                              // Recarregar a lista de visitas
                              onVisitUpdated();
                            } catch (error) {
                              toast({
                                title: "Erro ao excluir visita",
                                description: "Não foi possível excluir a visita. Tente novamente.",
                                variant: "destructive"
                              });
                            }
                          }
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Agente:</span>
                  <p className="font-medium">{visit.agentName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tipo:</span>
                  <p className="font-medium">
                    {visit.type === 'routine' ? 'Visita de Rotina' : visit.type === 'liraa' ? 'LIRAa' : 'Ovitrampa'}
                  </p>
                </div>
                {visit.type === 'routine' && (
                  <>
                    <div>
                      <span className="text-muted-foreground">Larvas:</span>
                      <p className="font-medium">{visit.larvaeFound ? 'Sim' : 'Não'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Risco:</span>
                      <Badge className={"bg-info"}>
                        Em análise
                      </Badge>
                    </div>
                  </>
                )}
                {visit.type === 'ovitrampas' && (
                  <>
                    <div>
                      <span className="text-muted-foreground">Larvas:</span>
                      <p className="font-medium">{(visit as OvitrampasVisitForm).larvaeFound ? 'Sim' : 'Não'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total encontrado:</span>
                      <p className="font-medium">
                        {((visit as OvitrampasVisitForm).quantidadeOvos || 0) + ((visit as OvitrampasVisitForm).quantidadeLarvas || 0)} indivíduos
                      </p>
                    </div>
                  </>
                )}
              </div>

              {visit.observations && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <p className="text-sm">{visit.observations}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  );
}

// Ovitrampas Full Edit Modal
function OvitrampasFullEditModal({
  isOpen,
  visit,
  formData,
  onFormDataChange,
  ovitraps,
  onCreateOvitrap,
  isSavingOvitrap,
  agents,
  selectedAgentId,
  onSelectedAgentChange,
  isLoadingAgents,
  onSave,
  onClose,
}: {
  isOpen: boolean;
  visit: OvitrampasVisitForm | null;
  formData: Partial<OvitrampasVisitForm>;
  onFormDataChange: React.Dispatch<React.SetStateAction<Partial<OvitrampasVisitForm>>>;
  ovitraps: IOvitrap[];
  onCreateOvitrap: (payload: { nome: string; codigo: string; endereco: string }) => Promise<void>;
  isSavingOvitrap: boolean;
  agents: IUserWithId[];
  selectedAgentId: string;
  onSelectedAgentChange: (value: string) => void;
  isLoadingAgents: boolean;
  onSave: () => Promise<void>;
  onClose: () => void;
}) {
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen || !visit) {
    return null;
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="border-b sticky top-0 bg-white z-10">
          <CardTitle className="flex items-center space-x-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            <span>Editar Visita de Ovitrampa</span>
          </CardTitle>
          <CardDescription>
            Editando: {visit.ovitrapNome || 'Sem nome'} ({visit.ovitrapCodigo || 'Sem código'})
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6">
          <OvitrampasFormContent
            form={formData}
            setForm={onFormDataChange}
            larvaeSpecies={[]}
            ovitraps={ovitraps}
            onCreateOvitrap={onCreateOvitrap}
            isSavingOvitrap={isSavingOvitrap}
            agents={agents}
            selectedAgentId={selectedAgentId}
            onSelectedAgentChange={onSelectedAgentChange}
            isLoadingAgents={isLoadingAgents}
          />

          {/* Observations */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Observações</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.observations || ''}
                onChange={(e) => onFormDataChange(prev => ({ ...prev, observations: e.target.value }))}
                placeholder="Observações adicionais sobre a visita..."
                rows={4}
              />
            </CardContent>
          </Card>
        </CardContent>

        <div className="border-t bg-muted/30 p-6 flex justify-end space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Visita
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
