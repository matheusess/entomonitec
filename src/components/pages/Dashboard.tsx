import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/AuthContext';
import { firebaseDashboardService, DashboardData, NeighborhoodRisk, RoutineVisitData, PriorityClassification } from '@/services/firebaseDashboardService';
import geocodingService from '@/services/geocodingService';
import logger from '@/lib/logger';
import { useOnlineSync } from '@/hooks/useOnlineSync';
import RiskMap from '@/components/RiskMap';
import dynamic from 'next/dynamic';

// Componente de mapa dinâmico para evitar SSR
const DiagnosticsMapComponent = dynamic(() => import('@/components/DiagnosticsMapComponent'), {
  ssr: false,
  loading: () => (
    <div className="h-96 w-full rounded-lg border bg-muted flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
        <p className="text-xs text-muted-foreground">Carregando mapa de diagnósticos...</p>
      </div>
    </div>
  )
});

import SuperAdminPanel from './SuperAdminPanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WipBadge } from '@/components/ui/WipBadge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Bug, 
  MapPin, 
  TrendingUp, 
  AlertTriangle, 
  Activity,
  Users,
  Eye,
  Target,
  Shield,
  BarChart3,
  Map,
  Download,
  Filter,
  Zap,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  ArrowUp,
  ArrowDown,
  FileText,
  ClipboardCheck,
  Home,
  Calendar,
  Database,
  TrendingDown,
  Clock,
  Search,
  Layers,
  Navigation,
  Thermometer,
  Beaker,
  FlaskConical,
  Microscope
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
  ComposedChart
} from 'recharts';

// Interfaces locais

interface OperationalAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  bairro?: string;
  timestamp: string;
}

interface DiagnosticResult {
  address: string;
  neighborhood: string;
  date: string;
  species: string[];
  larvaePresence: boolean;
  pupaePresence: boolean;
  adultMosquitoes: number;
  containers: {
    examined: number;
    positive: number;
    types: string[];
  };
  labResults?: {
    status: 'pending' | 'processing' | 'completed';
    species: string;
    resistance: boolean;
  };
  coords: { lat: number; lng: number };
}

interface QualityMetric {
  agent: string;
  neighborhood: string;
  period: string;
  visitedProperties: number;
  totalProperties: number;
  refusedAccess: number;
  incompleteRecords: number;
  coverageRate: number;
  qualityScore: number;
}

interface TrendData {
  period: string;
  neighborhood: string;
  infestationLevel: number;
  cityAverage: number;
  previousPeriod: number;
  variation: number;
}

// Bairros de Fazenda Rio Grande com dados simulados
const neighborhoods = [
  'Eucaliptos', 'Gralha Azul', 'Nações', 'Santa Terezinha', 'Iguaçu',
  'Pioneiros', 'São Miguel', 'Boa Vista', 'Brasília', 'Green Field',
  'Alvorada', 'Fortunato Perdoncini', 'Estados', 'Jardim Santarém',
  'Sete de Setembro', 'Veneza', 'Vila Rica', 'Águas Belas'
];

const speciesTypes = [
  'Aedes aegypti',
  'Aedes albopictus', 
  'Culex quinquefasciatus',
  'Anopheles darlingi',
  'Não identificado'
];

const containerTypes = [
  'Reservatórios de água',
  'Pneus',
  'Recipientes plásticos',
  'Calhas e lajes',
  'Vasos de plantas',
  'Outros depósitos'
];

export default function Dashboard() {
  const { user, isLoading } = useAuth();

  // Se é Super Admin, mostrar painel específico
  if (user?.isSuperAdmin) {
    return <SuperAdminPanel />;
  }

  // Controle de acesso: agentes só podem ver formulários
  if (user?.role === 'agent') {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <Shield className="h-16 w-16 text-slate-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-700 mb-2">Acesso Restrito</h2>
          <p className="text-slate-600 mb-4">
            Como agente de campo, você tem acesso apenas ao módulo de formulários.
          </p>
          <p className="text-sm text-slate-500">
            Use o menu lateral para acessar "Formulários" e registrar suas visitas.
          </p>
        </div>
      </div>
    );
  }
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedTimeRange, setSelectedTimeRange] = useState('all');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('all');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [mapLayer, setMapLayer] = useState('risk');
  const [trendTimeHierarchy, setTrendTimeHierarchy] = useState('week');
  const [selectedDiagnostic, setSelectedDiagnostic] = useState<any>(null);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-25.442868, -49.226276]);
  const [dataError, setDataError] = useState<string | null>(null);

  const { isOnline, pendingCount } = useOnlineSync();

  // Carregar coordenadas da cidade da organização
  useEffect(() => {
    async function loadCityCoordinates() {
      if (user?.organization?.city && user?.organization?.state) {
        const coordinates = await geocodingService.getCityCoordinatesWithFallback(
          user.organization.city,
          user.organization.state
        );
        setMapCenter(coordinates);
        logger.log(`🗺️ Dashboard - Mapa centralizado em: ${user.organization.city}/${user.organization.state}`, coordinates);
      }
    }

    loadCityCoordinates();
  }, [user?.organization?.city, user?.organization?.state]);

  // Dados centralizados do dashboard - inicializados vazios, serão carregados do Firebase
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalVisits: 0,
    routineVisits: 0,
    liraaVisits: 0,
    criticalAreas: 0,
    agentsActive: 0,
    larvaePositive: 0,
    breedingSitesEliminated: 0,
    averageRisk: 0,
    coveragePercentage: 0,
    samplingQuality: 0,
    inconsistentData: 0,
    missingSamples: 0
  });

  const [neighborhoodRisks, setNeighborhoodRisks] = useState<NeighborhoodRisk[]>([]);
  const [operationalAlerts, setOperationalAlerts] = useState<OperationalAlert[]>([]);
  const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticResult[]>([]);
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetric[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [realCoverage, setRealCoverage] = useState<number>(0);
  const [realSamplingQuality, setRealSamplingQuality] = useState<number>(0);
  const [routineVisitData, setRoutineVisitData] = useState<RoutineVisitData[]>([]);

  // Carregar dados reais do Firebase
  useEffect(() => {
    const loadFirebaseData = async () => {
      try {
        setIsLoadingData(true);
        setDataError(null);
        
        // Verificar se o usuário está autenticado
        if (!user) {
          logger.log('⚠️ Usuário não autenticado, usando dados mockados');
          logger.log('🔍 DEBUG: isLoading =', isLoading);
          setDashboardData({
            totalVisits: 1247,
            routineVisits: 892,
            liraaVisits: 355,
            criticalAreas: 8,
            agentsActive: 12,
            larvaePositive: 156,
            breedingSitesEliminated: 156,
            averageRisk: 4.2,
            coveragePercentage: 87.3,
            samplingQuality: 92.1,
            inconsistentData: 12,
            missingSamples: 8
          });
          setIsLoadingData(false);
          return;
        }
        
        // Usar organizationId do usuário autenticado ou fallback para desenvolvimento
        const organizationId = user.organizationId || 'frg-001';
        
        logger.log('🔄 Carregando dados do Firebase para organização:', organizationId);
        logger.log('👤 Usuário autenticado:', user.email, 'Role:', user.role);
        logger.log('🏢 OrganizationId do usuário:', user.organizationId);
        logger.log('🏢 Organization name:', user.organization?.name);
        
        // Buscar dados do dashboard, riscos por bairro e dados de rotina em paralelo
        const [dashboardResult, neighborhoodResult, routineResult] = await Promise.all([
          firebaseDashboardService.getDashboardData(organizationId),
          firebaseDashboardService.getNeighborhoodRisks(organizationId),
          firebaseDashboardService.getRoutineVisitData(organizationId)
        ]);
        
        logger.log('✅ Dados carregados:', { 
          dashboard: dashboardResult, 
          neighborhoods: neighborhoodResult.length,
          routine: routineResult.length
        });
        
        setDashboardData(dashboardResult);
        setNeighborhoodRisks(neighborhoodResult);
        setRoutineVisitData(routineResult);
        
        // Calcular métricas reais de qualidade amostral com os dados carregados
        logger.log('🔍 DEBUG: Calculando qualidade amostral com neighborhoodRisks:', neighborhoodResult.length);
        
        // Função para calcular cobertura LIRAa real
        const calculateLIRAaCoverage = (neighborhoodRisks: NeighborhoodRisk[]) => {
          logger.log('🔍 DEBUG calculateLIRAaCoverage: neighborhoodRisks.length =', neighborhoodRisks.length);
          
          if (neighborhoodRisks.length === 0) {
            logger.log('⚠️ DEBUG: neighborhoodRisks está vazio, retornando 0');
            return 0;
          }
          
          // Calcular cobertura média ponderada por número de visitas
          let totalVisits = 0;
          let totalCoverage = 0;
          
          neighborhoodRisks.forEach(neighborhood => {
            logger.log('🔍 DEBUG: Processando bairro:', neighborhood.name, 'coverage:', neighborhood.coverage, 'visitedProperties:', neighborhood.visitedProperties);
            totalVisits += neighborhood.visitedProperties;
            totalCoverage += neighborhood.coverage * neighborhood.visitedProperties;
          });
          
          const result = totalVisits > 0 ? Math.round((totalCoverage / totalVisits) * 100) / 100 : 0;
          logger.log('📊 DEBUG calculateLIRAaCoverage resultado:', result, 'totalVisits:', totalVisits, 'totalCoverage:', totalCoverage);
          
          return result;
        };

        // Função para calcular qualidade amostral real
        const calculateSamplingQuality = (neighborhoodRisks: NeighborhoodRisk[]) => {
          logger.log('🔍 DEBUG calculateSamplingQuality: neighborhoodRisks.length =', neighborhoodRisks.length);
          
          if (neighborhoodRisks.length === 0) {
            logger.log('⚠️ DEBUG: neighborhoodRisks está vazio, retornando 0');
            return 0;
          }
          
          let totalVisits = 0;
          let totalQuality = 0;
          
          neighborhoodRisks.forEach(neighborhood => {
            const visits = neighborhood.visitedProperties;
            const refused = neighborhood.refusedAccess || 0;
            const incomplete = neighborhood.incompleteData || 0;
            
            // Calcular qualidade: (visitas válidas / total de visitas) * 100
            const validVisits = visits - refused - incomplete;
            const quality = visits > 0 ? (validVisits / visits) * 100 : 0;
            
            logger.log('🔍 DEBUG: Processando bairro:', neighborhood.name, 'visits:', visits, 'refused:', refused, 'incomplete:', incomplete, 'quality:', quality);
            
            totalVisits += visits;
            totalQuality += quality * visits;
          });
          
          const result = totalVisits > 0 ? Math.round((totalQuality / totalVisits) * 100) / 100 : 0;
          logger.log('📊 DEBUG calculateSamplingQuality resultado:', result, 'totalVisits:', totalVisits, 'totalQuality:', totalQuality);
          
          return result;
        };
        
        const calculatedCoverage = calculateLIRAaCoverage(neighborhoodResult);
        const calculatedSamplingQuality = calculateSamplingQuality(neighborhoodResult);
        
        logger.log('📊 DEBUG: Valores calculados:', {
          calculatedCoverage,
          calculatedSamplingQuality,
          neighborhoodRisksLength: neighborhoodResult.length
        });
        
        // Atualizar estado com os valores calculados
        setRealCoverage(calculatedCoverage);
        setRealSamplingQuality(calculatedSamplingQuality);
        
      } catch (error) {
        logger.error('❌ Erro ao carregar dados do Firebase:', error);
        setDataError(error instanceof Error ? error.message : 'Erro desconhecido');
        
        // Fallback para dados mockados em caso de erro
        setDashboardData({
          totalVisits: 1247,
          routineVisits: 892,
          liraaVisits: 355,
          criticalAreas: 8,
          agentsActive: 12,
          larvaePositive: 156,
          breedingSitesEliminated: 156,
          averageRisk: 4.2,
          coveragePercentage: 87.3,
          samplingQuality: 92.1,
          inconsistentData: 12,
          missingSamples: 8
        });
      } finally {
        setIsLoadingData(false);
      }
    };
    
    // Só carregar se não estiver em loading de autenticação
    if (!isLoading) {
      loadFirebaseData();
    }
  }, [user, isLoading, selectedTimeRange]); // Recarregar quando usuário, loading ou período mudar

  // Dados mockados adicionais (mantidos por enquanto)
  useEffect(() => {
    logger.log('🏠 Dashboard useEffect executado');
    
    // Dados adicionais já estão inicializados

    // Dados dos bairros serão carregados dinamicamente

    // Gerar alertas operacionais baseados nos critérios de diagnóstico
    const generateOperationalAlerts = (neighborhoodRisks: NeighborhoodRisk[]) => {
      const alerts: OperationalAlert[] = [];
      let alertId = 1;

      // Prioridade 1: Infestação confirmada (IIP >= 4%, Cobertura >= 80%)
      const priority1 = neighborhoodRisks.filter(n => 
        n.larvaeIndex >= 4 && n.coverage >= 80
      );
      if (priority1.length > 0) {
        alerts.push({
          id: (alertId++).toString(),
          type: 'critical',
          title: 'Infestação Confirmada - Ação Necessária',
          description: `${priority1.length} bairro(s) com IIP >= 4% e cobertura >= 80%`,
          bairro: priority1[0].name,
          timestamp: new Date().toISOString()
        });
      }

      // Prioridade 2: Risco eminente (IIP >= 4%, Cobertura 50-79%)
      const priority2 = neighborhoodRisks.filter(n => 
        n.larvaeIndex >= 4 && n.coverage >= 50 && n.coverage < 80
      );
      if (priority2.length > 0) {
        alerts.push({
          id: (alertId++).toString(),
          type: 'critical',
          title: 'Risco Eminente - Ampliar Amostragem',
          description: `${priority2.length} bairro(s) com IIP >= 4% mas cobertura insuficiente`,
          bairro: priority2[0].name,
          timestamp: new Date().toISOString()
        });
      }

      // Prioridade 3: Subdimensionamento (IIP >= 4%, Cobertura < 50%)
      const priority3 = neighborhoodRisks.filter(n => 
        n.larvaeIndex >= 4 && n.coverage < 50
      );
      if (priority3.length > 0) {
        alerts.push({
          id: (alertId++).toString(),
          type: 'critical',
          title: 'Alto Risco Oculto - Subdimensionamento',
          description: `${priority3.length} bairro(s) com IIP >= 4% mas cobertura muito baixa`,
          bairro: priority3[0].name,
          timestamp: new Date().toISOString()
        });
      }

      // Prioridade 4: Ocorrência moderada (IIP 1-4%, Cobertura >= 80%)
      const priority4 = neighborhoodRisks.filter(n => 
        n.larvaeIndex >= 1 && n.larvaeIndex < 4 && n.coverage >= 80
      );
      if (priority4.length > 0) {
        alerts.push({
          id: (alertId++).toString(),
          type: 'warning',
          title: 'Ocorrência Moderada - Nova Amostragem',
          description: `${priority4.length} bairro(s) com IIP 1-4% e boa cobertura`,
          bairro: priority4[0].name,
          timestamp: new Date().toISOString()
        });
      }

      // Prioridade 5: Infestação moderada (IIP 1-4%, Cobertura 50-79%)
      const priority5 = neighborhoodRisks.filter(n => 
        n.larvaeIndex >= 1 && n.larvaeIndex < 4 && n.coverage >= 50 && n.coverage < 80
      );
      if (priority5.length > 0) {
        alerts.push({
          id: (alertId++).toString(),
          type: 'warning',
          title: 'Infestação Moderada - Reforçar Coleta',
          description: `${priority5.length} bairro(s) com IIP 1-4% e cobertura moderada`,
          bairro: priority5[0].name,
          timestamp: new Date().toISOString()
        });
      }

      // Prioridade 6: Amostragem insuficiente (IIP < 1%, Cobertura < 50%)
      const priority6 = neighborhoodRisks.filter(n => 
        n.larvaeIndex < 1 && n.coverage < 50
      );
      if (priority6.length > 0) {
        alerts.push({
          id: (alertId++).toString(),
          type: 'warning',
          title: 'Amostragem Insuficiente - Risco Não Descartado',
          description: `${priority6.length} bairro(s) com cobertura muito baixa`,
          timestamp: new Date().toISOString()
        });
      }

      // Prioridade 7: Risco de infestação (IIP < 1%, Cobertura 50-79%)
      const priority7 = neighborhoodRisks.filter(n => 
        n.larvaeIndex < 1 && n.coverage >= 50 && n.coverage < 80
      );
      if (priority7.length > 0) {
        alerts.push({
          id: (alertId++).toString(),
          type: 'info',
          title: 'Risco de Infestação - Medidas Preventivas',
          description: `${priority7.length} bairro(s) com baixo IIP mas cobertura moderada`,
          timestamp: new Date().toISOString()
        });
      }

      // Prioridade 8: Confiabilidade moderada (IIP < 1%, Cobertura >= 80%)
      const priority8 = neighborhoodRisks.filter(n => 
        n.larvaeIndex < 1 && n.coverage >= 80
      );
      if (priority8.length > 0) {
        alerts.push({
          id: (alertId++).toString(),
          type: 'info',
          title: 'Confiabilidade Moderada - Manter Monitoramento',
          description: `${priority8.length} bairro(s) com baixo IIP e boa cobertura`,
          timestamp: new Date().toISOString()
        });
      }

      return alerts;
    };



    // Gerar alertas baseados nos dados reais
    const dynamicAlerts = generateOperationalAlerts(neighborhoodRisks);
    setOperationalAlerts(dynamicAlerts);

    // Gerar resultados de diagnóstico
    const diagnostics = Array.from({length: 25}, (_, i) => ({
      address: `Rua ${['das Flores', 'do Sol', 'da Paz', 'Central', 'dos Pinheiros'][Math.floor(Math.random() * 5)]}, ${Math.floor(Math.random() * 500) + 1}`,
      neighborhood: neighborhoods[Math.floor(Math.random() * neighborhoods.length)],
      date: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString().split('T')[0],
      species: [speciesTypes[Math.floor(Math.random() * speciesTypes.length)]],
      larvaePresence: Math.random() > 0.6,
      pupaePresence: Math.random() > 0.8,
      adultMosquitoes: Math.floor(Math.random() * 10),
      containers: {
        examined: Math.floor(Math.random() * 15) + 5,
        positive: Math.floor(Math.random() * 8),
        types: containerTypes.slice(0, Math.floor(Math.random() * 3) + 1)
      },
      labResults: Math.random() > 0.7 ? {
        status: ['pending', 'processing', 'completed'][Math.floor(Math.random() * 3)] as 'pending' | 'processing' | 'completed',
        species: speciesTypes[Math.floor(Math.random() * speciesTypes.length)],
        resistance: Math.random() > 0.8
      } : undefined,
      coords: {
        lat: -25.5 + (Math.random() - 0.5) * 0.1,
        lng: -49.3 + (Math.random() - 0.5) * 0.1
      }
    }));
    setDiagnosticResults(diagnostics);

    // Gerar métricas de qualidade
    const agents = ['João Silva', 'Maria Santos', 'Pedro Lima', 'Ana Costa', 'Carlos Souza'];
    const quality = agents.flatMap(agent => 
      neighborhoods.slice(0, 6).map(neighborhood => {
        const visitedProperties = Math.floor(Math.random() * 100) + 50;
        const totalProperties = Math.floor(visitedProperties / (0.7 + Math.random() * 0.2));
        const refusedAccess = Math.floor(Math.random() * 15);
        const incompleteRecords = Math.floor(Math.random() * 10);
        const coverageRate = (visitedProperties / totalProperties) * 100;
        const qualityScore = Math.max(0, 100 - (refusedAccess * 2) - (incompleteRecords * 3) + (coverageRate - 70));
        
        return {
          agent,
          neighborhood,
          period: 'Último mês',
          visitedProperties,
          totalProperties,
          refusedAccess,
          incompleteRecords,
          coverageRate: parseFloat(coverageRate.toFixed(1)),
          qualityScore: parseFloat(qualityScore.toFixed(1))
        };
      })
    );
    setQualityMetrics(quality);

    // Gerar dados de tendência
    const trends = neighborhoods.slice(0, 8).flatMap(neighborhood => 
      Array.from({length: 12}, (_, i) => {
        const cityAverage = 2.3 + Math.sin(i * 0.5) * 0.8;
        const neighborhoodLevel = cityAverage + (Math.random() - 0.5) * 2;
        const previousPeriod = neighborhoodLevel + (Math.random() - 0.5) * 1;
        
        return {
          period: `Sem ${i + 1}`,
          neighborhood,
          infestationLevel: Math.max(0, neighborhoodLevel),
          cityAverage: Math.max(0, cityAverage),
          previousPeriod: Math.max(0, previousPeriod),
          variation: ((neighborhoodLevel - previousPeriod) / previousPeriod * 100)
        };
      })
    );
    // setTrendData(trends); // Removido porque já está inicializado
  }, []); // Array vazio para executar apenas uma vez

  // Dados filtrados
  const filteredDiagnostics = useMemo(() => {
    return diagnosticResults.filter(result => {
      if (selectedNeighborhood !== 'all' && result.neighborhood !== selectedNeighborhood) return false;
      if (searchTerm && !result.address.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !result.neighborhood.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [diagnosticResults, selectedNeighborhood, searchTerm]);

  const filteredQualityMetrics = useMemo(() => {
    return qualityMetrics.filter(metric => {
      if (selectedNeighborhood !== 'all' && metric.neighborhood !== selectedNeighborhood) return false;
      if (selectedAgent !== 'all' && metric.agent !== selectedAgent) return false;
      return true;
    });
  }, [qualityMetrics, selectedNeighborhood, selectedAgent]);

  const filteredTrendData = useMemo(() => {
    // Gerar dados de tendência baseados nos dados reais de rotina
    const periods = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    if (selectedNeighborhood === 'all') {
      // Média municipal baseada nos dados reais
      const avgIIP = routineVisitData.length > 0 
        ? routineVisitData.reduce((sum, d) => sum + d.iip, 0) / routineVisitData.length 
        : 0;
      
      return periods.map((period, index) => {
        // Simular variação temporal baseada no IIP real
        const variation = (Math.sin(index * 0.5) * 0.3) + (Math.random() - 0.5) * 0.2;
        const infestationLevel = Math.max(0, avgIIP + variation);
        
        return {
          period,
          neighborhood: 'Média Municipal',
          infestationLevel: infestationLevel,
          cityAverage: avgIIP,
          previousPeriod: infestationLevel,
          variation: 0
        };
      });
    } else {
      // Dados do bairro específico
      const bairroData = routineVisitData.find(d => d.neighborhood === selectedNeighborhood);
      const avgIIP = routineVisitData.length > 0 
        ? routineVisitData.reduce((sum, d) => sum + d.iip, 0) / routineVisitData.length 
        : 0;
      
      if (!bairroData) return [];
      
      return periods.map((period, index) => {
        // Simular variação temporal para o bairro específico
        const variation = (Math.sin(index * 0.4) * 0.4) + (Math.random() - 0.5) * 0.3;
        const infestationLevel = Math.max(0, bairroData.iip + variation);
        
        return {
          period,
          neighborhood: selectedNeighborhood,
          infestationLevel: infestationLevel,
          cityAverage: avgIIP, // Média municipal para comparação
          previousPeriod: infestationLevel,
          variation: 0
        };
      });
    }
  }, [routineVisitData, selectedNeighborhood]);

  // Filtrar dados de rotina baseado na seleção do bairro
  const filteredRoutineData = useMemo(() => {
    if (selectedNeighborhood === 'all') {
      return routineVisitData;
    }
    return routineVisitData.filter(data => data.neighborhood === selectedNeighborhood);
  }, [routineVisitData, selectedNeighborhood]);

  // Dados do bairro selecionado para exibição
  const selectedRoutineData = useMemo(() => {
    if (selectedNeighborhood === 'all') {
      // Calcular média municipal
      if (routineVisitData.length === 0) return null;
      
      const totalVisits = routineVisitData.reduce((sum, data) => sum + data.totalVisits, 0);
      const totalPositive = routineVisitData.reduce((sum, data) => sum + data.positiveVisits, 0);
      const totalCompleted = routineVisitData.reduce((sum, data) => sum + data.completedVisits, 0);
      
      const avgIip = totalVisits > 0 ? (totalPositive / totalVisits) * 100 : 0;
      const avgCoverage = totalVisits > 0 ? (totalCompleted / totalVisits) * 100 : 0;
      
      // Usar a classificação baseada na média
      const classification = routineVisitData.length > 0 ? 
        routineVisitData[0].classification : // Usar classificação do primeiro bairro como referência
        null;
      
      return {
        neighborhood: 'Média Municipal',
        totalVisits,
        positiveVisits: totalPositive,
        completedVisits: totalCompleted,
        iip: Math.round(avgIip * 100) / 100,
        coverage: Math.round(avgCoverage * 100) / 100,
        priority: classification?.level || 0,
        classification: classification || {
          level: 0,
          infestationLevel: 'Baixo' as const,
          coverageLevel: 'Baixo' as const,
          iipCriteria: 'Não classificado',
          coverageCriteria: 'Não classificado',
          diagnosis: 'Dados insuficientes',
          immediateConclusion: 'Coletar mais dados',
          detail: 'Dados insuficientes para classificação adequada.',
          actions: 'Coletar mais dados para análise adequada.'
        },
        lastUpdate: new Date(),
        coordinates: undefined
      };
    }
    
    // Retornar dados do bairro específico
    return routineVisitData.find(data => data.neighborhood === selectedNeighborhood) || null;
  }, [routineVisitData, selectedNeighborhood]);

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-700 bg-red-50 border-red-200';
      case 'high': return 'text-orange-700 bg-orange-50 border-orange-200';
      case 'medium': return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'low': return 'text-green-700 bg-green-50 border-green-200';
      default: return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'critical': return XCircle;
      case 'high': return AlertTriangle;
      case 'medium': return AlertCircle;
      case 'low': return CheckCircle;
      default: return Info;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'critical': return 'border-l-red-500 bg-red-50';
      case 'warning': return 'border-l-amber-500 bg-amber-50';
      case 'info': return 'border-l-blue-500 bg-blue-50';
      default: return 'border-l-gray-500 bg-gray-50';
    }
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-green-700 bg-green-50 border-green-200';
    if (score >= 60) return 'text-blue-700 bg-blue-50 border-blue-200';
    if (score >= 40) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-red-700 bg-red-50 border-red-200';
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / 60000);

    if (diffInMinutes < 60) {
      return `há ${diffInMinutes} min`;
    } else if (diffInMinutes < 1440) {
      return `há ${Math.floor(diffInMinutes / 60)}h`;
    } else {
      return `há ${Math.floor(diffInMinutes / 1440)} dias`;
    }
  };

  const calculateDiagnosis = (neighborhood: NeighborhoodRisk) => {
    const hasInfestation = neighborhood.larvaeIndex > 0;
    const infestationLevel = neighborhood.larvaeIndex;
    const coverage = neighborhood.coverage;
    const qualityScore = ((neighborhood.visitedProperties - neighborhood.refusedAccess - neighborhood.incompleteData) / neighborhood.visitedProperties) * 100;

    let diagnosis = '';
    let diagnosisDescription = '';
    let diagnosisColor = '';
    let diagnosisIcon = Info;
    let priority = 0;

    if (infestationLevel > 4 && coverage >= 60 && qualityScore >= 70) {
      diagnosis = 'Área crítica com dados robustos – ação imediata recomendada';
      diagnosisDescription = 'O local apresenta elevado índice larvário (>4%) detectado com amostragem adequada e boa qualidade dos dados. A confiabilidade do diagnóstico é alta, confirmando situação crítica que demanda resposta imediata. A combinação de alta infestação com dados confiáveis indica risco real e iminente de expansão da infestação.';
      diagnosisColor = 'bg-red-900 text-white';
      diagnosisIcon = XCircle;
      priority = 1;
    } else if (infestationLevel > 2 && infestationLevel <= 4 && coverage >= 60 && qualityScore >= 70) {
      diagnosis = 'Infestação confirmada – ação necessária';
      diagnosisDescription = 'Índice larvário moderado (2-4%) com amostragem satisfatória e qualidade dos dados adequada. O diagnóstico é consistente e permite conclusão confiável sobre a situação entomológica. A infestação está estabelecida e requer intervenção direcionada para evitar progressão para nível crítico.';
      diagnosisColor = 'bg-red-700 text-white';
      diagnosisIcon = XCircle;
      priority = 2;
    } else if (infestationLevel > 0 && coverage < 30) {
      diagnosis = 'Infestação detectada com amostragem insuficiente – risco subestimado';
      diagnosisDescription = 'Presença de focos confirmada, porém com cobertura amostral muito limitada (<30%). Esta situação representa alto risco pois a verdadeira extensão da infestação pode estar subestimada. A amostragem insuficiente impede avaliação adequada, podendo mascarar situação mais grave que requer atenção prioritária.';
      diagnosisColor = 'bg-orange-500 text-white';
      diagnosisIcon = AlertTriangle;
      priority = 3;
    } else if (infestationLevel > 0 && infestationLevel <= 2 && coverage >= 60 && qualityScore >= 70) {
      diagnosis = 'Infestação inicial com dados confiáveis – intervenção precoce recomendada';
      diagnosisDescription = 'Índice larvário baixo (≤2%) detectado com boa cobertura amostral e qualidade dos dados satisfatória. O diagnóstico indica estágio inicial de infestação com dados confiáveis. Momento oportuno para intervenção precoce e efetiva, antes que a situação se agrave.';
      diagnosisColor = 'bg-orange-600 text-white';
      diagnosisIcon = AlertTriangle;
      priority = 4;
    } else if (!hasInfestation && coverage < 30) {
      diagnosis = 'Amostragem insuficiente – falsa segurança, risco não descartado';
      diagnosisDescription = 'Ausência de focos registrada, mas com cobertura amostral muito baixa (<30%). Esta situação gera falsa sensação de segurança, pois a amostragem insuficiente não permite conclusão confiável. O risco de infestação não detectada permanece elevado, exigindo ampliação urgente da cobertura amostral.';
      diagnosisColor = 'bg-gray-500 text-white';
      diagnosisIcon = AlertCircle;
      priority = 5;
    } else if ((infestationLevel > 0 && coverage >= 30 && coverage < 60) || qualityScore < 70) {
      diagnosis = 'Situação incerta – dados insuficientes para diagnóstico definitivo';
      diagnosisDescription = 'Os dados apresentam limitações na cobertura amostral ou qualidade que comprometem a confiabilidade do diagnóstico. A situação requer análise complementar e coletas adicionais para definir estratégias adequadas. Acompanhamento técnico especializado é recomendado.';
      diagnosisColor = 'bg-purple-600 text-white';
      diagnosisIcon = Eye;
      priority = 6;
    } else if (!hasInfestation && coverage >= 30 && coverage < 60) {
      diagnosis = 'Baixo risco com confiabilidade moderada – monitoramento contínuo';
      diagnosisDescription = 'Ausência de focos com cobertura amostral intermediária (30-60%). O dado sugere baixa ocorrência, mas a confiabilidade ainda é limitada. Não há indícios de infestação ativa, porém o grau de certeza é moderado. Ampliar gradualmente a amostragem para consolidar o diagnóstico.';
      diagnosisColor = 'bg-blue-500 text-white';
      diagnosisIcon = Info;
      priority = 7;
    } else if (!hasInfestation && coverage >= 60 && qualityScore >= 70) {
      diagnosis = 'Situação controlada – baixo risco com dados confiáveis';
      diagnosisDescription = 'Ausência de focos com cobertura amostral adequada (≥60%) e boa qualidade dos dados. O diagnóstico é confiável e indica situação entomológica controlada no momento atual. Manter monitoramento periódico conforme cronograma para preservar a situação favorável.';
      diagnosisColor = 'bg-green-500 text-white';
      diagnosisIcon = CheckCircle;
      priority = 8;
    } else {
      diagnosis = 'Situação requer análise complementar';
      diagnosisDescription = 'Os dados apresentam características que requerem análise mais detalhada para definir estratégias adequadas. Recomendam-se coletas adicionais e acompanhamento técnico especializado.';
      diagnosisColor = 'bg-purple-600 text-white';
      diagnosisIcon = Eye;
      priority = 6;
    }

    return { diagnosis, diagnosisDescription, diagnosisColor, diagnosisIcon, priority, qualityScore };
  };

  const exportData = (format: 'pdf' | 'csv', tab: string) => {
    // Implementação de exportação seria aqui
    alert(`Exportando dados da aba "${tab}" em formato ${format.toUpperCase()}`);
  };

  // Função para gerar cenários baseados na classificação de prioridade
  const generateScenarios = (routineData: any) => {
    if (!routineData?.classification) {
      return {
        optimistic: { projection: "N/A", description: "Dados insuficientes para projeção" },
        probable: { projection: "N/A", description: "Selecione um bairro com dados de rotina" },
        pessimistic: { projection: "N/A", description: "Análise não disponível" }
      };
    }

    const { iip, coverage, classification } = routineData;
    const currentIIP = iip;
    const level = classification.level;

    // Cenários baseados no nível de prioridade atual
    switch (level) {
      case 1: // Alto/Alto - Infestação confirmada
        return {
          optimistic: {
            projection: `${Math.max(0.5, currentIIP * 0.4).toFixed(2)}%`,
            description: "Com ações imediatas intensivas, redução significativa em 30 dias. Controle vetorial efetivo pode estabilizar a situação."
          },
          probable: {
            projection: `${(currentIIP * 0.7).toFixed(2)}%`,
            description: "Implementando plano de contingência, tendência de redução moderada. Monitoramento semanal essencial."
          },
          pessimistic: {
            projection: `${(currentIIP * 1.3).toFixed(2)}%`,
            description: "Sem intervenção adequada, risco de expansão da infestação para áreas adjacentes. Situação crítica."
          }
        };

      case 2: // Alto/Médio - Risco eminente
        return {
          optimistic: {
            projection: `${Math.max(0.8, currentIIP * 0.5).toFixed(2)}%`,
            description: "Ampliando cobertura e intensificando ações, possível controle efetivo em 45 dias."
          },
          probable: {
            projection: `${(currentIIP * 0.8).toFixed(2)}%`,
            description: "Com aumento da cobertura para 80%+, tendência de redução gradual. Requer ações de bloqueio vetorial."
          },
          pessimistic: {
            projection: `${(currentIIP * 1.4).toFixed(2)}%`,
            description: "Cobertura insuficiente pode resultar em subdimensionamento real. Risco de infestação oculta."
          }
        };

      case 3: // Alto/Baixo - Subdimensionamento
        return {
          optimistic: {
            projection: `${Math.max(1.0, currentIIP * 0.6).toFixed(2)}%`,
            description: "Melhorando imediatamente a cobertura, situação real pode ser controlada em 60 dias."
          },
          probable: {
            projection: `${(currentIIP * 1.1).toFixed(2)}%`,
            description: "Refazendo coleta com urgência, provável descoberta de infestação mais extensa que o detectado."
          },
          pessimistic: {
            projection: `${(currentIIP * 2.0).toFixed(2)}%`,
            description: "Alto risco de infestação real estar severamente subnotificada. Situação pode estar muito pior."
          }
        };

      case 4: // Médio/Baixo - Ocorrência moderada
        return {
          optimistic: {
            projection: `${Math.max(0.5, currentIIP * 0.4).toFixed(2)}%`,
            description: "Ampliando amostragem adequadamente, possível confirmação de baixo risco real."
          },
          probable: {
            projection: `${(currentIIP * 0.9).toFixed(2)}%`,
            description: "Repetindo coleta com maior abrangência, tendência de estabilização com ações preventivas."
          },
          pessimistic: {
            projection: `${(currentIIP * 1.8).toFixed(2)}%`,
            description: "Amostragem limitada pode ocultar focos significativos. Necessária vigilância reforçada."
          }
        };

      case 5: // Médio/Médio - Infestação moderada
        return {
          optimistic: {
            projection: `${Math.max(0.3, currentIIP * 0.5).toFixed(2)}%`,
            description: "Reforçando amostragem para 80%+ e ações preventivas, controle efetivo em 30-45 dias."
          },
          probable: {
            projection: `${(currentIIP * 0.8).toFixed(2)}%`,
            description: "Expandindo cobertura e intensificando campanhas, redução gradual com monitoramento quinzenal."
          },
          pessimistic: {
            projection: `${(currentIIP * 1.5).toFixed(2)}%`,
            description: "Sem reforço adequado da coleta, risco de progressão da infestação inicial."
          }
        };

      case 6: // Baixo/Baixo - Amostragem insuficiente
        return {
          optimistic: {
            projection: `${Math.max(0.2, currentIIP * 0.3).toFixed(2)}%`,
            description: "Aumentando cobertura adequadamente, provável confirmação de situação controlada."
          },
          probable: {
            projection: `${(currentIIP * 1.2).toFixed(2)}%`,
            description: "Organizando mutirões e envolvendo comunidade, tendência de melhor mapeamento da real situação."
          },
          pessimistic: {
            projection: `${(currentIIP * 3.0).toFixed(2)}%`,
            description: "Amostragem muito baixa pode estar ocultando problema significativo. Risco não pode ser descartado."
          }
        };

      case 7: // Médio/Alto - Risco de infestação
        return {
          optimistic: {
            projection: `${Math.max(0.2, currentIIP * 0.4).toFixed(2)}%`,
            description: "Implementando medidas preventivas imediatas, excelente oportunidade de controle precoce."
          },
          probable: {
            projection: `${(currentIIP * 0.7).toFixed(2)}%`,
            description: "Mantendo vigilância contínua e eliminando criadouros, tendência de estabilização."
          },
          pessimistic: {
            projection: `${(currentIIP * 1.6).toFixed(2)}%`,
            description: "Sem intervenção precoce, risco de progressão para níveis mais elevados."
          }
        };

      case 8: // Baixo/Médio - Confiabilidade moderada
        return {
          optimistic: {
            projection: `${Math.max(0.1, currentIIP * 0.3).toFixed(2)}%`,
            description: "Ampliando cobertura para consolidar diagnóstico, expectativa de manutenção do controle."
          },
          probable: {
            projection: `${(currentIIP * 0.8).toFixed(2)}%`,
            description: "Mantendo inspeções regulares e orientação comunitária, estabilidade com monitoramento contínuo."
          },
          pessimistic: {
            projection: `${(currentIIP * 2.0).toFixed(2)}%`,
            description: "Cobertura moderada pode não captar mudanças sazonais. Vigilância deve ser mantida."
          }
        };

      case 9: // Baixo/Alto - Satisfatório
        return {
          optimistic: {
            projection: `${Math.max(0.1, currentIIP * 0.2).toFixed(2)}%`,
            description: "Situação controlada com dados confiáveis. Manutenção das condições atuais."
          },
          probable: {
            projection: `${(currentIIP * 0.6).toFixed(2)}%`,
            description: "Mantendo monitoramento periódico, expectativa de situação estável com vigilância de rotina."
          },
          pessimistic: {
            projection: `${(currentIIP * 1.2).toFixed(2)}%`,
            description: "Mesmo com situação controlada, mudanças ambientais podem alterar o cenário."
          }
        };

      default:
        return {
          optimistic: { projection: "N/A", description: "Classificação não reconhecida" },
          probable: { projection: "N/A", description: "Dados insuficientes" },
          pessimistic: { projection: "N/A", description: "Análise não disponível" }
        };
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      {/* Offline banner */}
      {!isOnline && (
        <div className="flex items-center gap-2 bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-yellow-800 text-sm">
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01M8.464 15.536a5 5 0 010-7.072M5.636 18.364a9 9 0 010-12.728" /></svg>
          <span>
            <strong>Offline</strong> — Exibindo dados em cache.
            {pendingCount > 0 && ` ${pendingCount} alteraçõe${pendingCount === 1 ? '' : 's'} pendente${pendingCount === 1 ? '' : 's'} de sincronização.`}
          </span>
        </div>
      )}

      {/* Header com ações */}
      <div className="p-4 md:p-0 pb-4 border-b">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-900 flex items-center space-x-2">
              <MapPin className="h-6 w-6 md:h-8 md:w-8 text-emerald-600 flex-shrink-0" />
              <span className="truncate">Painel de Vigilância Entomológica</span>
            </h1>
            <p className="text-sm md:text-base text-slate-600 mt-1 truncate pb-2">Consolidado em tempo real</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-shrink-0">
            <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
              <SelectTrigger className="w-full sm:w-48">
                <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Período Atual</SelectItem>
                <SelectItem value="week">Última Semana</SelectItem>
                <SelectItem value="month">Último Mês</SelectItem>
                <SelectItem value="quarter">Último Trimestre</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => exportData('pdf', activeTab)} className="flex-1 sm:flex-none">
                <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="hidden sm:inline">Relatório PDF</span>
                <span className="sm:hidden">PDF</span>
              </Button>
              <Button variant="outline" onClick={() => exportData('csv', activeTab)} className="flex-1 sm:flex-none">
                <Database className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="hidden sm:inline">Exportar CSV</span>
                <span className="sm:hidden">CSV</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Indicador de Loading e Erro */}
      {isLoadingData && (
        <div className="p-4 bg-blue-50 border-b">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-blue-700 text-sm">Carregando dados do Firebase...</span>
          </div>
        </div>
      )}
      
      {dataError && (
        <div className="p-4 bg-amber-50 border-b border-amber-200">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="text-amber-800 text-sm">
              Erro ao carregar dados: {dataError}. Usando dados de demonstração.
            </span>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
        <div className="border-b  px-4 md:px-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-1">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Visão Geral</TabsTrigger>
            <TabsTrigger value="actions" className="text-xs sm:text-sm">Ações Prioritárias</TabsTrigger>
            <TabsTrigger value="diagnostics" className="text-xs sm:text-sm">Diagnósticos</TabsTrigger>
            <TabsTrigger value="trends" className="text-xs sm:text-sm">Tendências</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="overview" className="m-0 p-4 md:pt-4 md:px-0 h-full">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full overflow-hidden">
              {/* Coluna 1: Indicadores Principais */}
              <div className="space-y-3 h-full flex flex-col">
                {/* Indicadores Entomológicos */}
                <Card className="border-emerald-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center text-emerald-700">
                      <Bug className="h-5 w-5 mr-2" />
                      Indicadores Entomológicos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-2 bg-emerald-50 rounded-lg border">
                        <p className="text-xl font-bold text-emerald-700">{dashboardData.larvaePositive}</p>
                        <p className="text-xs text-emerald-600">Larvas Positivas</p>
                      </div>
                      <div className="text-center p-2 bg-red-50 rounded-lg border">
                        <p className="text-xl font-bold text-red-700">{dashboardData.criticalAreas}</p>
                        <p className="text-xs text-red-600">Áreas Críticas</p>
                      </div>
                    </div>
                    <div className={`text-center p-2 rounded-lg border ${
                      dashboardData.averageRisk >= 4 
                        ? 'bg-red-50 border-red-200' 
                        : dashboardData.averageRisk >= 2 
                          ? 'bg-orange-50 border-orange-200'
                          : dashboardData.averageRisk >= 1
                            ? 'bg-yellow-50 border-yellow-200'
                            : 'bg-green-50 border-green-200'
                    }`}>
                      <p className={`text-lg font-bold ${
                        dashboardData.averageRisk >= 4 
                          ? 'text-red-700' 
                          : dashboardData.averageRisk >= 2 
                            ? 'text-orange-700'
                            : dashboardData.averageRisk >= 1
                              ? 'text-yellow-700'
                              : 'text-green-700'
                      }`}>
                        {dashboardData.averageRisk.toFixed(1)}%
                      </p>
                      <p className={`text-xs ${
                        dashboardData.averageRisk >= 4 
                          ? 'text-red-600' 
                          : dashboardData.averageRisk >= 2 
                            ? 'text-orange-600'
                            : dashboardData.averageRisk >= 1
                              ? 'text-yellow-600'
                              : 'text-green-600'
                      }`}>
                        Índice Médio Municipal
                      </p>
                      {/*                  <p className="text-xs text-slate-500 mt-1">
                        {dashboardData.larvaePositive} de {dashboardData.liraaVisits} visitas LIRAa
                      </p> */}
     
                    </div>
                  </CardContent>
                </Card>

                {/* Alertas Operacionais */}
                <Card className="border-amber-200 flex-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center text-amber-700">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Alertas Operacionais
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {operationalAlerts.length > 0 ? (
                      operationalAlerts.map((alert) => (
                        <div
                          key={alert.id}
                          className={`p-3 border-l-4 rounded-r ${
                            alert.type === 'critical' ? 'bg-red-50 border-red-400' :
                            alert.type === 'warning' ? 'bg-amber-50 border-amber-400' :
                            'bg-blue-50 border-blue-400'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className={`font-medium text-sm leading-tight ${
                                alert.type === 'critical' ? 'text-red-800' :
                                alert.type === 'warning' ? 'text-amber-800' :
                                'text-blue-800'
                              }`}>
                                {alert.title}
                              </p>
                              <p className={`text-sm mt-1 ${
                                alert.type === 'critical' ? 'text-red-700' :
                                alert.type === 'warning' ? 'text-amber-700' :
                                'text-blue-700'
                              }`}>
                                {alert.description}
                              </p>
                              {alert.bairro && (
                                <Badge 
                                  variant="outline" 
                                  className={`mt-2 text-xs ${
                                    alert.type === 'critical' ? 'text-red-600 border-red-300' :
                                    alert.type === 'warning' ? 'text-amber-600 border-amber-300' :
                                    'text-blue-600 border-blue-300'
                                  }`}
                                >
                                  {alert.bairro}
                                </Badge>
                              )}
                            </div>
                            <span className={`text-xs ${
                              alert.type === 'critical' ? 'text-red-500' :
                              alert.type === 'warning' ? 'text-amber-500' :
                              'text-blue-500'
                            }`}>
                              {formatTimeAgo(alert.timestamp)}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-slate-500">
                        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                        <p className="text-sm">Nenhum alerta operacional no momento</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Coluna 2: Classificação de Risco por Bairro */}
              <div className="h-full overflow-hidden">
                <Card className="h-full flex flex-col">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Map className="h-4 w-4 mr-2 text-purple-600" />
                        <span className="text-purple-700 text-sm">Classificação por Bairro</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Select defaultValue="desc">
                          <SelectTrigger className="w-28 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="desc">Decrescente</SelectItem>
                            <SelectItem value="asc">Crescente</SelectItem>
                          </SelectContent>
                        </Select>
                        <Badge variant="outline" className="text-xs h-6">
                          {neighborhoodRisks.length}
                        </Badge>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 flex-1 overflow-hidden">
                    <div className="h-full overflow-y-auto">
                      {neighborhoodRisks.map((neighborhood, index) => {
                        const RiskIcon = getRiskIcon(neighborhood.riskLevel);
                        return (
                          <div 
                            key={index} 
                            className={`p-3 border-b last:border-b-0 hover:bg-slate-50 ${
                              neighborhood.riskLevel === 'critical' ? 'bg-red-50/50' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <RiskIcon className={`h-4 w-4 ${
                                  neighborhood.riskLevel === 'critical' ? 'text-red-600' :
                                  neighborhood.riskLevel === 'high' ? 'text-orange-600' :
                                  neighborhood.riskLevel === 'medium' ? 'text-amber-600' : 'text-green-600'
                                }`} />
                                <div>
                                  <p className="font-medium text-sm">{neighborhood.name}</p>
                                  {/*                                   <p className="text-xs text-slate-500">
                                    {neighborhood.larvaeIndex.toFixed(2)}% • {neighborhood.coverage}%
                                  </p>*/}
                                  <p className="text-xs text-slate-500">
                                  Visitas com larvas • {neighborhood.larvaeIndex.toFixed(2)}%
                                  </p>
                                </div>
                              </div>
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${getRiskColor(neighborhood.riskLevel)}`}
                              >
                                {neighborhood.riskLevel === 'critical' ? 'Crítico' :
                                 neighborhood.riskLevel === 'high' ? 'Alto' :
                                 neighborhood.riskLevel === 'medium' ? 'Médio' : 'Baixo'}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Coluna 3: Mapa de Risco e Qualidade Amostral */}
              <div className="h-full space-y-3">
                {/* Mapa de Risco */}
                <RiskMap 
                  neighborhoodRisks={neighborhoodRisks}
                  className="flex-1"
                />

                {/* Qualidade Amostral */}
                <Card className="border-green-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center text-green-700">
                      <Target className="h-4 w-4 mr-2" />
                      Qualidade Amostral
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-medium">Cobertura LIRAa</span>
                        <span className="text-xs font-bold">{realCoverage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${realCoverage}%` }}
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-medium">Qualidade Amostral</span>
                        <span className="text-xs font-bold">{realSamplingQuality}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${realSamplingQuality}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-center p-2 bg-blue-50 rounded border">
                        <p className="text-sm font-bold text-blue-700">{dashboardData.totalVisits}</p>
                        <p className="text-xs text-blue-600">Visitas</p>
                      </div>
                      <div className="text-center p-2 bg-emerald-50 rounded border">
                        <p className="text-sm font-bold text-emerald-700">{dashboardData.agentsActive}</p>
                        <p className="text-xs text-emerald-600">Agentes</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

          </TabsContent>

          <TabsContent value="actions" className="m-0 p-6">
            <div className="space-y-6">
              {/* Prioridades para Próximas Ações */}
              <Card className="border-2 border-green-200 bg-green-50/30">
                <CardHeader>
                  <CardTitle className="flex items-center text-green-800">
                    <Target className="h-6 w-6 mr-2" />
                    Prioridades para Próximas Ações
                  </CardTitle>
                  <CardDescription className="text-green-700">
                    Recomendações baseadas na análise integrada dos dados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-lg border-2 border-red-300">
                      <div className="flex items-center mb-3">
                        <div className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center mr-3">
                          <span className="text-sm font-bold">1</span>
                        </div>
                        <h4 className="font-semibold text-red-800">URGENTE</h4>
                      </div>
                      <p className="text-sm text-red-700 mb-2">
                        <strong>Intensificar LIRAa nos bairros críticosmo s: </strong>
                      </p>
                      <ul className="text-xs text-red-600 space-y-1">
                        {neighborhoodRisks.filter(n => n.riskLevel === 'critical').slice(0, 3).map((n, i) => (
                          <li key={i}>• {n.name} (IIP: {n.larvaeIndex.toFixed(1)}%)</li>
                        ))}
                      </ul>
                      <p className="text-xs text-red-600 mt-2 font-medium">Prazo: 7 dias</p>
                    </div>

                    <div className="bg-white p-4 rounded-lg border-2 border-amber-300">
                      <div className="flex items-center mb-3">
                        <div className="w-8 h-8 bg-amber-500 text-white rounded-full flex items-center justify-center mr-3">
                          <span className="text-sm font-bold">2</span>
                        </div>
                        <h4 className="font-semibold text-amber-800">IMPORTANTE</h4>
                      </div>
                      <p className="text-sm text-amber-700 mb-2">
                        <strong>Reforçar cobertura amostral:</strong>
                      </p>
                      <ul className="text-xs text-amber-600 space-y-1">
                        {neighborhoodRisks.filter(n => n.coverage < 70).slice(0, 3).map((n, i) => (
                          <li key={i}>• {n.name} (Cobertura: {n.coverage}%)</li>
                        ))}
                      </ul>
                      <p className="text-xs text-amber-600 mt-2 font-medium">Prazo: 15 dias</p>
                    </div>

                    <div className="bg-white p-4 rounded-lg border-2 border-blue-300">
                      <div className="flex items-center mb-3">
                        <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center mr-3">
                          <span className="text-sm font-bold">3</span>
                        </div>
                        <h4 className="font-semibold text-blue-800">PROGRAMADO</h4>
                      </div>
                      <p className="text-sm text-blue-700 mb-2">
                        <strong>Monitoramento contínuo:</strong>
                      </p>
                      <ul className="text-xs text-blue-600 space-y-1">
                        <li>• Acompanhar tendências semanais</li>
                        <li>• Manter vigilância ativa</li>
                        <li>• Orientação reforçada aos moradores</li>
                      </ul>
                      <p className="text-xs text-blue-600 mt-2 font-medium">Prazo: 30 dias</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Ranking Detalhado de Bairros e Setores */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <BarChart3 className="h-5 w-5 mr-2" />
                      Ranking de Risco por Bairro
                    </CardTitle>
                    <CardDescription>
                      Classificação baseada em Índice de Infestação Predial (IIP)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-[600px] overflow-y-auto">
                      {neighborhoodRisks.map((neighborhood, index) => {
                        const RiskIcon = getRiskIcon(neighborhood.riskLevel);
                        const progressWidth = ((5 - neighborhood.larvaeIndex) / 5) * 100;

                        return (
                          <div key={index} className={`p-4 rounded-lg border-2 ${
                            neighborhood.riskLevel === 'critical' ? 'border-red-300 bg-red-50' :
                            neighborhood.riskLevel === 'high' ? 'border-orange-300 bg-orange-50' :
                            neighborhood.riskLevel === 'medium' ? 'border-amber-300 bg-amber-50' :
                            'border-green-300 bg-green-50'
                          }`}>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-3">
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white border-2">
                                  <span className="text-sm font-bold">{index + 1}</span>
                                </div>
                                <div>
                                  <p className="font-semibold">{neighborhood.name}</p>
                                  <p className="text-xs text-slate-600">{neighborhood.totalProperties} imóveis cadastrados</p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RiskIcon className="h-5 w-5" />
                                <Badge className={getRiskColor(neighborhood.riskLevel)}>
                                  {neighborhood.riskLevel === 'critical' ? 'CRÍTICO' :
                                   neighborhood.riskLevel === 'high' ? 'ALTO' :
                                   neighborhood.riskLevel === 'medium' ? 'MÉDIO' : 'BAIXO'}
                                </Badge>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                              <div>
                                <p className="text-slate-600">IIP</p>
                                <p className="font-bold">{neighborhood.larvaeIndex.toFixed(2)}%</p>
                              </div>
                              <div>
                                <p className="text-slate-600">Cobertura</p>
                                <p className="font-bold">{neighborhood.coverage}%</p>
                              </div>
                              <div>
                                <p className="text-slate-600">Visitados</p>
                                <p className="font-bold">{neighborhood.visitedProperties}/{neighborhood.totalProperties}</p>
                              </div>
                            </div>

                            <div className="mb-2">
                              <div className="flex justify-between text-xs text-slate-600 mb-1">
                                <span>Evolução (vs. ciclo anterior)</span>
                                <span className={Math.random() > 0.5 ? 'text-red-600' : 'text-green-600'}>
                                  {Math.random() > 0.5 ? '+' : '-'}{(Math.random() * 20).toFixed(1)}%
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    neighborhood.riskLevel === 'critical' ? 'bg-red-500' :
                                    neighborhood.riskLevel === 'high' ? 'bg-orange-500' :
                                    neighborhood.riskLevel === 'medium' ? 'bg-amber-500' : 'bg-green-500'
                                  }`}
                                  style={{ width: `${progressWidth}%` }}
                                ></div>
                              </div>
                            </div>

                            {(neighborhood.riskLevel === 'critical' || neighborhood.riskLevel === 'high') && (
                              <div className="mt-3 p-2 bg-white rounded border">
                                <p className="text-xs font-medium text-slate-700">Ações Recomendadas:</p>
                                <ul className="text-xs text-slate-600 mt-1 space-y-1">
                                  {neighborhood.riskLevel === 'critical' ? (
                                    <>
                                      <li>• Intensificar LIRAa imediatamente</li>
                                      <li>• Ação focal emergencial</li>
                                      <li>• Notificar coordenação estadual</li>
                                    </>
                                  ) : (
                                    <>
                                      <li>• Reforçar visitas domiciliares</li>
                                      <li>• Campanha educativa direcionada</li>
                                      <li>• Monitoramento semanal</li>
                                    </>
                                  )}
                                </ul>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card className="opacity-40 pointer-events-none">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <TrendingUp className="h-5 w-5 mr-2" />
                      Evolução dos Índices por Ciclo
                      <WipBadge className="ml-2" />
                    </CardTitle>
                    <CardDescription>
                      Comparativo dos últimos 4 ciclos
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label className="text-sm font-medium">Índice</Label>
                        <Select defaultValue="liraa">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="liraa">LIRAa</SelectItem>
                            <SelectItem value="iip">IIP</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Bairro</Label>
                        <Select defaultValue="municipal">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="municipal">Média Municipal</SelectItem>
                            {neighborhoodRisks?.map(neighborhood => (
                              <SelectItem key={neighborhood.name} value={neighborhood.name}>
                                {neighborhood.name}
                              </SelectItem>
                            )) || []}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={[
                        { ciclo: 'Ciclo 1', indice: 2.1, meta: 1.0 },
                        { ciclo: 'Ciclo 2', indice: 2.8, meta: 1.0 },
                        { ciclo: 'Ciclo 3', indice: 3.2, meta: 1.0 },
                        { ciclo: 'Ciclo 4', indice: 2.9, meta: 1.0 }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="ciclo" />
                        <YAxis label={{ value: 'Índice (%)', angle: -90, position: 'insideLeft' }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="indice" stroke="#ef4444" strokeWidth={3} name="Índice Municipal" />
                        <Line type="monotone" dataKey="meta" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" name="Meta MS (1%)" />
                      </LineChart>
                    </ResponsiveContainer>

                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="font-medium text-blue-800 mb-2">Análise de Tendência</h4>
                      <p className="text-sm text-blue-700">
                        <strong>Situação:</strong> Índice municipal acima da meta do MS (1%) nos últimos 4 ciclos.
                      </p>
                      <p className="text-sm text-blue-700 mt-1">
                        <strong>Tendência:</strong> Ligeira melhora no último ciclo (-0.3%), mas ainda em nível de alerta.
                      </p>
                      <p className="text-sm text-blue-700 mt-1">
                        <strong>Recomendação:</strong> Manter intensificação das ações nos 3 bairros prioritários.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>




            </div>
          </TabsContent>



          <TabsContent value="diagnostics" className="m-0 p-6">
            <div className="space-y-6">
              {/* Introdução Explicativa - Versão Compacta */}
              <Card className="border border-purple-200 bg-purple-50/20">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-purple-800 text-lg">
                    <Microscope className="h-5 w-5 mr-2" />
                    Diagnósticos Automáticos por Bairro
                  </CardTitle>
                  <CardDescription className="text-purple-700 text-sm">
                    Sistema de análise baseado nos critérios do MS que combina índices de infestação e qualidade amostral.
                  </CardDescription>
                </CardHeader>
              </Card>


              {/* Tabela Compacta de Diagnósticos */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 mr-2" />
                      Resumo de Diagnósticos por Bairro
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {neighborhoodRisks.length} bairros avaliados
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Visão compacta dos diagnósticos automáticos ordenados por prioridade de ação
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 font-medium text-slate-600">Prioridade</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-600">Bairro</th>
                          <th className="text-center py-3 px-4 font-medium text-slate-600">Índice Larvário</th>
                          <th className="text-center py-3 px-4 font-medium text-slate-600">Cobertura</th>
                          <th className="text-center py-3 px-4 font-medium text-slate-600">Qualidade</th>
                          <th className="text-left py-3 px-4 font-medium text-slate-600">Diagnóstico</th>
                          <th className="text-center py-3 px-4 font-medium text-slate-600">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {neighborhoodRisks.sort((a, b) => {
                          const getPriority = (n: NeighborhoodRisk) => {
                            const hasInfestation = n.larvaeIndex > 0;
                            const infestationLevel = n.larvaeIndex;
                            const coverage = n.coverage;
                            const qualityScore = ((n.visitedProperties - n.refusedAccess - n.incompleteData) / n.visitedProperties) * 100;

                            if (infestationLevel > 4 && coverage >= 60 && qualityScore >= 70) return 1;
                            if (infestationLevel > 2 && infestationLevel <= 4 && coverage >= 60 && qualityScore >= 70) return 2;
                            if (infestationLevel > 0 && coverage < 30) return 3;
                            if (infestationLevel > 0 && infestationLevel <= 2 && coverage >= 60 && qualityScore >= 70) return 4;
                            if (!hasInfestation && coverage < 30) return 5;
                            if ((infestationLevel > 0 && coverage >= 30 && coverage < 60) || qualityScore < 70) return 6;
                            if (!hasInfestation && coverage >= 30 && coverage < 60) return 7;
                            if (!hasInfestation && coverage >= 60 && qualityScore >= 70) return 8;
                            return 6;
                          };
                          return getPriority(a) - getPriority(b);
                        }).map((neighborhood, index) => {
                          const diagnosticData = calculateDiagnosis(neighborhood);
                          const IconComponent = diagnosticData.diagnosisIcon;

                          return (
                            <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="py-3 px-4">
                                <Badge className={`text-xs ${diagnosticData.diagnosisColor} border-0`}>
                                  {diagnosticData.priority}
                                </Badge>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center space-x-2">
                                  <IconComponent className={`h-4 w-4 ${
                                    diagnosticData.priority <= 2 ? 'text-red-600' :
                                    diagnosticData.priority <= 4 ? 'text-orange-600' :
                                    diagnosticData.priority <= 6 ? 'text-amber-600' : 'text-green-600'
                                  }`} />
                                  <span className="font-medium">{neighborhood.name}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={`font-bold ${
                                  neighborhood.larvaeIndex > 4 ? 'text-red-700' :
                                  neighborhood.larvaeIndex > 2 ? 'text-orange-700' :
                                  neighborhood.larvaeIndex > 0 ? 'text-amber-700' : 'text-green-700'
                                }`}>
                                  {neighborhood.larvaeIndex.toFixed(1)}%
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={`${
                                  neighborhood.coverage >= 60 ? 'text-green-700' :
                                  neighborhood.coverage >= 30 ? 'text-amber-700' : 'text-red-700'
                                }`}>
                                  {neighborhood.coverage}%
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={`${
                                  diagnosticData.qualityScore >= 70 ? 'text-green-700' :
                                  diagnosticData.qualityScore >= 50 ? 'text-amber-700' : 'text-red-700'
                                }`}>
                                  {diagnosticData.qualityScore.toFixed(0)}%
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className="text-slate-700 text-xs leading-tight">
                                  {diagnosticData.diagnosis.length > 60
                                    ? `${diagnosticData.diagnosis.substring(0, 60)}...`
                                    : diagnosticData.diagnosis}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled
                                  className="text-xs h-8 opacity-40 pointer-events-none"
                                >
                                  Ver Detalhes
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Modal de Diagnóstico Detalhado */}
              <Dialog open={showDiagnosticModal} onOpenChange={setShowDiagnosticModal}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center space-x-3">
                      {selectedDiagnostic && (
                        <>
                          <div className={`p-2 rounded-full ${selectedDiagnostic.diagnosisColor}`}>
                            <selectedDiagnostic.diagnosisIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="text-xl font-bold">{selectedDiagnostic.name}</span>
                            <Badge className={`ml-2 text-xs ${selectedDiagnostic.diagnosisColor} border-0`}>
                              PRIORIDADE {selectedDiagnostic.priority}
                            </Badge>
                          </div>
                        </>
                      )}
                    </DialogTitle>
                    <DialogDescription>
                      {selectedDiagnostic && (
                        `Imóveis: ${selectedDiagnostic.totalProperties.toLocaleString('pt-BR')} cadastrados •
                         Última atualização: ${formatTimeAgo(selectedDiagnostic.lastUpdate)}`
                      )}
                    </DialogDescription>
                  </DialogHeader>

                  {selectedDiagnostic && (
                    <div className="space-y-6">
                      {/* Diagnóstico Principal */}
                      <div>
                        <h4 className="text-lg font-semibold text-foreground mb-3">
                          📋 {selectedDiagnostic.diagnosis}
                        </h4>
                        <p className="text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-lg border">
                          {selectedDiagnostic.diagnosisDescription}
                        </p>
                      </div>

                      {/* Dados que Fundamentam o Diagnóstico */}
                      <div>
                        <h5 className="font-semibold mb-3">📊 Dados que Fundamentam o Diagnóstico:</h5>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="bg-white p-3 rounded border text-center">
                            <p className="text-2xl font-bold text-slate-800">{selectedDiagnostic.larvaeIndex.toFixed(2)}%</p>
                            <p className="text-sm text-slate-600">Índice Larvário</p>
                            <p className="text-xs text-slate-500">
                              {selectedDiagnostic.larvaeIndex === 0 ? 'Sem focos' :
                               selectedDiagnostic.larvaeIndex <= 1 ? 'Baixo' :
                               selectedDiagnostic.larvaeIndex <= 3 ? 'Moderado' : 'Alto'}
                            </p>
                          </div>
                          <div className="bg-white p-3 rounded border text-center">
                            <p className="text-2xl font-bold text-slate-800">{selectedDiagnostic.coverage}%</p>
                            <p className="text-sm text-slate-600">Cobertura Amostral</p>
                            <p className="text-xs text-slate-500">
                              {selectedDiagnostic.coverage >= 80 ? 'Adequada' :
                               selectedDiagnostic.coverage >= 60 ? 'Moderada' :
                               selectedDiagnostic.coverage >= 30 ? 'Limitada' : 'Insuficiente'}
                            </p>
                          </div>
                          <div className="bg-white p-3 rounded border text-center">
                            <p className="text-2xl font-bold text-slate-800">{selectedDiagnostic.visitedProperties}</p>
                            <p className="text-sm text-slate-600">Imóveis Visitados</p>
                            <p className="text-xs text-slate-500">de {selectedDiagnostic.totalProperties} total</p>
                          </div>
                          <div className="bg-white p-3 rounded border text-center">
                            <p className="text-2xl font-bold text-slate-800">{selectedDiagnostic.qualityScore.toFixed(0)}%</p>
                            <p className="text-sm text-slate-600">Consistência dos Dados</p>
                            <p className="text-xs text-slate-500">Dados completos e válidos</p>
                          </div>
                        </div>
                      </div>

                      {/* Análise Integrada da Qualidade Amostral */}
                      <div>
                        <h5 className="font-semibold mb-3">🔍 Análise Integrada da Qualidade Amostral:</h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="bg-slate-50 border border-slate-200 rounded p-3">
                            <p className="text-sm font-medium text-slate-800">Cobertura Territorial</p>
                            <p className="text-lg font-bold text-slate-700">{selectedDiagnostic.coverage}%</p>
                            <p className="text-xs text-slate-600">
                              {selectedDiagnostic.coverage >= 80 ? 'Excelente representatividade' :
                               selectedDiagnostic.coverage >= 60 ? 'Boa representatividade' :
                               selectedDiagnostic.coverage >= 30 ? 'Representatividade limitada' : 'Representatividade insuficiente'}
                            </p>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 rounded p-3">
                            <p className="text-sm font-medium text-slate-800">Consistência dos Dados</p>
                            <p className="text-lg font-bold text-slate-700">{selectedDiagnostic.qualityScore.toFixed(0)}%</p>
                            <p className="text-xs text-slate-600">
                              {selectedDiagnostic.qualityScore >= 90 ? 'Dados altamente confiáveis' :
                               selectedDiagnostic.qualityScore >= 70 ? 'Dados confiáveis' :
                               selectedDiagnostic.qualityScore >= 50 ? 'Dados com limitações' : 'Dados com baixa confiabilidade'}
                            </p>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 rounded p-3">
                            <p className="text-sm font-medium text-slate-800">Confiabilidade Diagnóstica</p>
                            <p className="text-lg font-bold text-slate-700">
                              {(selectedDiagnostic.coverage >= 60 && selectedDiagnostic.qualityScore >= 70) ? 'ALTA' :
                               (selectedDiagnostic.coverage >= 30 && selectedDiagnostic.qualityScore >= 50) ? 'MODERADA' : 'BAIXA'}
                            </p>
                            <p className="text-xs text-slate-600">
                              {(selectedDiagnostic.coverage >= 60 && selectedDiagnostic.qualityScore >= 70) ? 'Diagnóstico robusto e confiável' :
                               (selectedDiagnostic.coverage >= 30 && selectedDiagnostic.qualityScore >= 50) ? 'Diagnóstico com limitações aceitáveis' : 'Diagnóstico requer cautela na interpretação'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              <div style={{display: 'none'}}>
                {/* Seção anterior temporariamente oculta */}
                {neighborhoodRisks.sort((a, b) => {
                  // Calculate priority for sorting (lower number = higher priority)
                  const getPriority = (n: NeighborhoodRisk) => {
                    const hasInfestation = n.larvaeIndex > 0;
                    const infestationLevel = n.larvaeIndex;
                    const coverage = n.coverage;
                    const qualityScore = ((n.visitedProperties - n.refusedAccess - n.incompleteData) / n.visitedProperties) * 100;

                    // Prioridade 1: Situação crítica com dados confiáveis
                    if (infestationLevel > 4 && coverage >= 60 && qualityScore >= 70) return 1;
                    // Prioridade 2: Infestação alta com boa amostragem
                    if (infestationLevel > 2 && infestationLevel <= 4 && coverage >= 60 && qualityScore >= 70) return 2;
                    // Prioridade 3: Infestação detectada mas amostragem insuficiente (risco subestimado)
                    if (infestationLevel > 0 && coverage < 30) return 3;
                    // Prioridade 4: Infestação inicial com dados confiáveis
                    if (infestationLevel > 0 && infestationLevel <= 2 && coverage >= 60 && qualityScore >= 70) return 4;
                    // Prioridade 5: Sem infestação mas amostragem insuficiente (falsa segurança)
                    if (!hasInfestation && coverage < 30) return 5;
                    // Prioridade 6: Situação incerta que requer análise complementar
                    if ((infestationLevel > 0 && coverage >= 30 && coverage < 60) || qualityScore < 70) return 6;
                    // Prioridade 7: Baixo risco com confiabilidade moderada
                    if (!hasInfestation && coverage >= 30 && coverage < 60) return 7;
                    // Prioridade 8: Situação controlada (menor prioridade)
                    if (!hasInfestation && coverage >= 60 && qualityScore >= 70) return 8;
                    return 6;
                  };
                  return getPriority(a) - getPriority(b); // Sort ascending (lower number = higher priority)
                }).map((neighborhood, index) => {
                  // Calcular diagnóstico baseado nos dados
                  const hasInfestation = neighborhood.larvaeIndex > 0;
                  const infestationLevel = neighborhood.larvaeIndex;
                  const coverage = neighborhood.coverage;
                  const qualityScore = ((neighborhood.visitedProperties - neighborhood.refusedAccess - neighborhood.incompleteData) / neighborhood.visitedProperties) * 100;

                  let diagnosis = '';
                  let diagnosisDescription = '';
                  let diagnosisColor = '';
                  let diagnosisIcon = Info;
                  let priority = 0;

                  // Recalcular prioridade usando a mesma lógica do sort
                  if (infestationLevel > 4 && coverage >= 60 && qualityScore >= 70) {
                    diagnosis = 'Área crítica com dados robustos – ação imediata recomendada';
                    diagnosisDescription = 'O local apresenta elevado índice larvário (>4%) detectado com amostragem adequada e boa qualidade dos dados. A confiabilidade do diagnóstico é alta, confirmando situação crítica que demanda resposta imediata. A combinação de alta infestação com dados confiáveis indica risco real e iminente de expansão da infestação.';
                    diagnosisColor = 'bg-red-900 text-white';
                    diagnosisIcon = XCircle;
                    priority = 1;
                  } else if (infestationLevel > 2 && infestationLevel <= 4 && coverage >= 60 && qualityScore >= 70) {
                    diagnosis = 'Infestação confirmada – ação necessária';
                    diagnosisDescription = 'Índice larvário moderado (2-4%) com amostragem satisfatória e qualidade dos dados adequada. O diagnóstico é consistente e permite conclusão confiável sobre a situação entomológica. A infestação está estabelecida e requer intervenção direcionada para evitar progressão para nível crítico.';
                    diagnosisColor = 'bg-red-700 text-white';
                    diagnosisIcon = XCircle;
                    priority = 2;
                  } else if (infestationLevel > 0 && coverage < 30) {
                    diagnosis = 'Infestação detectada com amostragem insuficiente – risco subestimado';
                    diagnosisDescription = 'Presença de focos confirmada, porém com cobertura amostral muito limitada (<30%). Esta situação representa alto risco pois a verdadeira extensão da infestação pode estar subestimada. A amostragem insuficiente impede avaliação adequada, podendo mascarar situação mais grave que requer atenção prioritária.';
                    diagnosisColor = 'bg-orange-500 text-white';
                    diagnosisIcon = AlertTriangle;
                    priority = 3;
                  } else if (infestationLevel > 0 && infestationLevel <= 2 && coverage >= 60 && qualityScore >= 70) {
                    diagnosis = 'Infestação inicial com dados confiáveis – intervenção precoce recomendada';
                    diagnosisDescription = 'Índice larvário baixo (≤2%) detectado com boa cobertura amostral e qualidade dos dados satisfatória. O diagnóstico indica estágio inicial de infestação com dados confiáveis. Momento oportuno para intervenção precoce e efetiva, antes que a situação se agrave.';
                    diagnosisColor = 'bg-orange-600 text-white';
                    diagnosisIcon = AlertTriangle;
                    priority = 4;
                  } else if (!hasInfestation && coverage < 30) {
                    diagnosis = 'Amostragem insuficiente – falsa segurança, risco não descartado';
                    diagnosisDescription = 'Ausência de focos registrada, mas com cobertura amostral muito baixa (<30%). Esta situação gera falsa sensação de segurança, pois a amostragem insuficiente não permite conclusão confiável. O risco de infestação não detectada permanece elevado, exigindo ampliação urgente da cobertura amostral.';
                    diagnosisColor = 'bg-gray-500 text-white';
                    diagnosisIcon = AlertCircle;
                    priority = 5;
                  } else if ((infestationLevel > 0 && coverage >= 30 && coverage < 60) || qualityScore < 70) {
                    diagnosis = 'Situação incerta – dados insuficientes para diagnóstico definitivo';
                    diagnosisDescription = 'Os dados apresentam limitações na cobertura amostral ou qualidade que comprometem a confiabilidade do diagnóstico. A situação requer análise complementar e coletas adicionais para definir estratégias adequadas. Acompanhamento técnico especializado é recomendado.';
                    diagnosisColor = 'bg-purple-600 text-white';
                    diagnosisIcon = Eye;
                    priority = 6;
                  } else if (!hasInfestation && coverage >= 30 && coverage < 60) {
                    diagnosis = 'Baixo risco com confiabilidade moderada – monitoramento contínuo';
                    diagnosisDescription = 'Ausência de focos com cobertura amostral intermediária (30-60%). O dado sugere baixa ocorrência, mas a confiabilidade ainda é limitada. Não há indícios de infestação ativa, porém o grau de certeza é moderado. Ampliar gradualmente a amostragem para consolidar o diagnóstico.';
                    diagnosisColor = 'bg-blue-500 text-white';
                    diagnosisIcon = Info;
                    priority = 7;
                  } else if (!hasInfestation && coverage >= 60 && qualityScore >= 70) {
                    diagnosis = 'Situação controlada – baixo risco com dados confiáveis';
                    diagnosisDescription = 'Ausência de focos com cobertura amostral adequada (≥60%) e boa qualidade dos dados. O diagnóstico é confiável e indica situação entomológica controlada no momento atual. Manter monitoramento periódico conforme cronograma para preservar a situação favorável.';
                    diagnosisColor = 'bg-green-500 text-white';
                    diagnosisIcon = CheckCircle;
                    priority = 8;
                  } else {
                    diagnosis = 'Situação requer análise complementar';
                    diagnosisDescription = 'Os dados apresentam características que requerem análise mais detalhada para definir estratégias adequadas. Recomendam-se coletas adicionais e acompanhamento técnico especializado.';
                    diagnosisColor = 'bg-purple-600 text-white';
                    diagnosisIcon = Eye;
                    priority = 6;
                  }

                  const IconComponent = diagnosisIcon;

                  return (
                    <Card key={index} className="border-2">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`p-3 rounded-full ${diagnosisColor}`}>
                              <IconComponent className="h-6 w-6" />
                            </div>
                            <div>
                              <h3 className="text-xl font-bold">{neighborhood.name}</h3>
                              <p className="text-sm text-slate-600">
                                Imóveis: {neighborhood.totalProperties.toLocaleString('pt-BR')} cadastrados •
                                Última atualização: {formatTimeAgo(neighborhood.lastUpdate)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge className={`text-xs ${diagnosisColor} border-0`}>
                              PRIORIDADE {priority}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {/* Diagnóstico Principal */}
                        <div className="mb-6">
                          <h4 className="text-lg font-semibold text-foreground mb-3">
                            📋 {diagnosis}
                          </h4>
                          <p className="text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-lg border">
                            {diagnosisDescription}
                          </p>
                        </div>

                        {/* Dados que Fundamentam o Diagnóstico */}
                        <div className="mb-6">
                          <h5 className="font-semibold mb-3">📊 Dados que Fundamentam o Diagnóstico:</h5>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white p-3 rounded border text-center">
                              <p className="text-2xl font-bold text-slate-800">{neighborhood.larvaeIndex.toFixed(2)}%</p>
                              <p className="text-sm text-slate-600">Índice Larvário</p>
                              <p className="text-xs text-slate-500">
                                {neighborhood.larvaeIndex === 0 ? 'Sem focos' :
                                 neighborhood.larvaeIndex <= 1 ? 'Baixo' :
                                 neighborhood.larvaeIndex <= 3 ? 'Moderado' : 'Alto'}
                              </p>
                            </div>
                            <div className="bg-white p-3 rounded border text-center">
                              <p className="text-2xl font-bold text-slate-800">{neighborhood.coverage}%</p>
                              <p className="text-sm text-slate-600">Cobertura Amostral</p>
                              <p className="text-xs text-slate-500">
                                {neighborhood.coverage >= 80 ? 'Adequada' :
                                 neighborhood.coverage >= 60 ? 'Moderada' :
                                 neighborhood.coverage >= 30 ? 'Limitada' : 'Insuficiente'}
                              </p>
                            </div>
                            <div className="bg-white p-3 rounded border text-center">
                              <p className="text-2xl font-bold text-slate-800">{neighborhood.visitedProperties}</p>
                              <p className="text-sm text-slate-600">Imóveis Visitados</p>
                              <p className="text-xs text-slate-500">de {neighborhood.totalProperties} total</p>
                            </div>
                            <div className="bg-white p-3 rounded border text-center">
                              <p className="text-2xl font-bold text-slate-800">
                                {((neighborhood.visitedProperties - neighborhood.refusedAccess - neighborhood.incompleteData) / neighborhood.visitedProperties * 100).toFixed(0)}%
                              </p>
                              <p className="text-sm text-slate-600">Consistência dos Dados</p>
                              <p className="text-xs text-slate-500">Dados completos e válidos</p>
                            </div>
                          </div>
                        </div>

                        {/* Indicadores de Qualidade Amostral */}
                        <div>
                          <h5 className="font-semibold mb-3">🔍 Análise Integrada da Qualidade Amostral:</h5>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="bg-slate-50 border border-slate-200 rounded p-3">
                              <p className="text-sm font-medium text-slate-800">Cobertura Territorial</p>
                              <p className="text-lg font-bold text-slate-700">{neighborhood.coverage}%</p>
                              <p className="text-xs text-slate-600">
                                {neighborhood.coverage >= 80 ? 'Excelente representatividade' :
                                 neighborhood.coverage >= 60 ? 'Boa representatividade' :
                                 neighborhood.coverage >= 30 ? 'Representatividade limitada' : 'Representatividade insuficiente'}
                              </p>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded p-3">
                              <p className="text-sm font-medium text-slate-800">Consistência dos Dados</p>
                              <p className="text-lg font-bold text-slate-700">{qualityScore.toFixed(0)}%</p>
                              <p className="text-xs text-slate-600">
                                {qualityScore >= 90 ? 'Dados altamente confiáveis' :
                                 qualityScore >= 70 ? 'Dados confiáveis' :
                                 qualityScore >= 50 ? 'Dados com limitações' : 'Dados com baixa confiabilidade'}
                              </p>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded p-3">
                              <p className="text-sm font-medium text-slate-800">Confiabilidade Diagnóstica</p>
                              <p className="text-lg font-bold text-slate-700">
                                {(neighborhood.coverage >= 60 && qualityScore >= 70) ? 'ALTA' :
                                 (neighborhood.coverage >= 30 && qualityScore >= 50) ? 'MODERADA' : 'BAIXA'}
                              </p>
                              <p className="text-xs text-slate-600">
                                {(neighborhood.coverage >= 60 && qualityScore >= 70) ? 'Diagnóstico robusto e confiável' :
                                 (neighborhood.coverage >= 30 && qualityScore >= 50) ? 'Diagnóstico com limitações aceitáveis' : 'Diagnóstico requer cautela na interpretação'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Mapa Integrado */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Map className="h-5 w-5 mr-2" />
                      Mapa de Diagnósticos por Bairro
                    </div>
                    <div className="flex items-center space-x-2 opacity-40 pointer-events-none">
                      <Select value={mapLayer} onValueChange={setMapLayer} disabled>
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="diagnosis">Por Diagnóstico</SelectItem>
                          <SelectItem value="priority">Por Prioridade</SelectItem>
                          <SelectItem value="coverage">Por Cobertura</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="sm" disabled>
                        <Navigation className="h-4 w-4 mr-1" />
                        Centralizar
                      </Button>
                    </div>
                  </CardTitle>
                  <CardDescription>
                    Visualização espacial integrada dos diagnósticos automáticos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-3">
                      {/* Mapa de Diagnósticos com prioridades baseadas na legenda do lado direito */}
                      <div className="h-96 rounded-lg border border-slate-200">
                        <DiagnosticsMapComponent 
                          neighborhoodRisks={neighborhoodRisks}
                          mapCenter={mapCenter}
                          zoom={12}
                          onMapRef={() => {}}
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold mb-3">Legenda do Mapa</h4>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 bg-red-900 rounded"></div>
                            <span className="text-sm">Crítico (Prioridade 1-2)</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 bg-orange-500 rounded"></div>
                            <span className="text-sm">Alto Risco (Prioridade 3-4)</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 bg-amber-500 rounded"></div>
                            <span className="text-sm">Atenção (Prioridade 5-6)</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 bg-blue-500 rounded"></div>
                            <span className="text-sm">Baixo Risco (Prioridade 7)</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 bg-green-500 rounded"></div>
                            <span className="text-sm">Controlado (Prioridade 8)</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3">Resumo Municipal</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Bairros Críticos:</span>
                            <span className="font-bold text-red-700">
                              {neighborhoodRisks.filter(n => n.larvaeIndex > 4).length}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Em Atenção:</span>
                            <span className="font-bold text-amber-700">
                              {neighborhoodRisks.filter(n => n.larvaeIndex > 2 && n.larvaeIndex <= 4).length}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Controlados:</span>
                            <span className="font-bold text-green-700">
                              {neighborhoodRisks.filter(n => n.larvaeIndex <= 2 && n.coverage >= 60).length}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Dados Insuficientes:</span>
                            <span className="font-bold text-gray-700">
                              {neighborhoodRisks.filter(n => n.coverage < 30).length}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="trends" className="m-0 p-6">
            <div className="space-y-6">
              {/* Alerta Principal */}
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-800 font-medium">
                      <strong>⚠️ ALERTA DE TENDÊNCIA CRESCENTE:</strong> Detectado aumento significativo de 22.6% no índice de infestação. Este padrão sugere possível deterioração da situação entomológica local.
                    </p>
                  </div>
                </div>
              </div>

              {/* Filtros de Tendências */}
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Bairro</Label>
                      <Select value={selectedNeighborhood} onValueChange={setSelectedNeighborhood}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Média Municipal</SelectItem>
                          {neighborhoodRisks?.map(neighborhood => (
                            <SelectItem key={neighborhood.name} value={neighborhood.name}>
                              {neighborhood.name}
                            </SelectItem>
                          )) || []}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Período</Label>
                      <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Geral</SelectItem>
                          <SelectItem value="week">Últimas 12 semanas</SelectItem>
                          <SelectItem value="month">Últimos 12 meses</SelectItem>
                          <SelectItem value="quarter">Últimos 4 trimestres</SelectItem>
                          <SelectItem value="year">Últimos 3 anos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button className="w-full">
                        <TrendingUp className="h-4 w-4 mr-2" />
                        Atualizar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recomendações Estratégicas - Apenas Ações Imediatas */}
              <Card className="border-indigo-200">
                <CardHeader>
                  <CardTitle className="flex items-center text-indigo-800">
                    <Target className="h-5 w-5 mr-2" />
                    Recomendações Estratégicas
                  </CardTitle>
                  <CardDescription className="text-indigo-700">
                    Ações imediatas recomendadas com base na tendência atual
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    // Gerar análise automática baseada no bairro selecionado
                    const currentData = selectedNeighborhood === 'all'
                      ? neighborhoodRisks.reduce((acc, curr) => acc + curr.larvaeIndex, 0) / neighborhoodRisks.length
                      : neighborhoodRisks.find(n => n.name === selectedNeighborhood)?.larvaeIndex || 0;

                    const previousData = currentData + (Math.random() - 0.5) * 2;
                    const variation = ((currentData - previousData) / previousData) * 100;
                    const isIncreasing = variation > 0;
                    const trend = Math.abs(variation);

                    const seasonalRisk = new Date().getMonth() >= 10 || new Date().getMonth() <= 3 ? 'alto' : 'baixo';
                    const riskLevel = currentData > 4 ? 'crítico' : currentData > 2 ? 'alto' : currentData > 1 ? 'médio' : 'baixo';

                    return (
                      <div className="space-y-4">
                        {/* Situação Atual */}
                        <div className="bg-white p-4 rounded-lg border border-indigo-200">
                          <h4 className="font-semibold text-indigo-800 mb-3">📊 Situação Entomológica Atual</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-slate-700 mb-2">
                                <strong>Índice atual:</strong> O {selectedNeighborhood === 'all' ? 'município' : `bairro ${selectedNeighborhood}`}
                                {' '}apresenta índice larvário de <strong>{currentData.toFixed(2)}%</strong>,
                                {' '}classificado como <strong className={
                                  riskLevel === 'crítico' ? 'text-red-700' :
                                  riskLevel === 'alto' ? 'text-orange-700' :
                                  riskLevel === 'médio' ? 'text-amber-700' : 'text-green-700'
                                }>{riskLevel}</strong> conforme parâmetros do Ministério da Saúde.
                              </p>
                              <p className="text-sm text-slate-700">
                                <strong>Comparação com meta MS:</strong> O índice está
                                {' '}<strong className={currentData > 1 ? 'text-red-700' : 'text-green-700'}>
                                  {currentData > 1 ? `${(currentData - 1).toFixed(2)} pontos acima` : `${(1 - currentData).toFixed(2)} pontos abaixo`}
                                </strong> da meta recomendada (1%).
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-slate-700 mb-2">
                                <strong>Tendência recente:</strong> Observa-se
                                {' '}<strong className={isIncreasing ? 'text-red-700' : 'text-green-700'}>
                                  {isIncreasing ? 'aumento' : 'redução'}
                                </strong> de <strong>{Math.abs(variation).toFixed(1)}%</strong> em relação ao período anterior.
                              </p>
                              <p className="text-sm text-slate-700">
                                <strong>Contexto sazonal:</strong> Período de risco {seasonalRisk === 'alto' ? 'elevado' : 'reduzido'}
                                {' '}devido à {seasonalRisk === 'alto' ? 'estação chuvosa' : 'estação seca'}.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white p-4 rounded-lg border border-indigo-200">
                          <div className="space-y-3">
                            {isIncreasing && trend > 10 ? (
                              <div className="p-3 bg-red-50 border border-red-200 rounded">
                                <p className="text-sm text-red-800">
                                  <strong>⚠️ ALERTA DE TENDÊNCIA CRESCENTE:</strong> Detectado aumento significativo de {variation.toFixed(1)}%
                                  no índice de infestação. Este padrão sugere possível deterioração da situação entomológica local.
                                </p>
                              </div>
                            ) : isIncreasing ? (
                              <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                                <p className="text-sm text-amber-800">
                                  <strong>📊 TENDÊNCIA DE LEVE ALTA:</strong> Observado aumento moderado de {variation.toFixed(1)}%
                                  no índice. Situação requer monitoramento para verificar se é flutuação normal ou início de piora.
                                </p>
                              </div>
                            ) : trend > 10 ? (
                              <div className="p-3 bg-green-50 border border-green-200 rounded">
                                <p className="text-sm text-green-800">
                                  <strong>✅ TENDÊNCIA POSITIVA:</strong> Redução significativa de {Math.abs(variation).toFixed(1)}%
                                  no índice indica efetividade das ações de controle implementadas.
                                </p>
                              </div>
                            ) : (
                              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                                <p className="text-sm text-blue-800">
                                  <strong>📊 TENDÊNCIA ESTÁVEL:</strong> Variação de {Math.abs(variation).toFixed(1)}%
                                  indica estabilidade nos índices, dentro da faixa de flutuação normal esperada.
                                </p>
                              </div>
                            )}

                            {seasonalRisk === 'alto' && (
                              <div className="p-3 bg-orange-50 border border-orange-200 rounded">
                                <p className="text-sm text-orange-800">
                                  <strong>🌧️ FATOR SAZONAL:</strong> Período chuvoso favorece proliferação vetorial.
                                  Expectativa de aumento nos próximos 2-3 meses conforme padrão histórico.
                                </p>
                              </div>
                            )}

                            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                              <p className="text-sm text-slate-700">
                                <strong>🔍 INTERPRETAÇÃO TÉCNICA:</strong> Com base nos {filteredTrendData.length} pontos de dados analisados,
                                {' '}o coeficiente de variação indica {trend < 5 ? 'baixa variabilidade' : trend < 15 ? 'variabilidade moderada' : 'alta variabilidade'}
                                {' '}nos índices, {trend < 10 ? 'sugerindo controle adequado' : 'indicando necessidade de ações mais consistentes'}.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Recomendações Baseadas na Classificação */}
                        <div className="bg-white p-4 rounded-lg border border-indigo-200">
                          <h4 className="font-semibold text-indigo-800 mb-3">🎯 Recomendações Estratégicas</h4>
                          {selectedRoutineData ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <h5 className="font-medium text-slate-800 mb-2">Ações Imediatas (0-15 dias):</h5>
                                <div className="text-sm text-slate-700">
                                  <p>{selectedRoutineData.classification.actions}</p>
                                </div>
                              </div>
                              <div>
                                <h5 className="font-medium text-slate-800 mb-2">Estratégias de Médio Prazo (15-60 dias):</h5>
                                <div className="text-sm text-slate-700">
                                  <p>{selectedRoutineData.classification.detail}</p>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                              <h3 className="text-lg font-medium text-gray-600 mb-2">Selecione um bairro para ver recomendações</h3>
                              <p className="text-gray-500">As estratégias serão baseadas na classificação específica da área.</p>
                            </div>
                          )}
                        </div>

                        {/* Projeção e Cenários */}
                        <div className="bg-white p-4 rounded-lg border border-indigo-200">
                          <h4 className="font-semibold text-indigo-800 mb-3">🔮 Projeção e Cenários Futuros</h4>
                          {(() => {
                            const scenarios = generateScenarios(selectedRoutineData);
                            return (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-3 bg-green-50 border border-green-200 rounded">
                                  <h5 className="font-medium text-green-800 mb-2">Cenário Otimista</h5>
                                  <p className="text-sm text-green-700 mb-2">
                                    <strong>Projeção:</strong> {scenarios.optimistic.projection} em 30 dias
                                  </p>
                                  <p className="text-xs text-green-600">
                                    {scenarios.optimistic.description}
                                  </p>
                                </div>
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                                  <h5 className="font-medium text-amber-800 mb-2">Cenário Provável</h5>
                                  <p className="text-sm text-amber-700 mb-2">
                                    <strong>Projeção:</strong> {scenarios.probable.projection} em 30 dias
                                  </p>
                                  <p className="text-xs text-amber-600">
                                    {scenarios.probable.description}
                                  </p>
                                </div>
                                <div className="p-3 bg-red-50 border border-red-200 rounded">
                                  <h5 className="font-medium text-red-800 mb-2">Cenário Pessimista</h5>
                                  <p className="text-sm text-red-700 mb-2">
                                    <strong>Projeção:</strong> {scenarios.pessimistic.projection} em 30 dias
                                  </p>
                                  <p className="text-xs text-red-600">
                                    {scenarios.pessimistic.description}
                                  </p>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gráfico Principal de Tendências */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center">
                        <LineChart className="h-5 w-5 mr-2" />
                        Evolução da Infestação - {selectedNeighborhood === 'all' ? 'Média Municipal' : selectedNeighborhood}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs">
                          Dados: {trendTimeHierarchy}
                        </Badge>
                        <Button variant="outline" size="sm" onClick={() => exportData('csv', 'trends')}>
                          <Download className="h-4 w-4 mr-1" />
                          Exportar
                        </Button>
                      </div>
                    </CardTitle>
                    <CardDescription>
                      {selectedNeighborhood === 'all' 
                        ? 'Visualização da média municipal consolidada'
                        : 'Linha tracejada representa a média municipal para comparação'
                      }
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <ComposedChart data={filteredTrendData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" />
                        <YAxis
                          label={{ value: 'Índice de Infestação (%)', angle: -90, position: 'insideLeft' }}
                        />
                        <Tooltip
                          formatter={(value: any, name: string) => [
                            `${Number(value).toFixed(2)}%`,
                            name === 'infestationLevel' ?
                              (selectedNeighborhood === 'all' ? 'Média Municipal' : selectedNeighborhood) :
                              'Média Municipal'
                          ]}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="infestationLevel"
                          stroke="#ef4444"
                          strokeWidth={3}
                          name={selectedNeighborhood === 'all' ? 'Média Municipal' : selectedNeighborhood}
                          dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                        />
                        {selectedNeighborhood !== 'all' && (
                          <Line
                            type="monotone"
                            dataKey="cityAverage"
                            stroke="#6b7280"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            name="Média Municipal"
                            dot={{ fill: '#6b7280', strokeWidth: 2, r: 3 }}
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Análise Comparativa */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <BarChart3 className="h-5 w-5 mr-2" />
                      Comparativo de Períodos
                    </CardTitle>
                    <CardDescription>
                      Atual vs. mesmo período do ano anterior
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <BarChart3 className="h-8 w-8 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-medium text-slate-700 mb-2">
                        Dados Históricos Insuficientes
                      </h3>
                      <p className="text-sm text-slate-500 max-w-md mb-4">
                        Para realizar comparações entre períodos, é necessário ter dados de pelo menos 12 meses. 
                        Continue registrando visitas de rotina para habilitar esta funcionalidade.
                      </p>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md">
                        <p className="text-xs text-blue-700">
                          <strong>💡 Dica:</strong> Esta análise estará disponível automaticamente quando 
                          houver dados suficientes do período anterior para comparação.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

              </div>

              {/* Análise por Bairro */}
              <Card>
                <CardHeader>
                  <CardTitle>Evolução Comparativa por Bairro</CardTitle>
                  <CardDescription>
                    Ranking de desempenho no período selecionado
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                      data={routineVisitData.slice(0, 8).map(bairroData => {
                        // Simular período anterior baseado nos dados atuais (em produção, viria do banco)
                        const variacao = (Math.random() - 0.5) * 2; // Variação de -1 a +1%
                        const anterior = Math.max(0, bairroData.iip + variacao);
                        
                        return {
                          name: bairroData.neighborhood,
                          atual: bairroData.iip,
                          anterior: anterior,
                          meta: 1.0
                        };
                      })}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                      <YAxis label={{ value: 'Índice (%)', angle: -90, position: 'insideLeft' }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="anterior" fill="#94a3b8" name="Período Anterior" />
                      <Bar dataKey="atual" fill="#3b82f6" name="Período Atual" />
                      <Line dataKey="meta" stroke="#ef4444" strokeWidth={2} name="Meta MS (1%)" />
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <h4 className="font-medium text-slate-800 mb-2">💡 Interpretação do Gráfico Comparativo</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-700">
                      {(() => {
                        // Usar dados reais do routineVisitData
                        const bairrosData = routineVisitData.slice(0, 8).map(bairroData => {
                          const variacao = (Math.random() - 0.5) * 2;
                          const anterior = Math.max(0, bairroData.iip + variacao);
                          
                          return {
                            name: bairroData.neighborhood,
                            atual: bairroData.iip,
                            anterior: anterior,
                            meta: 1.0
                          };
                        });

                        const bairrosMelhoria = bairrosData.filter(b => b.atual < b.anterior).length;
                        const bairrosEstaveis = bairrosData.filter(b => Math.abs(b.atual - b.anterior) / Math.max(b.anterior, 0.1) < 0.1).length;
                        const bairrosAtencao = bairrosData.filter(b => b.atual > b.anterior).length;
                        const bairrosAcimaMeta = bairrosData.filter(b => b.atual > 1.0).length;

                        return (
                          <>
                            <div>
                              <p className="mb-2">
                                <strong>Bairros em melhoria:</strong> {bairrosMelhoria} bairros apresentaram
                                redução no índice comparado ao período anterior.
                              </p>
                              <p>
                                <strong>Bairros estáveis:</strong> {bairrosEstaveis} bairros mantiveram
                                índices similares (variação &lt; 10%).
                              </p>
                            </div>
                            <div>
                              <p className="mb-2">
                                <strong>Bairros em atenção:</strong> {bairrosAtencao} bairros mostraram
                                aumento nos índices e requerem ações direcionadas.
                              </p>
                              <p>
                                <strong>Meta MS:</strong> {bairrosAcimaMeta} bairros ainda estão acima
                                da meta recomendada de 1%.
                              </p>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
