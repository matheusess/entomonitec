import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  X,
  MapPin,
  Clock,
  User,
  Home,
  Building,
  Bug,
  Droplets,
  CheckCircle,
  AlertCircle,
  Loader2,
  WifiOff,
  Camera,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RoutineVisitForm, LIRAAVisitForm } from '@/types/visits';
import { parseVisitTimestamp } from '@/lib/utils';

interface VisitDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  visit: RoutineVisitForm | LIRAAVisitForm | null;
}

export default function VisitDetailsModal({ isOpen, onClose, visit }: VisitDetailsModalProps) {
  if (!isOpen || !visit) return null;

  const visitDate = parseVisitTimestamp(visit.timestamp);

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

  // Função para renderizar criadouros encontrados
  const renderBreedingSites = (breedingSites: any) => {
    const sites = Object.entries(breedingSites).filter(([key, value]) =>
      key !== 'others' && value === true
    );

    if (sites.length === 0 && !breedingSites.others) {
      return <p className="text-muted-foreground">Nenhum criadouro encontrado</p>;
    }

    return (
      <div className="space-y-2">
        {sites.map(([key, _]) => (
          <div key={key} className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm">{getBreedingSiteLabel(key)}</span>
          </div>
        ))}
        {breedingSites.others && (
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm">{breedingSites.others}</span>
          </div>
        )}
      </div>
    );
  };

  // Função para renderizar recipientes LIRAa
  const renderLIRAAContainers = (containers: any, positiveContainers: any) => {
    const containerTypes = [
      { key: 'a1', label: 'A1 - Reservatórios de água' },
      { key: 'a2', label: 'A2 - Depósitos móveis' },
      { key: 'b', label: 'B - Depósitos fixos' },
      { key: 'c', label: 'C - Passíveis de remoção' },
      { key: 'd1', label: 'D1 - Pneus' },
      { key: 'd2', label: 'D2 - Lixo' },
      { key: 'e', label: 'E - Naturais' }
    ];

    return (
      <div className="space-y-3">
        {containerTypes.map(({ key, label }) => {
          const total = containers[key] || 0;
          const positive = positiveContainers[key] || 0;

          if (total === 0) return null;

          return (
            <div key={key} className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">{label}</span>
              <div className="flex space-x-4 text-sm">
                <span>Total: <strong>{total}</strong></span>
                <span>Positivos: <strong className={positive > 0 ? 'text-red-600' : ''}>{positive}</strong></span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const getBreedingSiteLabel = (key: string) => {
    const labels: { [key: string]: string } = {
      waterReservoir: 'Reservatórios de água',
      tires: 'Pneus',
      bottles: 'Garrafas/Recipientes',
      cans: 'Latas/Embalagens',
      buckets: 'Baldes/Bacias',
      plantPots: 'Vasos de plantas',
      gutters: 'Calhas/Lajes',
      pools: 'Piscinas/Fontes',
      wells: 'Poços/Cisternas',
      tanks: 'Caixas d\'água',
      drains: 'Ralos/Bueiros'
    };
    return labels[key] || key;
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center space-x-2">
              <MapPin className="h-5 w-5" />
              <span>Detalhes da Visita</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Badge variant={visit.type === 'routine' ? 'default' : 'secondary'}>
                {visit.type === 'routine' ? 'Rotina' : 'LIRAa'}
              </Badge>
              {getSyncStatusBadge(visit.syncStatus, visit.syncError)}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Informações Básicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <MapPin className="h-4 w-4" />
                  <span>Localização</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Bairro</p>
                  <p className="font-medium">{visit.neighborhood}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Endereço</p>
                  <p className="text-sm">{visit.location?.address || 'Não disponível'}</p>
                </div>
                {visit.location && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Coordenadas GPS</p>
                    <p className="text-sm font-mono">
                      {visit.location.latitude.toFixed(6)}, {visit.location.longitude.toFixed(6)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Precisão: {visit.location.accuracy.toFixed(0)}m
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <Clock className="h-4 w-4" />
                  <span>Informações da Visita</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Data e Horário</p>
                  <p className="font-medium">
                    {format(visitDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Agente</p>
                  <p className="font-medium">{visit.agentName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge variant={visit.status === 'completed' ? 'default' : 'secondary'}>
                    {visit.status === 'completed' ? 'Concluída' :
                      visit.status === 'refused' ? 'Recusada' : 'Fechada'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detalhes Específicos por Tipo */}
          {visit.type === 'routine' ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <Bug className="h-4 w-4" />
                  <span>Detalhes da Visita de Rotina</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium mb-3">Criadouros Encontrados</h4>
                  {renderBreedingSites(visit.breedingSites)}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-3">Presença de Larvas</h4>
                    <div className="flex items-center space-x-2">
                      {visit.larvaeFound ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-red-500" />
                          <span className="text-red-600 font-medium">Sim</span>
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4 text-green-500" />
                          <span className="text-green-600 font-medium">Não</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Presença de Pupas</h4>
                    <div className="flex items-center space-x-2">
                      {visit.pupaeFound ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-red-500" />
                          <span className="text-red-600 font-medium">Sim</span>
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4 text-green-500" />
                          <span className="text-green-600 font-medium">Não</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {visit.controlMeasures && visit.controlMeasures.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3">Medidas de Controle Aplicadas</h4>
                    <div className="space-y-2">
                      {visit.controlMeasures.map((measure, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-blue-500" />
                          <span className="text-sm">{measure}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {visit.calculatedRiskLevel && (
                  <div>
                    <h4 className="font-medium mb-3">Nível de Risco Calculado</h4>
                    <Badge
                      variant="outline"
                      className={
                        visit.calculatedRiskLevel === 'low' ? 'bg-green-100 text-green-800' :
                          visit.calculatedRiskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            visit.calculatedRiskLevel === 'high' ? 'bg-orange-100 text-orange-800' :
                              'bg-red-100 text-red-800'
                      }
                    >
                      {visit.calculatedRiskLevel === 'low' ? 'Baixo' :
                        visit.calculatedRiskLevel === 'medium' ? 'Médio' :
                          visit.calculatedRiskLevel === 'high' ? 'Alto' : 'Crítico'}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <Building className="h-4 w-4" />
                  <span>Detalhes do LIRAa</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-3">Tipo de Imóvel</h4>
                    <Badge variant="outline">
                      {visit.propertyType === 'residential' ? 'Residencial' :
                        visit.propertyType === 'commercial' ? 'Comercial' :
                          visit.propertyType === 'institutional' ? 'Institucional' : 'Terreno Baldio'}
                    </Badge>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Status da Inspeção</h4>
                    <div className="space-y-2">
                      {visit.inspected && (
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm">Inspecionado</span>
                        </div>
                      )}
                      {visit.refused && (
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-red-500" />
                          <span className="text-sm">Recusado</span>
                        </div>
                      )}
                      {visit.closed && (
                        <div className="flex items-center space-x-2">
                          <X className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Fechado</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Inspeção de Recipientes</h4>
                  {renderLIRAAContainers(visit.containers, visit.positiveContainers)}
                </div>

                {visit.larvaeSpecies && visit.larvaeSpecies.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3">Espécies Identificadas</h4>
                    <div className="flex flex-wrap gap-2">
                      {visit.larvaeSpecies.map((species, index) => (
                        <Badge key={index} variant="outline">
                          {species}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-3">Tratamento Aplicado</h4>
                    <div className="flex items-center space-x-2">
                      {visit.treatmentApplied ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-green-600 font-medium">Sim</span>
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-600 font-medium">Não</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Ação de Eliminação</h4>
                    <div className="flex items-center space-x-2">
                      {visit.eliminationAction ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-green-600 font-medium">Sim</span>
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4 text-gray-500" />
                          <span className="text-gray-600 font-medium">Não</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {visit.liraaIndex !== undefined && (
                  <div>
                    <h4 className="font-medium mb-3">Índice LIRAa</h4>
                    <Badge
                      variant="outline"
                      className={
                        visit.liraaIndex < 1 ? 'bg-green-100 text-green-800' :
                          visit.liraaIndex < 3.9 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                      }
                    >
                      {visit.liraaIndex.toFixed(2)}%
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Observações */}
          {visit.observations && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <Eye className="h-4 w-4" />
                  <span>Observações</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{visit.observations}</p>
              </CardContent>
            </Card>
          )}

          {/* Fotos */}
          {visit.photos && visit.photos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-lg">
                  <Camera className="h-4 w-4" />
                  <span>Evidências Fotográficas ({visit.photos.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {visit.photos.map((photo, index) => (
                    <a
                      key={index}
                      href={photo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square relative group cursor-pointer block"
                    >
                      <img
                        src={photo}
                        alt={`Evidência ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-lg">
                        <Eye className="h-6 w-6 text-white" />
                      </div>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Erro de Sincronização */}
          {visit.syncError && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-lg text-red-800">
                  <AlertCircle className="h-4 w-4" />
                  <span>Erro de Sincronização</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-red-700">{visit.syncError}</p>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

