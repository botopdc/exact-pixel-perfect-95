import React, { useState, useCallback } from 'react';
import { 
  Shield, Play, CheckCircle, AlertTriangle, XCircle, Users, 
  RefreshCw, Loader2, Download, UserCheck, UserX, AlertOctagon 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getLevelName } from '@/lib/rbac';

// ============================================================================
// TYPES
// ============================================================================

interface UserReport {
  email: string;
  legacy_id: number;
  level: number;
  status: string;
  reason?: string;
  roles_to_assign: string[];
  existing_profile_id?: string;
  conflict_details?: string;
}

interface DryRunResult {
  total_analysed: number;
  eligible: number;
  already_exist: number;
  invalid_emails: number;
  duplicates: number;
  legacy_id_conflicts: number;
  created: number;
  errors: { email: string; reason: string }[];
  roles_assigned: { email: string; roles: string[] }[];
  user_reports: UserReport[];
}

interface ReconcileCheckResult {
  email: string;
  legacy_id: number;
  has_auth_user: boolean;
  has_profile: boolean;
  has_internal_role: boolean;
  profile_level: number | null;
  legacy_user_id_in_profile: number | null;
  level_match: boolean;
  legacy_id_match: boolean;
  issues: string[];
}

type Category = 'consistent' | 'incomplete' | 'invalid_email' | 'legacy_conflict' | 'eligible' | 'error';

// ============================================================================
// HELPERS
// ============================================================================

function categorize(report: UserReport): Category {
  if (report.status === 'invalid_email') return 'invalid_email';
  if (report.status === 'duplicate_legacy_id') return 'legacy_conflict';
  if (report.status === 'error' && report.reason?.includes('legacy_user_id')) return 'legacy_conflict';
  if (report.status === 'error') return 'error';
  if (report.status === 'would_create') return 'eligible';
  if (report.status === 'skipped_exists') return 'consistent'; // will refine after reconcile check
  return 'error';
}

const CATEGORY_META: Record<Category, { label: string; color: string; icon: React.ElementType }> = {
  consistent: { label: 'Consistente', color: 'bg-green-500/10 text-green-700 border-green-500/30', icon: CheckCircle },
  incomplete: { label: 'Incompleto', color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30', icon: AlertTriangle },
  invalid_email: { label: 'Email Inválido', color: 'bg-red-500/10 text-red-700 border-red-500/30', icon: XCircle },
  legacy_conflict: { label: 'Conflito Legacy ID', color: 'bg-orange-500/10 text-orange-700 border-orange-500/30', icon: AlertOctagon },
  eligible: { label: 'Elegível', color: 'bg-blue-500/10 text-blue-700 border-blue-500/30', icon: UserCheck },
  error: { label: 'Erro', color: 'bg-red-500/10 text-red-700 border-red-500/30', icon: XCircle },
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function BackfillReconciliationPage() {
  const [pin, setPin] = useState(() => localStorage.getItem('open_admin_pin') || '');
  const [loading, setLoading] = useState(false);
  const [dryResult, setDryResult] = useState<DryRunResult | null>(null);
  const [reconcileResults, setReconcileResults] = useState<ReconcileCheckResult[]>([]);
  const [reconciling, setReconciling] = useState(false);
  const [pilotBatch, setPilotBatch] = useState<UserReport[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{ action: string; email: string; detail: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // The default internal users payload
  const getDefaultPayload = useCallback(() => [
    { id: 1, name: 'Admin OPEN', email: 'admin@opendatacenter.com.br', level: 1000 },
    { id: 7777, name: 'Leandro Vasconcelos', email: 'leandro@opendatacenter.com.br', level: 1000 },
    { id: 2, name: 'Carlos Suporte', email: 'carlos@opendatacenter.com.br', level: 900 },
    { id: 4, name: 'Julia CS', email: 'julia@opendatacenter.com.br', level: 775 },
    { id: 3, name: 'Ana Comercial', email: 'ana@opendatacenter.com.br', level: 700 },
    { id: 6, name: 'Maria RH', email: 'maria@opendatacenter.com.br', level: 600 },
  ], []);

  // ---- DRY RUN ----
  const runDryRun = async () => {
    if (!pin) { toast.error('PIN obrigatório'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('user-backfill', {
        body: { pin, dry_run: true, assign_roles: true, users: getDefaultPayload() },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Falha desconhecida');
      setDryResult(data.result);
      toast.success('Dry run concluído');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---- RECONCILE CHECK ----
  const runReconcileCheck = async () => {
    if (!dryResult) return;
    setReconciling(true);
    try {
      const { data, error } = await supabase.functions.invoke('user-backfill', {
        body: { pin, action: 'reconcile_check', users: getDefaultPayload() },
      });
      if (error) throw new Error(error.message);
      setReconcileResults(data.results || []);
      toast.success('Verificação de reconciliação concluída');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setReconciling(false);
    }
  };

  // ---- RECONCILE ACTION (assign missing role / fix legacy_id) ----
  const executeReconcileAction = async (action: string, email: string) => {
    setActionLoading(true);
    try {
      const user = getDefaultPayload().find(u => u.email === email);
      if (!user) throw new Error('Usuário não encontrado no payload');
      const { data, error } = await supabase.functions.invoke('user-backfill', {
        body: { pin, action: 'reconcile_fix', fix_type: action, user },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Falha');
      toast.success(data.message || `Ação "${action}" concluída para ${email}`);
      setConfirmDialog(null);
      // Refresh reconcile check
      await runReconcileCheck();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ---- BUILD PILOT BATCH ----
  const buildPilotBatch = () => {
    if (!dryResult) return;
    const clean = dryResult.user_reports.filter(r =>
      r.status === 'would_create' || r.status === 'skipped_exists'
    );
    setPilotBatch(clean);
    toast.success(`Lote piloto com ${clean.length} usuários preparado`);
  };

  // ---- EXECUTE REAL BACKFILL (pilot only) ----
  const executeRealBackfill = async () => {
    if (pilotBatch.length === 0) { toast.error('Lote piloto vazio'); return; }
    // Extra validation
    const invalid = pilotBatch.filter(u => !u.email || !u.email.includes('@'));
    if (invalid.length > 0) { toast.error(`${invalid.length} emails inválidos no lote`); return; }

    setActionLoading(true);
    try {
      const payload = pilotBatch.map(u => {
        const full = getDefaultPayload().find(p => p.email === u.email);
        return full || { id: u.legacy_id, name: '', email: u.email, level: u.level };
      });
      const { data, error } = await supabase.functions.invoke('user-backfill', {
        body: { pin, dry_run: false, assign_roles: true, users: payload },
      });
      if (error) throw new Error(error.message);
      toast.success(`Backfill real concluído: ${data.result?.created || 0} criados`);
      setDryResult(data.result);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ---- Categorized user reports ----
  const categorizedReports = dryResult?.user_reports.map(r => ({
    ...r,
    category: categorize(r),
  })) || [];

  const categoryCounts: Record<Category, number> = {
    consistent: 0, incomplete: 0, invalid_email: 0, legacy_conflict: 0, eligible: 0, error: 0,
  };
  categorizedReports.forEach(r => { categoryCounts[r.category]++; });

  // Enrich with reconcile results
  const enrichedReports = categorizedReports.map(r => {
    const rec = reconcileResults.find(rc => rc.email === r.email);
    if (rec && rec.issues.length > 0 && r.category === 'consistent') {
      return { ...r, category: 'incomplete' as Category, reconcile: rec };
    }
    return { ...r, reconcile: rec || null };
  });

  // Recount after enrichment
  const finalCounts: Record<Category, number> = {
    consistent: 0, incomplete: 0, invalid_email: 0, legacy_conflict: 0, eligible: 0, error: 0,
  };
  enrichedReports.forEach(r => { finalCounts[r.category]++; });

  // Pilot readiness
  const pilotReady = dryResult && 
    finalCounts.invalid_email === 0 && 
    finalCounts.legacy_conflict === 0 &&
    finalCounts.error === 0 &&
    finalCounts.incomplete === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Backfill — Reconciliação Fase 1</h1>
          <p className="text-sm text-muted-foreground">Saneamento e validação antes do backfill real</p>
        </div>
      </div>

      {/* PIN + Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-48">
              <label className="text-sm font-medium text-foreground mb-1 block">Admin PIN</label>
              <Input
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="PIN administrativo"
              />
            </div>
            <Button onClick={runDryRun} disabled={loading || !pin} variant="outline">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Executar Dry Run
            </Button>
            {dryResult && (
              <Button onClick={runReconcileCheck} disabled={reconciling} variant="outline">
                {reconciling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Verificar Reconciliação
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {!dryResult && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Aguardando</AlertTitle>
          <AlertDescription>Execute o Dry Run para visualizar o relatório de saneamento.</AlertDescription>
        </Alert>
      )}

      {dryResult && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {([
              { key: 'consistent' as Category, value: finalCounts.consistent },
              { key: 'incomplete' as Category, value: finalCounts.incomplete },
              { key: 'eligible' as Category, value: finalCounts.eligible },
              { key: 'invalid_email' as Category, value: finalCounts.invalid_email },
              { key: 'legacy_conflict' as Category, value: finalCounts.legacy_conflict },
              { key: 'error' as Category, value: finalCounts.error },
            ]).map(({ key, value }) => {
              const meta = CATEGORY_META[key];
              const Icon = meta.icon;
              return (
                <Card key={key}>
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{meta.label}</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{value}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Tabs */}
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">Todos ({dryResult.total_analysed})</TabsTrigger>
              <TabsTrigger value="consistent">Consistentes ({finalCounts.consistent})</TabsTrigger>
              <TabsTrigger value="incomplete">Incompletos ({finalCounts.incomplete})</TabsTrigger>
              <TabsTrigger value="eligible">Elegíveis ({finalCounts.eligible})</TabsTrigger>
              <TabsTrigger value="problems">Problemas ({finalCounts.invalid_email + finalCounts.legacy_conflict + finalCounts.error})</TabsTrigger>
            </TabsList>

            {['all', 'consistent', 'incomplete', 'eligible', 'problems'].map(tab => (
              <TabsContent key={tab} value={tab}>
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Legacy ID</TableHead>
                          <TableHead>Level</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Roles</TableHead>
                          <TableHead>Detalhes</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {enrichedReports
                          .filter(r => {
                            if (tab === 'all') return true;
                            if (tab === 'problems') return ['invalid_email', 'legacy_conflict', 'error'].includes(r.category);
                            return r.category === tab;
                          })
                          .map((r, i) => {
                            const meta = CATEGORY_META[r.category];
                            return (
                              <TableRow key={i}>
                                <TableCell className="font-mono text-xs">{r.email}</TableCell>
                                <TableCell className="font-mono">{r.legacy_id}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{r.level} — {getLevelName(r.level)}</Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge className={meta.color}>{meta.label}</Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                                  {r.reason || r.status}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {r.roles_to_assign.map(role => (
                                      <Badge key={role} variant="secondary" className="text-xs">{role}</Badge>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs">
                                  {r.existing_profile_id && (
                                    <span className="text-muted-foreground">profile: {r.existing_profile_id.slice(0, 8)}…</span>
                                  )}
                                  {r.conflict_details && (
                                    <span className="text-destructive">{r.conflict_details}</span>
                                  )}
                                  {r.reconcile && r.reconcile.issues.length > 0 && (
                                    <ul className="list-disc ml-3 text-yellow-600">
                                      {r.reconcile.issues.map((iss, j) => <li key={j}>{iss}</li>)}
                                    </ul>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {r.reconcile && r.reconcile.issues.length > 0 && (
                                    <div className="flex flex-col gap-1">
                                      {!r.reconcile.has_internal_role && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-xs h-7"
                                          onClick={() => setConfirmDialog({
                                            action: 'assign_base_role',
                                            email: r.email,
                                            detail: 'Atribuir role "internal_user"'
                                          })}
                                        >
                                          <UserCheck className="h-3 w-3 mr-1" /> Atribuir Role
                                        </Button>
                                      )}
                                      {!r.reconcile.legacy_id_match && r.reconcile.has_profile && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-xs h-7"
                                          onClick={() => setConfirmDialog({
                                            action: 'fix_legacy_id',
                                            email: r.email,
                                            detail: `Vincular legacy_user_id=${r.legacy_id} ao profile existente`
                                          })}
                                        >
                                          Fix Legacy ID
                                        </Button>
                                      )}
                                      {!r.reconcile.level_match && r.reconcile.has_profile && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-xs h-7"
                                          onClick={() => setConfirmDialog({
                                            action: 'fix_level',
                                            email: r.email,
                                            detail: `Corrigir level de ${r.reconcile?.profile_level} para ${r.level}`
                                          })}
                                        >
                                          Fix Level
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>

          {/* Pilot batch */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Download className="h-5 w-5" />
                Lote Piloto
              </CardTitle>
              <CardDescription>
                Preparar lote limpo apenas com usuários sem conflitos, com email válido e perfil consistente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Button onClick={buildPilotBatch} variant="outline" disabled={!dryResult}>
                  <Users className="h-4 w-4 mr-2" /> Montar Lote Piloto
                </Button>
                {pilotBatch.length > 0 && (
                  <Badge variant="secondary">{pilotBatch.length} usuários no lote</Badge>
                )}
              </div>

              {!pilotReady && dryResult && (
                <Alert variant="destructive">
                  <AlertOctagon className="h-4 w-4" />
                  <AlertTitle>Backfill bloqueado</AlertTitle>
                  <AlertDescription>
                    Existem inconsistências pendentes. Resolva todos os problemas antes de executar o backfill real.
                    {finalCounts.invalid_email > 0 && <div>• {finalCounts.invalid_email} email(s) inválido(s)</div>}
                    {finalCounts.legacy_conflict > 0 && <div>• {finalCounts.legacy_conflict} conflito(s) de legacy_id</div>}
                    {finalCounts.error > 0 && <div>• {finalCounts.error} erro(s)</div>}
                    {finalCounts.incomplete > 0 && <div>• {finalCounts.incomplete} perfil(is) incompleto(s)</div>}
                  </AlertDescription>
                </Alert>
              )}

              {pilotReady && pilotBatch.length > 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Lote piloto pronto</AlertTitle>
                  <AlertDescription>
                    Todos os critérios atendidos. {pilotBatch.length} usuários prontos para backfill real.
                  </AlertDescription>
                </Alert>
              )}

              {pilotBatch.length > 0 && (
                <>
                  <div className="border rounded-md p-3 bg-muted/30 max-h-40 overflow-y-auto">
                    {pilotBatch.map((u, i) => (
                      <div key={i} className="text-xs font-mono py-0.5">
                        {u.email} (legacy_id={u.legacy_id}, level={u.level}, status={u.status})
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={executeRealBackfill}
                    disabled={!pilotReady || actionLoading}
                    variant="default"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                    Executar Backfill Real (Piloto)
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Confirmation dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Ação de Reconciliação</DialogTitle>
            <DialogDescription>
              <strong>{confirmDialog?.email}</strong>
              <br />
              {confirmDialog?.detail}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>Cancelar</Button>
            <Button
              onClick={() => confirmDialog && executeReconcileAction(confirmDialog.action, confirmDialog.email)}
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
