import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  MapPin, 
  Activity, 
  Target,
  Calendar,
  Clock,
  TrendingUp,
  Award,
  AlertCircle,
  CheckCircle,
  BarChart3,
  Filter,
  Loader2
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
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { operationalService, AgentPerformance, TeamSummary, VisitTrend } from '@/services/operationalService';
import { useOnlineSync } from '@/hooks/useOnlineSync';
import logger from '@/lib/logger';

// Interfaces movidas para operationalService.ts

export default function OperationalPanel() {
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [searchAgent, setSearchAgent] = useState('');
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformance[]>([]);
  const [teamSummary, setTeamSummary] = useState<TeamSummary[]>([]);
  const [visitTrends, setVisitTrends] = useState<VisitTrend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { isOnline, pendingCount } = useOnlineSync();

  useEffect(() => {
    const loadOperationalData = async () => {
      if (!user?.organization?.id) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        logger.log('🔄 Carregando dados operacionais...');
        const data = await operationalService.getOperationalData(
          user.organization.id, 
          selectedPeriod as 'week' | 'month' | 'quarter'
        );
        
        setAgentPerformance(data.agents);
        setTeamSummary(data.teams);
        setVisitTrends(data.visitTrends);
        
        logger.log('✅ Dados operacionais carregados:', {
          agents: data.agents.length,
          teams: data.teams.length,
          trends: data.visitTrends.length
        });
      } catch (err) {
        logger.error('❌ Erro ao carregar dados operacionais:', err);
        setError('Erro ao carregar dados operacionais. Tente novamente.');
      } finally {
        setIsLoading(false);
      }
    };

    loadOperationalData();
  }, [user?.organization?.id, selectedPeriod]);

  const filteredAgents = agentPerformance.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchAgent.toLowerCase());
    const matchesTeam = selectedTeam === 'all' || agent.team === selectedTeam;
    return matchesSearch && matchesTeam;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success text-success-foreground';
      case 'inactive': return 'bg-warning text-warning-foreground';
      case 'leave': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'inactive': return 'Inativo';
      case 'leave': return 'Licença';
      default: return status;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'agent': return 'Agente';
      case 'supervisor': return 'Supervisor';
      case 'administrator': return 'Administrador';
      default: return role;
    }
  };

  const getQualityColor = (score: number) => {
    if (score >= 9) return 'text-success';
    if (score >= 7) return 'text-info';
    if (score >= 5) return 'text-warning';
    return 'text-critical';
  };

  const getCompletionColor = (rate: number) => {
    if (rate >= 95) return 'text-success';
    if (rate >= 80) return 'text-info';
    if (rate >= 60) return 'text-warning';
    return 'text-critical';
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
            <Users className="h-8 w-8 text-primary" />
            <span>Painel Operacional</span>
          </h1>
          <p className="text-muted-foreground">
            Monitoramento da performance dos agentes e equipes de campo
          </p>
        </div>
        
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-muted-foreground">Carregando dados operacionais...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
            <Users className="h-8 w-8 text-primary" />
            <span>Painel Operacional</span>
          </h1>
          <p className="text-muted-foreground">
            Monitoramento da performance dos agentes e equipes de campo
          </p>
        </div>
        
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-destructive mb-2">Erro ao carregar dados</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Offline banner */}
      {!isOnline && (
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-yellow-800 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>
            <strong>Offline</strong> — Exibindo dados em cache.
            {pendingCount > 0 && ` ${pendingCount} alteraçõe${pendingCount === 1 ? '' : 's'} pendente${pendingCount === 1 ? '' : 's'} de sincronização.`}
          </span>
        </div>
      )}

      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
          <Users className="h-8 w-8 text-primary" />
          <span>Painel Operacional</span>
        </h1>
        <p className="text-muted-foreground">
          Monitoramento da performance dos agentes e equipes de campo
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Período</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Última semana</SelectItem>
                  <SelectItem value="month">Último mês</SelectItem>
                  <SelectItem value="quarter">Último trimestre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Equipe</label>
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as equipes</SelectItem>
                  <SelectItem value="Equipe Norte">Equipe Norte</SelectItem>
                  <SelectItem value="Equipe Sul">Equipe Sul</SelectItem>
                  <SelectItem value="Equipe Leste">Equipe Leste</SelectItem>
                </SelectContent>
              </Select>
            </div>


            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar Agente</label>
              <Input
                value={searchAgent}
                onChange={(e) => setSearchAgent(e.target.value)}
                placeholder="Nome do agente..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Ações</label>
              <Button className="w-full" variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filtros Avançados
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="agents">Por Agente</TabsTrigger>
          <TabsTrigger value="teams">Por Equipe</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Agentes</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{agentPerformance.length}</div>
                <p className="text-xs text-muted-foreground">
                  {agentPerformance.filter(a => a.status === 'active').length} ativos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Visitas Realizadas</CardTitle>
                <MapPin className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {agentPerformance.reduce((sum, agent) => sum + agent.totalVisits, 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Média: {(agentPerformance.reduce((sum, agent) => sum + agent.avgVisitsPerDay, 0) / agentPerformance.length).toFixed(1)}/dia
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Qualidade Média</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">
                  {(agentPerformance.reduce((sum, agent) => sum + agent.qualityScore, 0) / agentPerformance.length).toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Escala de 0-10
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Conclusão</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-info">
                  {(agentPerformance.reduce((sum, agent) => sum + agent.completionRate, 0) / agentPerformance.length).toFixed(0)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Meta: 90%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Trends */}
            <Card>
              <CardHeader>
                <CardTitle>Tendência de Visitas</CardTitle>
                <CardDescription>Evolução diária das visitas realizadas</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={visitTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date"
                      axisLine={true}
                      tickLine={true}
                      mirror={false}
                      orientation="bottom"
                    />
                    <YAxis 
                      axisLine={true}
                      tickLine={true}
                      mirror={false}
                      orientation="left"
                    />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="visits" stroke="#3b82f6" strokeWidth={2} name="Visitas" />
                    <Line type="monotone" dataKey="agents" stroke="#10b981" strokeWidth={2} name="Agentes Ativos" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Team Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Performance por Equipe</CardTitle>
                <CardDescription>Comparativo de resultados entre equipes</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={teamSummary}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="teamName"
                      axisLine={true}
                      tickLine={true}
                      mirror={false}
                      orientation="bottom"
                    />
                    <YAxis 
                      axisLine={true}
                      tickLine={true}
                      mirror={false}
                      orientation="left"
                    />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="totalVisits" fill="#3b82f6" name="Visitas" />
                    <Bar dataKey="averageQuality" fill="#10b981" name="Qualidade (x10)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          <div className="grid gap-4">
            {filteredAgents.map((agent) => (
              <Card key={agent.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-lg">{agent.name}</h3>
                        <Badge variant="outline">{getRoleLabel(agent.role)}</Badge>
                        <Badge className={getStatusColor(agent.status)}>
                          {getStatusLabel(agent.status)}
                        </Badge>
                        {!agent.isActiveInOrganization && (
                          <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                            Não faz mais parte da organização
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{agent.team}</p>
                      <p className="text-xs text-muted-foreground">
                        Última atividade: {format(agent.lastActivity, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <div className="flex items-center space-x-1 mb-1">
                        <Award className="h-4 w-4 text-warning" />
                        <span className={`font-medium ${getQualityColor(agent.qualityScore)}`}>
                          {agent.qualityScore}/10
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Qualidade</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-muted-foreground">Total de Visitas</p>
                      <p className="font-medium text-lg">{agent.totalVisits}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Visitas/Dia</p>
                      <p className="font-medium">{agent.avgVisitsPerDay}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Rotina</p>
                      <p className="font-medium">{agent.routineVisits}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">LIRAa</p>
                      <p className="font-medium">{agent.liraaVisits}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Taxa Conclusão</p>
                      <p className={`font-medium ${getCompletionColor(agent.completionRate)}`}>
                        {agent.completionRate}%
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Meta Semanal</p>
                      <p className="font-medium">
                        {agent.totalVisits}/{agent.weeklyTarget}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-muted-foreground">Bairros atribuídos:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {agent.assignedNeighborhoods.map((neighborhood, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {neighborhood}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {agent.achievements.length > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground">Conquistas:</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {agent.achievements.map((achievement, index) => (
                            <Badge key={index} className="text-xs bg-success">
                              {achievement}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex justify-end space-x-2">
                    <Button size="sm" variant="outline">
                      <Activity className="h-4 w-4 mr-2" />
                      Detalhes
                    </Button>
                    {agent.status === 'active' && (
                      <Button size="sm">
                        <MapPin className="h-4 w-4 mr-2" />
                        Localizar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="teams" className="space-y-4">
          <div className="grid gap-4">
            {teamSummary.map((team, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="space-y-1">
                      <h3 className="font-medium text-lg">{team.teamName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {team.activeAgents} de {team.totalAgents} agentes ativos
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">{team.totalVisits}</div>
                      <p className="text-xs text-muted-foreground">Visitas realizadas</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Qualidade Média</p>
                      <p className={`font-medium text-lg ${getQualityColor(team.averageQuality)}`}>
                        {team.averageQuality}/10
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Taxa Conclusão</p>
                      <p className={`font-medium ${getCompletionColor(team.completionRate)}`}>
                        {team.completionRate}%
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Atingimento Meta</p>
                      <p className={`font-medium ${getCompletionColor(team.targetAchievement)}`}>
                        {team.targetAchievement}%
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <div className="flex items-center space-x-1">
                        {team.activeAgents === team.totalAgents ? (
                          <CheckCircle className="h-4 w-4 text-success" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-warning" />
                        )}
                        <span className="font-medium">
                          {team.activeAgents === team.totalAgents ? 'Completa' : 'Incompleta'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end space-x-2">
                    <Button size="sm" variant="outline">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Relatório Detalhado
                    </Button>
                    <Button size="sm">
                      <Users className="h-4 w-4 mr-2" />
                      Gerenciar Equipe
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>


        <TabsContent value="performance" className="space-y-6">
          {/* Performance Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Distribuição de Performance</CardTitle>
                <CardDescription>Classificação dos agentes por faixa de qualidade</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Excelente (9-10)', value: agentPerformance.filter(a => a.qualityScore >= 9).length, color: '#10b981' },
                        { name: 'Bom (7-8.9)', value: agentPerformance.filter(a => a.qualityScore >= 7 && a.qualityScore < 9).length, color: '#3b82f6' },
                        { name: 'Regular (5-6.9)', value: agentPerformance.filter(a => a.qualityScore >= 5 && a.qualityScore < 7).length, color: '#f97316' },
                        { name: 'Ruim (<5)', value: agentPerformance.filter(a => a.qualityScore < 5).length, color: '#ef4444' }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {[
                        { name: 'Excelente (9-10)', value: agentPerformance.filter(a => a.qualityScore >= 9).length, color: '#10b981' },
                        { name: 'Bom (7-8.9)', value: agentPerformance.filter(a => a.qualityScore >= 7 && a.qualityScore < 9).length, color: '#3b82f6' },
                        { name: 'Regular (5-6.9)', value: agentPerformance.filter(a => a.qualityScore >= 5 && a.qualityScore < 7).length, color: '#f97316' },
                        { name: 'Ruim (<5)', value: agentPerformance.filter(a => a.qualityScore < 5).length, color: '#ef4444' }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Produtividade vs Qualidade</CardTitle>
                <CardDescription>Relação entre número de visitas e qualidade do trabalho</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={agentPerformance.slice(0, 5)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name"
                      axisLine={true}
                      tickLine={true}
                      mirror={false}
                      orientation="bottom"
                    />
                    <YAxis 
                      axisLine={true}
                      tickLine={true}
                      mirror={false}
                      orientation="left"
                    />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="totalVisits" fill="#3b82f6" name="Total de Visitas" />
                    <Bar dataKey="qualityScore" fill="#10b981" name="Qualidade (x5)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Performance Rankings */}
          <Card>
            <CardHeader>
              <CardTitle>Rankings de Performance</CardTitle>
              <CardDescription>Top performers em diferentes categorias</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="font-medium mb-3 flex items-center space-x-2">
                    <Award className="h-4 w-4 text-warning" />
                    <span>Maior Qualidade</span>
                  </h4>
                  <div className="space-y-2">
                    {agentPerformance
                      .sort((a, b) => b.qualityScore - a.qualityScore)
                      .slice(0, 3)
                      .map((agent, index) => (
                        <div key={agent.id} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium">#{index + 1}</span>
                            <span className="text-sm">{agent.name}</span>
                          </div>
                          <Badge className="bg-success">{agent.qualityScore}/10</Badge>
                        </div>
                      ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3 flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 text-info" />
                    <span>Maior Produtividade</span>
                  </h4>
                  <div className="space-y-2">
                    {agentPerformance
                      .sort((a, b) => b.totalVisits - a.totalVisits)
                      .slice(0, 3)
                      .map((agent, index) => (
                        <div key={agent.id} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium">#{index + 1}</span>
                            <span className="text-sm">{agent.name}</span>
                          </div>
                          <Badge className="bg-info">{agent.totalVisits} visitas</Badge>
                        </div>
                      ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3 flex items-center space-x-2">
                    <Target className="h-4 w-4 text-primary" />
                    <span>Melhor Conclusão</span>
                  </h4>
                  <div className="space-y-2">
                    {agentPerformance
                      .sort((a, b) => b.completionRate - a.completionRate)
                      .slice(0, 3)
                      .map((agent, index) => (
                        <div key={agent.id} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium">#{index + 1}</span>
                            <span className="text-sm">{agent.name}</span>
                          </div>
                          <Badge className="bg-primary">{agent.completionRate}%</Badge>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
