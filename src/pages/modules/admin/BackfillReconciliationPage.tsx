import React, { useState, useCallback } from 'react';
import { 
  Shield, Play, CheckCircle, AlertTriangle, XCircle, Users, 
  RefreshCw, Loader2, Download, UserCheck, AlertOctagon, Mail, Upload, Send
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { getLevelName } from '@/lib/rbac';
import {
  type LegacyUserPayload,
  type BackfillResult,
  type ReconcileCheckResult,
  type UserReport,
  fetchLegacyUsers,
  runDryRun,
  runReconcileCheck,
  runReconcileFix,
  runRealBackfill,
  sendInvite,
} from '@/services/backfillService';

// ============================================================================
// TYPES
// ============================================================================

type Category = 'consistent' | 'incomplete' | 'invalid_email' | 'legacy_conflict' | 'eligible' | 'error';

function categorize(report: UserReport): Category {
  if (report.status === 'invalid_email') return 'invalid_email';
  if (report.status === 'duplicate_legacy_id' || report.status === 'duplicate_email') return 'legacy_conflict';
  if (report.status === 'error' && report.reason?.includes('legacy_user_id')) return 'legacy_conflict';
  if (report.status === 'error') return 'error';
  if (report.status === 'would_create') return 'eligible';
  if (report.status === 'skipped_exists') return 'consistent';
  return 'error';
}

const CATEGORY_META: Record<Category, { label: string; color: string; icon: React.ElementType }> = {
  consistent: { label: 'Consistente', color: 'bg-green-500/10 text-green-700 border-green-500/30', icon: CheckCircle },
  incomplete: { label: 'Incompleto', color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30', icon: AlertTriangle },
  invalid_email: { label: 'Email Inválido', color: 'bg-red-500/10 text-red-700 border-red-500/30', icon: XCircle },
  legacy_conflict: { label: 'Conflito', color: 'bg-orange-500/10 text-orange-700 border-orange-500/30', icon: AlertOctagon },
  eligible: { label: 'Elegível', color: 'bg-blue-500/10 text-blue-700 border-blue-500/30', icon: UserCheck },
  error: { label: 'Erro', color: 'bg-red-500/10 text-red-700 border-red-500/30', icon: XCircle },
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function BackfillReconciliationPage() {
  const [pin, setPin] = useState(() => localStorage.getItem('open_admin_pin') || '');
  const [loading, setLoading] = useState(false);
  const [fetchingLegacy, setFetchingLegacy] = useState(false);
  const [legacyUsers, setLegacyUsers] = useState<LegacyUserPayload[]>([]);
  const [dryResult, setDryResult] = useState<BackfillResult | null>(null);
  const [reconcileResults, setReconcileResults] = useState<ReconcileCheckResult[]>([]);
  const [reconciling, setReconciling] = useState(false);
  const [pilotBatch, setPilotBatch] = useState<UserReport[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{ action: string; email: string; detail: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [sendInvites, setSendInvites] = useState(false);
  const [invitingEmail, setInvitingEmail] = useState<string | null>(null);

  // Default pilot payload (fallback)
  const getDefaultPayload = useCallback((): LegacyUserPayload[] => [
    { id: 1, name: 'Admin OPEN', email: 'admin@opendatacenter.com.br', level: 1000 },
    { id: 7777, name: 'Leandro Vasconcelos', email: 'leandro@opendatacenter.com.br', level: 1000 },
    { id: 2, name: 'Carlos Suporte', email: 'carlos@opendatacenter.com.br', level: 900 },
    { id: 4, name: 'Julia CS', email: 'julia@opendatacenter.com.br', level: 775 },
    { id: 3, name: 'Ana Comercial', email: 'ana@opendatacenter.com.br', level: 700 },
    { id: 6, name: 'Maria RH', email: 'maria@opendatacenter.com.br', level: 600 },
  ], []);

  const activePayload = legacyUsers.length > 0 ? legacyUsers : getDefaultPayload();

  // ---- FETCH FROM LEGACY API ----
  const handleFetchLegacy = async () => {
    setFetchingLegacy(true);
    try {
      const users = await fetchLegacyUsers({ levelMin: 600 });
      setLegacyUsers(users);
      setDryResult(null);
      setReconcileResults([]);
      setPilotBatch([]);
      toast.success(`${users.length} usuários importados da API legada`);
    } catch (err: any) {
      toast.error(`Falha ao importar: ${err.message}`);
    } finally {
      setFetchingLegacy(false);
    }
  };

  // ---- DRY RUN ----
  const handleDryRun = async () => {
    if (!pin) { toast.error('PIN obrigatório'); return; }
    setLoading(true);
    try {
      const result = await runDryRun({ pin, users: activePayload });
      setDryResult(result);
      toast.success('Dry run concluído');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---- RECONCILE CHECK ----
  const handleReconcileCheck = async () => {
    if (!dryResult) return;
    setReconciling(true);
    try {
      const results = await runReconcileCheck({ pin, users: activePayload });
      setReconcileResults(results);
      toast.success('Verificação de reconciliação concluída');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setReconciling(false);
    }
  };

  // ---- RECONCILE ACTION ----
  const executeReconcileAction = async (action: string, email: string) => {
    setActionLoading(true);
    try {
      const user = activePayload.find(u => u.email === email);
      if (!user) throw new Error('Usuário não encontrado no payload');
      const result = await runReconcileFix({ pin, fixType: action, user });
      if (!result?.success) throw new Error(result?.error || 'Falha');
      toast.success(result.message || `Ação "${action}" concluída para ${email}`);
      setConfirmDialog(null);
      await handleReconcileCheck();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ---- SEND INDIVIDUAL INVITE ----
  const handleSendInvite = async (email: string) => {
    setInvitingEmail(email);
    try {
      const result = await sendInvite({ pin, email });
      if (!result?.success) throw new Error(result?.error || 'Falha');
      toast.success(result.message || `Convite enviado para ${email}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setInvitingEmail(null);
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

  // ---- EXECUTE REAL BACKFILL ----
  const executeRealBackfill = async () => {
    if (pilotBatch.length === 0) { toast.error('Lote piloto vazio'); return; }
    const invalid = pilotBatch.filter(u => !u.email || !u.email.includes('@'));
    if (invalid.length > 0) { toast.error(`${invalid.length} emails inválidos no lote`); return; }

    setActionLoading(true);
    try {
      const payload = pilotBatch.map(u => {
        const full = activePayload.find(p => p.email === u.email);
        return full || { id: u.legacy_id, name: '', email: u.email, level: u.level };
      });
      const result = await runRealBackfill({ pin, users: payload, sendInvites });
      toast.success(`Backfill concluído: ${result.created} criados, ${result.invited || 0} convidados`);
      setDryResult(result);
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

  // Enrich with reconcile results
  const enrichedReports = categorizedReports.map(r => {
    const rec = reconcileResults.find(rc => rc.email === r.email);
    if (rec && rec.issues.length > 0 && r.category === 'consistent') {
      return { ...r, category: 'incomplete' as Category, reconcile: rec };
    }
    return { ...r, reconcile: rec || null };
  });

  const finalCounts: Record<Category, number> = {
    consistent: 0, incomplete: 0, invalid_email: 0, legacy_conflict: 0, eligible: 0, error: 0,
  };
  enrichedReports.forEach(r => { finalCounts[r.category]++; });

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
          <h1 className="text-2xl font-bold text-foreground">Importação de Usuários — Fase 6</h1>
          <p className="text-sm text-muted-foreground">Importação do legado, reconciliação, backfill e onboarding</p>
        </div>
      </div>

      {/* Source + PIN */}
      <Card>
        <CardContent className="pt-6 space-y-4">
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
            <Button onClick={handleFetchLegacy} disabled={fetchingLegacy} variant="outline">
              {fetchingLegacy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Importar da API Legada
            </Button>
            <Button onClick={handleDryRun} disabled={loading || !pin} variant="outline">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Executar Dry Run
            </Button>
            {dryResult && (
              <Button onClick={handleReconcileCheck} disabled={reconciling} variant="outline">
                {reconciling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Verificar Reconciliação
              </Button>
            )}
          </div>

          {/* Source indicator */}
          <div className="flex items-center gap-2">
            <Badge variant={legacyUsers.length > 0 ? 'default' : 'secondary'}>
              {legacyUsers.length > 0
                ? `${legacyUsers.length} usuários da API legada`
                : `${getDefaultPayload().length} usuários (piloto padrão)`}
            </Badge>
            {legacyUsers.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-6"
                onClick={() => { setLegacyUsers([]); setDryResult(null); setReconcileResults([]); setPilotBatch([]); }}
              >
                Resetar para piloto padrão
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {!dryResult && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Aguardando</AlertTitle>
          <AlertDescription>
            Importe os usuários da API legada ou use o payload piloto padrão, depois execute o Dry Run.
          </AlertDescription>
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
                                      {r.reconcile.issues.map((iss: string, j: number) => <li key={j}>{iss}</li>)}
                                    </ul>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col gap-1">
                                    {r.reconcile && r.reconcile.issues.length > 0 && (
                                      <>
                                        {!r.reconcile.has_internal_role && (
                                          <Button
                                            size="sm" variant="outline" className="text-xs h-7"
                                            onClick={() => setConfirmDialog({ action: 'assign_base_role', email: r.email, detail: 'Atribuir roles com base no level' })}
                                          >
                                            <UserCheck className="h-3 w-3 mr-1" /> Atribuir Roles
                                          </Button>
                                        )}
                                        {!r.reconcile.legacy_id_match && r.reconcile.has_profile && (
                                          <Button
                                            size="sm" variant="outline" className="text-xs h-7"
                                            onClick={() => setConfirmDialog({ action: 'fix_legacy_id', email: r.email, detail: `Vincular legacy_user_id=${r.legacy_id}` })}
                                          >
                                            Fix Legacy ID
                                          </Button>
                                        )}
                                        {!r.reconcile.level_match && r.reconcile.has_profile && (
                                          <Button
                                            size="sm" variant="outline" className="text-xs h-7"
                                            onClick={() => setConfirmDialog({ action: 'fix_level', email: r.email, detail: `Corrigir level para ${r.level}` })}
                                          >
                                            Fix Level
                                          </Button>
                                        )}
                                        {!r.reconcile.has_full_name && r.reconcile.has_profile && (
                                          <Button
                                            size="sm" variant="outline" className="text-xs h-7"
                                            onClick={() => setConfirmDialog({ action: 'fix_full_name', email: r.email, detail: `Definir full_name` })}
                                          >
                                            Fix Nome
                                          </Button>
                                        )}
                                        {!r.reconcile.has_level_legacy && r.reconcile.has_profile && (
                                          <Button
                                            size="sm" variant="outline" className="text-xs h-7"
                                            onClick={() => setConfirmDialog({ action: 'fix_level_legacy', email: r.email, detail: `Definir level_legacy=${r.level}` })}
                                          >
                                            Fix Level Legacy
                                          </Button>
                                        )}
                                      </>
                                    )}
                                    {/* Invite button for consistent/created profiles */}
                                    {(r.category === 'consistent' || r.status === 'created') && r.existing_profile_id && (
                                      <Button
                                        size="sm" variant="outline" className="text-xs h-7"
                                        disabled={invitingEmail === r.email}
                                        onClick={() => handleSendInvite(r.email)}
                                      >
                                        {invitingEmail === r.email
                                          ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                          : <Mail className="h-3 w-3 mr-1" />}
                                        Enviar Convite
                                      </Button>
                                    )}
                                  </div>
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
                Lote Piloto & Execução
              </CardTitle>
              <CardDescription>
                Monte o lote limpo e execute o backfill real com opção de enviar convites de ativação.
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

              {/* Send invites toggle */}
              <div className="flex items-center gap-3 p-3 border rounded-md bg-muted/30">
                <Switch checked={sendInvites} onCheckedChange={setSendInvites} />
                <div>
                  <p className="text-sm font-medium text-foreground">Enviar convites de ativação</p>
                  <p className="text-xs text-muted-foreground">
                    Envia email com link de redefinição de senha para cada usuário criado (apenas is_active=true).
                  </p>
                </div>
                <Send className="h-4 w-4 text-muted-foreground ml-auto" />
              </div>

              {!pilotReady && dryResult && (
                <Alert variant="destructive">
                  <AlertOctagon className="h-4 w-4" />
                  <AlertTitle>Backfill bloqueado</AlertTitle>
                  <AlertDescription>
                    Existem inconsistências pendentes. Resolva todos os problemas antes de executar o backfill real.
                    {finalCounts.invalid_email > 0 && <div>• {finalCounts.invalid_email} email(s) inválido(s)</div>}
                    {finalCounts.legacy_conflict > 0 && <div>• {finalCounts.legacy_conflict} conflito(s)</div>}
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
                    {pilotBatch.length} usuários prontos. {sendInvites ? 'Convites serão enviados após criação.' : 'Convites desativados.'}
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
                    Executar Backfill Real {sendInvites ? '+ Convites' : ''}
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
