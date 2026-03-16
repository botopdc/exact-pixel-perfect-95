// ============================================================================
// ANALISTAS CAPACITY PAGE — Visão de produtividade + gestão por analista
// Rota: /modulos/atendimentos/analistas
// ============================================================================

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Plus, Phone, Clock, AlertTriangle, CheckCircle, Trash2, ToggleLeft, ToggleRight, Calendar } from 'lucide-react';
import { ModuleHeader } from '@/components/navigation/ModuleCard';
import { authService } from '@/services/authService';
import { useQueues, useQueueMemberMutations } from '@/hooks/useSupportTicketCore';
import { supportTicketCoreService } from '@/services/supportTicketCoreService';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────

interface AnalystSummary {
  name: string;
  email: string;
  userId: number;
  level: number;
  queues: { queueId: string; queueCode: string; queueName: string; isPrimary: boolean; isActive: boolean; memberId: string }[];
  activeTickets: number;
  breachedTickets: number;
  resolvedToday: number;
  avgFirstResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
  isOnCall: boolean;
  onCallTeam: string | null;
}

interface OnCallShift {
  id: string;
  team_code: string;
  team_name: string;
  user_name: string;
  user_email: string | null;
  user_id: number | null;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  notes: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

// ── Hook: aggregate analyst data ────────────────────────────────────────

function useAnalystCapacity() {
  return useQuery({
    queryKey: ['analyst-capacity-full'],
    queryFn: async (): Promise<AnalystSummary[]> => {
      const queueMembers = await supportTicketCoreService.listQueueMembers();
      console.log('Analistas raw queue members', queueMembers);

      const mappedData = await supportTicketCoreService.listAnalystCapacitySummary();
      const normalizedData: AnalystSummary[] = mappedData.map((item) => ({
        name: item.name,
        email: item.email,
        userId: item.user_id,
        level: item.level,
        queues: (item.queues || []).map((queue) => ({
          queueId: queue.queue_id,
          queueCode: queue.queue_code,
          queueName: queue.queue_name,
          isPrimary: queue.is_primary,
          isActive: queue.is_active,
          memberId: queue.member_id,
        })),
        activeTickets: item.active_tickets,
        breachedTickets: item.breached_tickets,
        resolvedToday: item.resolved_today,
        avgFirstResponseMinutes: item.avg_first_response_minutes,
        avgResolutionMinutes: item.avg_resolution_minutes,
        isOnCall: item.is_oncall,
        onCallTeam: item.oncall_team,
      }));

      console.log('Analistas mapped data', normalizedData);
      return normalizedData;
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

// ── Hook: on-call shifts management ─────────────────────────────────────

function useOnCallShifts() {
  return useQuery({
    queryKey: ['oncall-shifts-all'],
    queryFn: async () => {
      const shifts = await supportTicketCoreService.listOnCallShifts();
      return shifts as OnCallShift[];
    },
    staleTime: 30_000,
  });
}

function formatDuration(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return '—';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  return `${(minutes / 60).toFixed(1)} h`;
}

// ── Main Component ──────────────────────────────────────────────────────

export default function AnalistasCapacityPage() {
  const session = authService.getSession();
  const userLevel = session?.level ?? 0;
  const canManage = userLevel >= 950;

  const { data: analysts, isLoading } = useAnalystCapacity();
  const { data: queues } = useQueues();
  const { addMember, removeMember, toggleMember } = useQueueMemberMutations();
  const { data: onCallShifts } = useOnCallShifts();
  const queryClient = useQueryClient();

  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addOnCallOpen, setAddOnCallOpen] = useState(false);
  const [newMember, setNewMember] = useState({ queue_id: '', user_id: '', user_name: '', user_email: '', user_level: '900' });
  const [newOnCall, setNewOnCall] = useState({ team_code: 'infra', user_name: '', user_email: '', user_id: '', starts_at: '', ends_at: '' });

  const TEAM_OPTIONS = [
    { code: 'infra', name: 'Infraestrutura' },
    { code: 'cloud', name: 'Cloud' },
    { code: 'cs', name: 'Customer Success' },
  ];

  const createOnCallMutation = useMutation({
    mutationFn: async (payload: typeof newOnCall) => {
      const team = TEAM_OPTIONS.find(t => t.code === payload.team_code);
      await supportTicketCoreService.createOnCallShift({
        team_code: payload.team_code,
        team_name: team?.name || payload.team_code,
        user_name: payload.user_name,
        user_email: payload.user_email || undefined,
        user_id: payload.user_id ? parseInt(payload.user_id) : undefined,
        starts_at: payload.starts_at,
        ends_at: payload.ends_at,
      });
    },
    onSuccess: () => {
      toast.success('Plantão criado');
      queryClient.invalidateQueries({ queryKey: ['oncall-shifts-all'] });
      queryClient.invalidateQueries({ queryKey: ['analyst-capacity-full'] });
      queryClient.invalidateQueries({ queryKey: ['support-dashboard-stats'] });
      setAddOnCallOpen(false);
      setNewOnCall({ team_code: 'infra', user_name: '', user_email: '', user_id: '', starts_at: '', ends_at: '' });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteOnCallMutation = useMutation({
    mutationFn: async (id: string) => {
      await supportTicketCoreService.deleteOnCallShift(id);
    },
    onSuccess: () => {
      toast.success('Plantão encerrado');
      queryClient.invalidateQueries({ queryKey: ['oncall-shifts-all'] });
      queryClient.invalidateQueries({ queryKey: ['analyst-capacity-full'] });
      queryClient.invalidateQueries({ queryKey: ['support-dashboard-stats'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleAddMember = async () => {
    if (!newMember.queue_id || !newMember.user_id || !newMember.user_name || !newMember.user_email) return;

    await addMember.mutateAsync({
      queue_id: newMember.queue_id,
      user_id: newMember.user_id,
      user_name: newMember.user_name,
      user_email: newMember.user_email,
      user_level: parseInt(newMember.user_level, 10),
    });

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['support-queue-members'] }),
      queryClient.invalidateQueries({ queryKey: ['analyst-capacity-full'] }),
      queryClient.invalidateQueries({ queryKey: ['support-dashboard-stats'] }),
    ]);

    setNewMember({ queue_id: '', user_id: '', user_name: '', user_email: '', user_level: '900' });
    setAddMemberOpen(false);
  };

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Analistas"
        description="Capacidade, produtividade e gestão do time de suporte"
        icon={Users}
        actions={canManage ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddOnCallOpen(true)}>
              <Phone className="h-4 w-4 mr-1" /> Definir Plantão
            </Button>
            <Button size="sm" onClick={() => setAddMemberOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar à Fila
            </Button>
          </div>
        ) : undefined}
      />

      <Tabs defaultValue="capacidade">
        <TabsList>
          <TabsTrigger value="capacidade">Capacidade</TabsTrigger>
          {canManage && <TabsTrigger value="plantao">Plantão</TabsTrigger>}
          {canManage && <TabsTrigger value="gestao">Gestão de Filas</TabsTrigger>}
        </TabsList>

        {/* ── Tab: Capacidade ──────────────────────────────────────────── */}
        <TabsContent value="capacidade" className="space-y-4">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-44 w-full" />)}
            </div>
          ) : !analysts || analysts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Nenhum analista cadastrado nas filas de suporte.</p>
                {canManage && (
                  <Button className="mt-4" size="sm" onClick={() => setAddMemberOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar Analista
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {analysts.map(a => (
                <Card key={`${a.userId}-${a.email}`} className="relative">
                  {a.isOnCall && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="outline" className="bg-accent/50 text-accent-foreground border-accent text-xs">
                        <Phone className="h-3 w-3 mr-1" />
                        Plantão {a.onCallTeam || 'ativo'}
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm font-semibold">{a.name}</CardTitle>
                      <Badge variant="outline">Nível {a.level}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{a.email}</p>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {a.queues.map(q => (
                        <Badge key={q.memberId} variant="outline" className="text-xs" title={q.queueName}>
                          {q.queueCode}
                          {q.isPrimary && <span className="ml-0.5 text-primary">★</span>}
                        </Badge>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-xl font-bold">{a.activeTickets}</p>
                        <p className="text-xs text-muted-foreground">Ativos</p>
                      </div>
                      <div>
                        <p className={`text-xl font-bold ${a.breachedTickets > 0 ? 'text-destructive' : ''}`}>
                          {a.breachedTickets}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center justify-center gap-0.5">
                          <AlertTriangle className="h-3 w-3" /> Vencidos
                        </p>
                      </div>
                      <div>
                        <p className="text-xl font-bold text-primary">{a.resolvedToday}</p>
                        <p className="text-xs text-muted-foreground flex items-center justify-center gap-0.5">
                          <CheckCircle className="h-3 w-3" /> Hoje
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 rounded-md border p-2 text-xs">
                      <div className="space-y-0.5">
                        <p className="text-muted-foreground">Média 1ª resposta</p>
                        <p className="font-medium">{formatDuration(a.avgFirstResponseMinutes)}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-muted-foreground">Média resolução</p>
                        <p className="font-medium">{formatDuration(a.avgResolutionMinutes)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Tab: Plantão ─────────────────────────────────────────────── */}
        {canManage && (
          <TabsContent value="plantao" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Plantões Registrados
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!onCallShifts || onCallShifts.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-6">Nenhum plantão registrado.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Plantonista</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Fim</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {onCallShifts.map(s => {
                        const now = new Date();
                        const isCurrentlyActive = s.is_active && new Date(s.starts_at) <= now && new Date(s.ends_at) >= now;
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">{s.team_name || s.team_code}</TableCell>
                            <TableCell>{s.user_name}</TableCell>
                            <TableCell className="text-xs">{new Date(s.starts_at).toLocaleString('pt-BR')}</TableCell>
                            <TableCell className="text-xs">{new Date(s.ends_at).toLocaleString('pt-BR')}</TableCell>
                            <TableCell>
                              {isCurrentlyActive ? (
                                <Badge variant="outline" className="bg-accent/50 text-accent-foreground border-accent">Ativo</Badge>
                              ) : (
                                <Badge variant="secondary">Inativo</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost" size="icon"
                                onClick={() => deleteOnCallMutation.mutate(s.id)}
                                disabled={deleteOnCallMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Tab: Gestão de Filas ─────────────────────────────────────── */}
        {canManage && (
          <TabsContent value="gestao" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Membros por Fila</CardTitle>
              </CardHeader>
              <CardContent>
                {!analysts || analysts.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-6">Nenhum membro cadastrado.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Analista</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Nível</TableHead>
                        <TableHead>Filas</TableHead>
                        <TableHead>Tickets</TableHead>
                        <TableHead>Médias</TableHead>
                        <TableHead>Plantão</TableHead>
                        <TableHead className="w-20">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysts.map(a => (
                        <TableRow key={`${a.userId}-${a.email}`}>
                          <TableCell className="font-medium">{a.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{a.email}</TableCell>
                          <TableCell><Badge variant="outline">{a.level}</Badge></TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {a.queues.map(q => (
                                <Badge key={q.memberId} variant={q.isActive ? 'default' : 'secondary'} className="text-xs" title={q.queueName}>
                                  {q.queueCode}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{a.activeTickets} ativos</span>
                            {a.breachedTickets > 0 && (
                              <span className="text-xs text-destructive ml-1">({a.breachedTickets} vencidos)</span>
                            )}
                            <div className="text-xs text-muted-foreground">{a.resolvedToday} resolvidos hoje</div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div>1ª resp: <span className="font-medium">{formatDuration(a.avgFirstResponseMinutes)}</span></div>
                            <div>Resolução: <span className="font-medium">{formatDuration(a.avgResolutionMinutes)}</span></div>
                          </TableCell>
                          <TableCell>
                            {a.isOnCall ? (
                              <Badge variant="outline" className="bg-accent/50 text-accent-foreground border-accent">
                                {a.onCallTeam || 'Ativo'}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Não</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {a.queues.map(q => (
                                <Button
                                  key={q.memberId}
                                  variant="ghost" size="icon"
                                  title={`Remover de ${q.queueCode}`}
                                  onClick={() => {
                                    if (confirm(`Remover ${a.name} da fila ${q.queueCode}?`)) {
                                      removeMember.mutate(q.memberId);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* ── Dialog: Adicionar Membro à Fila ─────────────────────────────── */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Analista à Fila</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Fila</Label>
              <Select value={newMember.queue_id} onValueChange={v => setNewMember(p => ({ ...p, queue_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione a fila" /></SelectTrigger>
                <SelectContent>
                  {(queues || []).map((q: any) => (
                    <SelectItem key={q.id} value={q.id}>{q.name} ({q.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ID do Usuário (CORE)</Label>
              <Input value={newMember.user_id} onChange={e => setNewMember(p => ({ ...p, user_id: e.target.value }))} placeholder="Ex: 42" />
            </div>
            <div>
              <Label>Nome</Label>
              <Input value={newMember.user_name} onChange={e => setNewMember(p => ({ ...p, user_name: e.target.value }))} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={newMember.user_email} onChange={e => setNewMember(p => ({ ...p, user_email: e.target.value }))} />
            </div>
            <div>
              <Label>Nível</Label>
              <Select value={newMember.user_level} onValueChange={v => setNewMember(p => ({ ...p, user_level: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="775">775 — CS</SelectItem>
                  <SelectItem value="900">900 — Suporte</SelectItem>
                  <SelectItem value="950">950 — Gerente</SelectItem>
                  <SelectItem value="1000">1000 — Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddMember} disabled={addMember.isPending}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Definir Plantão ──────────────────────────────────────── */}
      <Dialog open={addOnCallOpen} onOpenChange={setAddOnCallOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Definir Plantão</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Time</Label>
              <Select value={newOnCall.team_code} onValueChange={v => setNewOnCall(p => ({ ...p, team_code: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEAM_OPTIONS.map(t => (
                    <SelectItem key={t.code} value={t.code}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome do Plantonista</Label>
              <Input value={newOnCall.user_name} onChange={e => setNewOnCall(p => ({ ...p, user_name: e.target.value }))} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={newOnCall.user_email} onChange={e => setNewOnCall(p => ({ ...p, user_email: e.target.value }))} />
            </div>
            <div>
              <Label>ID do Usuário (opcional)</Label>
              <Input value={newOnCall.user_id} onChange={e => setNewOnCall(p => ({ ...p, user_id: e.target.value }))} placeholder="Ex: 42" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início</Label>
                <Input type="datetime-local" value={newOnCall.starts_at} onChange={e => setNewOnCall(p => ({ ...p, starts_at: e.target.value }))} />
              </div>
              <div>
                <Label>Fim</Label>
                <Input type="datetime-local" value={newOnCall.ends_at} onChange={e => setNewOnCall(p => ({ ...p, ends_at: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOnCallOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createOnCallMutation.mutate(newOnCall)}
              disabled={createOnCallMutation.isPending || !newOnCall.user_name || !newOnCall.starts_at || !newOnCall.ends_at}
            >
              Criar Plantão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
