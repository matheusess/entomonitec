'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/components/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Map,
  Upload,
  Building2,
  BarChart3,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  XCircle,
  DoorClosed,
  Search,
  AlertCircle,
  FileSpreadsheet,
  Home,
  Layers,
  Eye,
  Archive,
  FileCheck2,
} from 'lucide-react';
import rgService from '@/services/rgService';
import { parseExcelFile, validateRows, importToFirestore, MAX_FILE_MB } from '@/services/rgImportService';
import type {
  IGeographicRegistry,
  IRGBlock,
  IRGProperty,
  PropertyStatus,
  RGStats,
  RGPreviewRow,
  RGImportResult,
} from '@/types/registro-geografico';

// ─── Helpers ─────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  PropertyStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: { label: 'Pendente', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
  visited: { label: 'Visitado', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  refused: { label: 'Recusado', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
  closed: { label: 'Fechado', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: DoorClosed },
};

const RG_STATUS_CONFIG = {
  draft: { label: 'Rascunho', color: 'bg-slate-100 text-slate-700' },
  active: { label: 'Ativo', color: 'bg-emerald-100 text-emerald-800' },
  archived: { label: 'Arquivado', color: 'bg-amber-100 text-amber-800' },
};

function formatDate(d?: Date): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

// ─── Tab type ─────────────────────────────────────────────────

type TabId = 'registros' | 'quadras' | 'cobertura';

// ─── Main component ───────────────────────────────────────────

export default function RegistroGeografico() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('registros');

  const orgId = user?.organizationId ?? '';

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Map className="h-6 w-6 text-primary" />
            Registro Geográfico
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            Gestão de quadras, imóveis e cobertura de visitas de campo
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1 -mb-px">
          {(
            [
              { id: 'registros', label: 'Registros', icon: FileSpreadsheet },
              { id: 'quadras', label: 'Quadras & Imóveis', icon: Building2 },
              { id: 'cobertura', label: 'Cobertura', icon: BarChart3 },
            ] as { id: TabId; label: string; icon: React.ElementType }[]
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'registros' && <TabRegistros orgId={orgId} />}
      {activeTab === 'quadras' && <TabQuadras orgId={orgId} />}
      {activeTab === 'cobertura' && <TabCobertura orgId={orgId} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB 1: Registros
// ─────────────────────────────────────────────────────────────

function TabRegistros({ orgId }: { orgId: string }) {
  const { user } = useAuth();
  const [registries, setRegistries] = useState<IGeographicRegistry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IGeographicRegistry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await rgService.getRegistries(orgId);
      setRegistries(data);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = async (id: string, status: IGeographicRegistry['status']) => {
    await rgService.updateRegistryStatus(id, status);
    setRegistries((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await rgService.deleteRegistry(deleteTarget.id);
      setRegistries((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">
          {registries.length} registro{registries.length !== 1 ? 's' : ''} cadastrado{registries.length !== 1 ? 's' : ''}
        </p>
        <Button onClick={() => setShowImport(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Importar Excel
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : registries.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileSpreadsheet className="h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-slate-600 font-medium mb-1">Nenhum Registro Geográfico</h3>
            <p className="text-slate-400 text-sm mb-4">
              Importe uma planilha Excel com os imóveis da sua região de trabalho.
            </p>
            <Button variant="outline" onClick={() => setShowImport(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              Importar primeira planilha
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {registries.map((rg) => {
            const cfg = RG_STATUS_CONFIG[rg.status];
            return (
              <Card key={rg.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-900 truncate">{rg.name}</h3>
                        <Badge className={`${cfg.color} text-xs shrink-0`}>{cfg.label}</Badge>
                      </div>
                      {rg.description && (
                        <p className="text-sm text-slate-500 mb-2">{rg.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Home className="h-3.5 w-3.5" />
                          {rg.totalProperties} imóveis
                        </span>
                        <span className="flex items-center gap-1">
                          <Layers className="h-3.5 w-3.5" />
                          {rg.totalBlocks} quadras
                        </span>
                        {rg.fileName && (
                          <span className="flex items-center gap-1">
                            <FileCheck2 className="h-3.5 w-3.5" />
                            {rg.fileName}
                          </span>
                        )}
                        <span>Importado em {formatDate(rg.uploadedAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Select
                        value={rg.status}
                        onValueChange={(v) => handleStatusChange(rg.id, v as IGeographicRegistry['status'])}
                      >
                        <SelectTrigger className="h-8 text-xs w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Rascunho</SelectItem>
                          <SelectItem value="active">Ativo</SelectItem>
                          <SelectItem value="archived">Arquivado</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setDeleteTarget(rg)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Import modal */}
      {showImport && (
        <ImportModal
          orgId={orgId}
          userId={user?.id ?? ''}
          onClose={() => setShowImport(false)}
          onImported={load}
        />
      )}

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Registro Geográfico?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Isso irá excluir permanentemente <strong>{deleteTarget?.name}</strong> e todos os{' '}
            {deleteTarget?.totalProperties} imóveis e {deleteTarget?.totalBlocks} quadras associados.
            Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Import Modal (Fase 3)
// ─────────────────────────────────────────────────────────────

type ImportStep = 'upload' | 'preview' | 'naming' | 'importing' | 'done';

function ImportModal({
  orgId,
  userId,
  onClose,
  onImported,
}: {
  orgId: string;
  userId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<RGPreviewRow[]>([]);
  const [rgName, setRgName] = useState('');
  const [rgDescription, setRgDescription] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<RGImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (f: File) => {
    setError(null);
    if (!f.name.match(/\.(xlsx|xls)$/i)) {
      setError('Formato inválido. Use arquivos .xlsx ou .xls');
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`Arquivo muito grande. Máximo: ${MAX_FILE_MB} MB`);
      return;
    }

    try {
      const { rows } = await parseExcelFile(f);
      const validated = validateRows(rows);
      setPreviewRows(validated);
      setFile(f);
      setRgName(f.name.replace(/\.(xlsx|xls)$/i, ''));
      setStep('preview');
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleImport = async () => {
    if (!file || !rgName.trim()) return;
    setStep('importing');
    setImporting(true);
    setImportProgress(10);

    try {
      // Create registry document first
      const rgId = await rgService.createRegistry(orgId, rgName.trim(), rgDescription.trim(), file.name);
      setImportProgress(30);

      const validRows = previewRows.filter((r) => r.isValid);
      const result = await importToFirestore(orgId, rgId, validRows, userId);
      setImportProgress(100);
      setImportResult(result);
      setStep('done');
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
      setStep('preview');
    } finally {
      setImporting(false);
    }
  };

  const validCount = previewRows.filter((r) => r.isValid).length;
  const errorCount = previewRows.filter((r) => !r.isValid).length;
  const PREVIEW_LIMIT = 10;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            {step === 'done' ? 'Importação Concluída' : 'Importar Planilha Excel'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* STEP: upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Faça upload de uma planilha com as colunas:{' '}
                <strong>Bairro, Logradouro, Número, Cidade, UF</strong> (CEP opcional).
              </p>

              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-slate-300 hover:border-primary/50 hover:bg-slate-50'
                }`}
              >
                <FileSpreadsheet className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">Arraste sua planilha aqui</p>
                <p className="text-slate-400 text-sm mt-1">ou clique para selecionar</p>
                <p className="text-xs text-slate-400 mt-3">.xlsx ou .xls — máx. {MAX_FILE_MB} MB</p>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />

              {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* STEP: preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                  <CheckCircle2 className="h-4 w-4" />
                  {validCount} válidos
                </div>
                {errorCount > 0 && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">
                    <AlertCircle className="h-4 w-4" />
                    {errorCount} com erro (serão ignorados)
                  </div>
                )}
                <span className="text-xs text-slate-400 ml-auto">
                  Mostrando {Math.min(PREVIEW_LIMIT, previewRows.length)} de {previewRows.length} linhas
                </span>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-slate-600 font-medium">#</th>
                      <th className="px-3 py-2 text-left text-slate-600 font-medium">Bairro</th>
                      <th className="px-3 py-2 text-left text-slate-600 font-medium">Logradouro</th>
                      <th className="px-3 py-2 text-left text-slate-600 font-medium">Nº</th>
                      <th className="px-3 py-2 text-left text-slate-600 font-medium">Cidade</th>
                      <th className="px-3 py-2 text-left text-slate-600 font-medium">UF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewRows.slice(0, PREVIEW_LIMIT).map((row) => (
                      <tr
                        key={row.rowIndex}
                        className={row.isValid ? 'bg-white hover:bg-slate-50' : 'bg-red-50'}
                      >
                        <td className="px-3 py-1.5 text-slate-400">{row.rowIndex}</td>
                        <CellOrError row={row} field="bairro" />
                        <CellOrError row={row} field="logradouro" />
                        <CellOrError row={row} field="numero" />
                        <CellOrError row={row} field="cidade" />
                        <CellOrError row={row} field="uf" />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Naming */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div className="space-y-1">
                  <Label htmlFor="rg-name" className="text-sm">Nome do Registro *</Label>
                  <Input
                    id="rg-name"
                    value={rgName}
                    onChange={(e) => setRgName(e.target.value)}
                    placeholder="Ex: LIRAa 2026/1"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="rg-desc" className="text-sm">Descrição</Label>
                  <Input
                    id="rg-desc"
                    value={rgDescription}
                    onChange={(e) => setRgDescription(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* STEP: importing */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
              <p className="text-slate-600 font-medium">Importando {validCount} imóveis...</p>
              <Progress value={importProgress} className="w-64" />
              <p className="text-xs text-slate-400">Calculando quadras e salvando no Firestore...</p>
            </div>
          )}

          {/* STEP: done */}
          {step === 'done' && importResult && (
            <div className="space-y-4">
              <div className="flex flex-col items-center py-6 text-center">
                <CheckCircle2 className="h-14 w-14 text-emerald-500 mb-3" />
                <h3 className="text-lg font-semibold text-slate-900">Importação concluída!</h3>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 rounded-lg p-4 text-center border border-emerald-100">
                  <p className="text-2xl font-bold text-emerald-700">{importResult.importedProperties}</p>
                  <p className="text-xs text-emerald-600 mt-1">Imóveis importados</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center border border-blue-100">
                  <p className="text-2xl font-bold text-blue-700">{importResult.generatedBlocks}</p>
                  <p className="text-xs text-blue-600 mt-1">Quadras geradas</p>
                </div>
                {importResult.skipped > 0 ? (
                  <div className="bg-amber-50 rounded-lg p-4 text-center border border-amber-100">
                    <p className="text-2xl font-bold text-amber-700">{importResult.skipped}</p>
                    <p className="text-xs text-amber-600 mt-1">Linhas ignoradas</p>
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-lg p-4 text-center border border-slate-100">
                    <p className="text-2xl font-bold text-slate-700">0</p>
                    <p className="text-xs text-slate-500 mt-1">Erros</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-4 border-t border-slate-100">
          {step === 'upload' && (
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>Voltar</Button>
              <Button onClick={handleImport} disabled={validCount === 0 || !rgName.trim()}>
                Importar {validCount} imóveis
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={() => { onImported(); onClose(); }}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CellOrError({
  row,
  field,
}: {
  row: RGPreviewRow;
  field: keyof Pick<RGPreviewRow, 'bairro' | 'logradouro' | 'numero' | 'cidade' | 'uf'>;
}) {
  const hasError = row.errors.some((e) => e.field === field);
  return (
    <td
      className={`px-3 py-1.5 ${
        hasError ? 'text-red-600 font-medium' : 'text-slate-700'
      }`}
      title={hasError ? row.errors.find((e) => e.field === field)?.message : undefined}
    >
      {row[field] || <span className="text-red-400 italic">vazio</span>}
    </td>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB 2: Quadras & Imóveis
// ─────────────────────────────────────────────────────────────

function TabQuadras({ orgId }: { orgId: string }) {
  const [registries, setRegistries] = useState<IGeographicRegistry[]>([]);
  const [selectedRgId, setSelectedRgId] = useState<string>('');
  const [blocks, setBlocks] = useState<IRGBlock[]>([]);
  const [propertiesByBlock, setPropertiesByBlock] = useState<Record<string, IRGProperty[]>>({});
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [loadingProps, setLoadingProps] = useState<Set<string>>(new Set());
  const [filterBairro, setFilterBairro] = useState('');
  const [search, setSearch] = useState('');
  const [propertyModal, setPropertyModal] = useState<IRGProperty | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Load registries
  useEffect(() => {
    if (!orgId) return;
    rgService.getRegistries(orgId).then((list) => {
      setRegistries(list);
      const active = list.find((r) => r.status === 'active') ?? list[0];
      if (active) setSelectedRgId(active.id);
    });
  }, [orgId]);

  // Load blocks when RG changes
  useEffect(() => {
    if (!selectedRgId) return;
    setLoadingBlocks(true);
    setBlocks([]);
    setPropertiesByBlock({});
    setExpandedBlocks(new Set());
    rgService.getBlocks(selectedRgId)
      .then(setBlocks)
      .finally(() => setLoadingBlocks(false));
  }, [selectedRgId]);

  const toggleBlock = async (blockId: string) => {
    const next = new Set(expandedBlocks);
    if (next.has(blockId)) {
      next.delete(blockId);
      setExpandedBlocks(next);
      return;
    }

    next.add(blockId);
    setExpandedBlocks(next);

    if (!propertiesByBlock[blockId]) {
      setLoadingProps((prev) => new Set(prev).add(blockId));
      const props = await rgService.getBlockProperties(blockId);
      setPropertiesByBlock((prev) => ({ ...prev, [blockId]: props }));
      setLoadingProps((prev) => {
        const s = new Set(prev);
        s.delete(blockId);
        return s;
      });
    }
  };

  const handleStatusChange = async (property: IRGProperty, newStatus: PropertyStatus) => {
    setUpdatingStatus(property.id);
    try {
      await rgService.updatePropertyStatus(property.id, newStatus);
      setPropertiesByBlock((prev) => ({
        ...prev,
        [property.blockId]: (prev[property.blockId] ?? []).map((p) =>
          p.id === property.id ? { ...p, status: newStatus } : p
        ),
      }));
      // Update block counters in local state
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.id !== property.blockId) return b;
          const wasVisited = property.status === 'visited';
          const isNowVisited = newStatus === 'visited';
          if (wasVisited === isNowVisited) return b;
          return {
            ...b,
            visitedCount: b.visitedCount + (isNowVisited ? 1 : -1),
            pendingCount: b.pendingCount + (isNowVisited ? -1 : 1),
          };
        })
      );
    } finally {
      setUpdatingStatus(null);
    }
  };

  const bairros = [...new Set(blocks.map((b) => b.bairro))].sort();

  const filteredBlocks = blocks.filter((b) => {
    if (filterBairro && b.bairro !== filterBairro) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        b.logradouro.toLowerCase().includes(s) || b.bairro.toLowerCase().includes(s)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3">
        <Select value={selectedRgId} onValueChange={setSelectedRgId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Selecione um RG..." />
          </SelectTrigger>
          <SelectContent>
            {registries.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterBairro || '__all__'} onValueChange={(v) => setFilterBairro(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Filtrar bairro..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os bairros</SelectItem>
            {bairros.map((b) => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar logradouro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Block list */}
      {!selectedRgId ? (
        <div className="text-center py-12 text-slate-400">
          Selecione um Registro Geográfico para visualizar as quadras.
        </div>
      ) : loadingBlocks ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filteredBlocks.length === 0 ? (
        <div className="text-center py-12 text-slate-400">Nenhuma quadra encontrada.</div>
      ) : (
        <div className="space-y-2">
          {filteredBlocks.map((block) => {
            const isExpanded = expandedBlocks.has(block.id);
            const props = propertiesByBlock[block.id] ?? [];
            const isLoadingProps = loadingProps.has(block.id);
            const coveragePercent =
              block.totalProperties > 0
                ? Math.round((block.visitedCount / block.totalProperties) * 100)
                : 0;

            return (
              <Card key={block.id} className="overflow-hidden">
                <button
                  className="w-full text-left"
                  onClick={() => toggleBlock(block.id)}
                >
                  <div className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                      )}
                      <div>
                        <p className="font-medium text-slate-900 text-sm">
                          <span className="text-slate-400 text-xs mr-1">{block.bairro} /</span>
                          {block.logradouro}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Progress value={coveragePercent} className="w-20 h-1.5" />
                        <span className="text-xs text-slate-500 w-16 text-right">
                          {block.visitedCount}/{block.totalProperties} ({coveragePercent}%)
                        </span>
                      </div>
                      {coveragePercent === 100 ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : block.visitedCount > 0 ? (
                        <Clock className="h-4 w-4 text-amber-500" />
                      ) : (
                        <Clock className="h-4 w-4 text-slate-300" />
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100">
                    {isLoadingProps ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50/50 text-xs text-slate-500">
                          <tr>
                            <th className="px-5 py-2 text-left">Endereço</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">Última visita</th>
                            <th className="px-3 py-2"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {props.map((prop) => {
                            const statusCfg = STATUS_CONFIG[prop.status];
                            return (
                              <tr key={prop.id} className="hover:bg-slate-50/50">
                                <td className="px-5 py-2 font-medium text-slate-800">
                                  {prop.logradouro}, nº {prop.numero}
                                  {prop.complemento && (
                                    <span className="text-slate-400 font-normal ml-1">
                                      ({prop.complemento})
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <Select
                                    value={prop.status}
                                    onValueChange={(v) => handleStatusChange(prop, v as PropertyStatus)}
                                    disabled={updatingStatus === prop.id}
                                  >
                                    <SelectTrigger className={`h-7 text-xs w-32 border ${statusCfg.color}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                        <SelectItem key={k} value={k}>
                                          {v.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="px-3 py-2 text-xs text-slate-500">
                                  {prop.lastVisitAt ? formatDate(prop.lastVisitAt) : '—'}
                                </td>
                                <td className="px-3 py-2">
                                  {prop.visitHistory.length > 0 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs text-slate-500 hover:text-slate-700"
                                      onClick={() => setPropertyModal(prop)}
                                    >
                                      <Eye className="h-3.5 w-3.5 mr-1" />
                                      Histórico ({prop.visitHistory.length})
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Property history modal */}
      {propertyModal && (
        <PropertyHistoryModal
          property={propertyModal}
          onClose={() => setPropertyModal(null)}
        />
      )}
    </div>
  );
}

function PropertyHistoryModal({
  property,
  onClose,
}: {
  property: IRGProperty;
  onClose: () => void;
}) {
  const visitTypeLabel: Record<string, string> = {
    routine: 'Rotina',
    liraa: 'LIRAa',
    ovitrampas: 'Ovitrampa',
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">
            Histórico de Visitas
          </DialogTitle>
          <p className="text-sm text-slate-500">
            {property.logradouro}, nº {property.numero} — {property.bairro}
          </p>
        </DialogHeader>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {property.visitHistory.length === 0 ? (
            <p className="text-center text-slate-400 py-6 text-sm">Sem visitas registradas.</p>
          ) : (
            [...property.visitHistory]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((v, i) => {
                const statusCfg = STATUS_CONFIG[v.status as PropertyStatus] ?? STATUS_CONFIG.pending;
                return (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${
                      v.status === 'completed' ? 'bg-emerald-500' :
                      v.status === 'refused' ? 'bg-red-500' : 'bg-slate-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-800">
                          {formatDate(v.date)}
                        </span>
                        <Badge className={`text-xs ${statusCfg.color}`}>{statusCfg.label}</Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {visitTypeLabel[v.visitType] ?? v.visitType} · {v.agentName}
                      </p>
                    </div>
                  </div>
                );
              })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB 3: Cobertura
// ─────────────────────────────────────────────────────────────

function TabCobertura({ orgId }: { orgId: string }) {
  const [registries, setRegistries] = useState<IGeographicRegistry[]>([]);
  const [selectedRgId, setSelectedRgId] = useState<string>('');
  const [stats, setStats] = useState<RGStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterBairro, setFilterBairro] = useState('');

  useEffect(() => {
    if (!orgId) return;
    rgService.getRegistries(orgId).then((list) => {
      setRegistries(list);
      const active = list.find((r) => r.status === 'active') ?? list[0];
      if (active) setSelectedRgId(active.id);
    });
  }, [orgId]);

  useEffect(() => {
    if (!selectedRgId) return;
    setLoading(true);
    rgService.getStats(selectedRgId)
      .then(setStats)
      .finally(() => setLoading(false));
  }, [selectedRgId]);

  const bairros = stats
    ? [...new Set(stats.blockCoverage.map((b) => b.bairro))].sort()
    : [];

  const filteredCoverage = stats?.blockCoverage.filter((b) =>
    filterBairro ? b.bairro === filterBairro : true
  ) ?? [];

  // Group by bairro for summary
  const bairroCoverage = bairros.map((bairro) => {
    const items = stats!.blockCoverage.filter((b) => b.bairro === bairro);
    const total = items.reduce((s, b) => s + b.total, 0);
    const visited = items.reduce((s, b) => s + b.visited, 0);
    return { bairro, total, visited, percent: total > 0 ? Math.round((visited / total) * 100) : 0 };
  });

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex gap-3 flex-wrap">
        <Select value={selectedRgId} onValueChange={setSelectedRgId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Selecione um RG..." />
          </SelectTrigger>
          <SelectContent>
            {registries.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {bairros.length > 1 && (
          <Select value={filterBairro || '__all__'} onValueChange={(v) => setFilterBairro(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filtrar bairro..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os bairros</SelectItem>
              {bairros.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : !stats ? (
        <div className="text-center py-12 text-slate-400">
          Selecione um Registro Geográfico para ver a cobertura.
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Total de imóveis"
              value={stats.totalProperties}
              icon={<Home className="h-5 w-5 text-slate-500" />}
              color="border-l-slate-400"
            />
            <KpiCard
              label="Visitados"
              value={stats.visitedProperties}
              icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
              color="border-l-emerald-500"
            />
            <KpiCard
              label="Pendentes"
              value={stats.pendingProperties}
              icon={<Clock className="h-5 w-5 text-amber-500" />}
              color="border-l-amber-400"
            />
            <KpiCard
              label="Cobertura"
              value={`${stats.coveragePercent}%`}
              icon={<BarChart3 className="h-5 w-5 text-primary" />}
              color="border-l-primary"
              highlight
            />
          </div>

          {/* Overall progress */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cobertura Geral</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Progress value={stats.coveragePercent} className="flex-1 h-3" />
                <span className="text-sm font-semibold text-slate-700 w-12 text-right">
                  {stats.coveragePercent}%
                </span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                  Visitado: {stats.visitedProperties}
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-red-400 inline-block" />
                  Recusado: {stats.refusedProperties}
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-slate-400 inline-block" />
                  Fechado: {stats.closedProperties}
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
                  Pendente: {stats.pendingProperties}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* By bairro */}
          {!filterBairro && bairroCoverage.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Cobertura por Bairro</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {bairroCoverage.map(({ bairro, total, visited, percent }) => (
                  <div key={bairro}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-slate-700">{bairro}</span>
                      <span className="text-slate-500">{visited}/{total} ({percent}%)</span>
                    </div>
                    <Progress value={percent} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* By quadra */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cobertura por Quadra</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {filteredCoverage.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Nenhuma quadra encontrada.</p>
              ) : (
                filteredCoverage
                  .sort((a, b) => a.percent - b.percent)
                  .map((b) => (
                    <div key={b.blockId}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600">
                          <span className="text-slate-400">{b.bairro} / </span>
                          {b.logradouro}
                        </span>
                        <span className="text-slate-500">
                          {b.visited}/{b.total} ({b.percent}%)
                        </span>
                      </div>
                      <Progress value={b.percent} className="h-1.5" />
                    </div>
                  ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  color,
  highlight = false,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  highlight?: boolean;
}) {
  return (
    <Card className={`border-l-4 ${color}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</span>
          {icon}
        </div>
        <p className={`text-2xl font-bold ${highlight ? 'text-primary' : 'text-slate-900'}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
