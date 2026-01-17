// ============================================================================
// INCIDENT DETAIL PAGE
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  User,
  Server,
  Building2,
  MessageSquare,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  getIncident,
  getIncidentActions,
  getIncidentRootCause,
  updateIncident,
  createIncidentAction,
  createIncidentRootCause,
  getTechUsers,
} from '@/services/techOpsService';
import type {
  TechIncident,
  TechIncidentAction,
  TechIncidentRootCause,
  TechUser,
  IncidentStatus,
  RootCauseCategory,
} from '@/types/techOps';
import {
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_SEVERITY_COLORS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_COLORS,
  INCIDENT_TYPE_LABELS,
  INCIDENT_ORIGIN_LABELS,
  SLA_LEVEL_LABELS,
  ROOT_CAUSE_CATEGORY_LABELS,
  INCIDENT_FLOW_STEPS,
  canTransitionTo,
} from '@/types/techOps';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [incident, setIncident] = useState<TechIncident | null>(null);
  const [actions, setActions] = useState<TechIncidentAction[]>([]);
  const [rootCause, setRootCause] = useState<TechIncidentRootCause | null>(null);
  const [users, setUsers] = useState<TechUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Root cause dialog
  const [rootCauseDialogOpen, setRootCauseDialogOpen] = useState(false);
  const [rootCauseCategory, setRootCauseCategory] = useState<RootCauseCategory>('DESCONHECIDO');
  const [rootCauseDetails, setRootCauseDetails] = useState('');

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);
      const [incidentData, actionsData, rootCauseData, usersData] = await Promise.all([
        getIncident(id!),
        getIncidentActions(id!),
        getIncidentRootCause(id!),
        getTechUsers({ is_active: true }),
      ]);
      setIncident(incidentData);
      setActions(actionsData);
      setRootCause(rootCauseData);
      setUsers(usersData);
    } catch (error) {
      console.error('Erro ao carregar incidente:', error);
      toast({ title: 'Erro', description: 'Não foi possível carregar o incidente', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleAddComment() {
    if (!newComment.trim() || !incident) return;
    try {
      setSubmitting(true);
      await createIncidentAction({
        incident_id: incident.id,
        action_type: 'comment',
        action_text: newComment.trim(),
      });
      setNewComment('');
      await loadData();
      toast({ title: 'Sucesso', description: 'Comentário adicionado' });
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível adicionar comentário', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(newStatus: IncidentStatus) {
    if (!incident) return;
    
    const validation = canTransitionTo(incident.status, newStatus, incident, actions.filter(a => a.action_type === 'comment').length);
    if (!validation.allowed) {
      toast({ title: 'Transição não permitida', description: validation.reason, variant: 'destructive' });
      return;
    }

    // If trying to close, require root cause
    if (newStatus === 'ENCERRADO' && !rootCause) {
      setRootCauseDialogOpen(true);
      return;
    }

    try {
      setSubmitting(true);
      const updateData: Partial<TechIncident> = { status: newStatus };
      if (newStatus === 'RESOLVIDO') updateData.resolved_at = new Date().toISOString();
      if (newStatus === 'ENCERRADO') updateData.closed_at = new Date().toISOString();
      
      await updateIncident(incident.id, updateData);
      await createIncidentAction({
        incident_id: incident.id,
        action_type: 'status_change',
        action_text: `Status alterado de ${INCIDENT_STATUS_LABELS[incident.status]} para ${INCIDENT_STATUS_LABELS[newStatus]}`,
        metadata: { from: incident.status, to: newStatus },
      });
      await loadData();
      toast({ title: 'Sucesso', description: 'Status atualizado' });
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível atualizar status', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssignOwner(userId: string) {
    if (!incident) return;
    try {
      setSubmitting(true);
      await updateIncident(incident.id, { owner_user_id: userId });
      const user = users.find(u => u.id === userId);
      await createIncidentAction({
        incident_id: incident.id,
        action_type: 'assignment',
        action_text: `Incidente atribuído a ${user?.name || userId}`,
        metadata: { owner_user_id: userId },
      });
      await loadData();
      toast({ title: 'Sucesso', description: 'Responsável atribuído' });
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível atribuir responsável', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveRootCause() {
    if (!incident || !rootCauseDetails.trim()) return;
    try {
      setSubmitting(true);
      await createIncidentRootCause({
        incident_id: incident.id,
        category: rootCauseCategory,
        details: rootCauseDetails.trim(),
      });
      setRootCauseDialogOpen(false);
      await loadData();
      toast({ title: 'Sucesso', description: 'Causa raiz registrada' });
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível salvar causa raiz', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-xl font-semibold mb-2">Incidente não encontrado</h2>
        <Link to="/modulos/atendimentos/suporte-tecnico/incidentes">
          <Button variant="outline">Voltar para lista</Button>
        </Link>
      </div>
    );
  }

  const currentStepIndex = INCIDENT_FLOW_STEPS.findIndex(s => s.status === incident.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link to="/modulos/atendimentos/suporte-tecnico/incidentes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Badge className={INCIDENT_SEVERITY_COLORS[incident.severidade]}>
              {INCIDENT_SEVERITY_LABELS[incident.severidade]}
            </Badge>
            <Badge variant="outline" className={INCIDENT_STATUS_COLORS[incident.status]}>
              {INCIDENT_STATUS_LABELS[incident.status]}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold">{incident.title}</h1>
          <p className="text-muted-foreground mt-1">{incident.description}</p>
        </div>
      </div>

      {/* Flow Stepper */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            {INCIDENT_FLOW_STEPS.map((step, index) => {
              const isActive = step.status === incident.status;
              const isPast = index < currentStepIndex;
              const isEscalated = incident.status === 'ESCALADO' && step.status === 'EM_ATENDIMENTO';
              
              return (
                <div key={step.status} className="flex items-center">
                  <div className={`flex flex-col items-center ${index > 0 ? 'ml-4' : ''}`}>
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center border-2 ${
                        isPast ? 'bg-green-500 border-green-500 text-white' :
                        isActive ? 'bg-primary border-primary text-primary-foreground' :
                        'border-muted-foreground/30 text-muted-foreground'
                      }`}
                    >
                      {isPast ? <CheckCircle className="h-4 w-4" /> : index + 1}
                    </div>
                    <span className={`text-xs mt-1 ${isActive ? 'font-medium' : 'text-muted-foreground'}`}>
                      {step.label}
                    </span>
                  </div>
                  {index < INCIDENT_FLOW_STEPS.length - 1 && (
                    <div className={`h-0.5 w-12 ml-4 ${isPast ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Actions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Ações de Fluxo</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {incident.status === 'ABERTO' && (
                <Button onClick={() => handleStatusChange('CLASSIFICADO')} disabled={submitting}>
                  Classificar
                </Button>
              )}
              {incident.status === 'CLASSIFICADO' && (
                <Button onClick={() => handleStatusChange('EM_ATENDIMENTO')} disabled={submitting || !incident.owner_user_id}>
                  Iniciar Atendimento
                </Button>
              )}
              {incident.status === 'EM_ATENDIMENTO' && (
                <>
                  <Button variant="outline" onClick={() => handleStatusChange('ESCALADO')} disabled={submitting}>
                    <ArrowUpRight className="h-4 w-4 mr-2" />
                    Escalar
                  </Button>
                  <Button onClick={() => handleStatusChange('RESOLVIDO')} disabled={submitting}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Resolver
                  </Button>
                </>
              )}
              {incident.status === 'ESCALADO' && (
                <>
                  <Button variant="outline" onClick={() => handleStatusChange('EM_ATENDIMENTO')} disabled={submitting}>
                    Retornar ao Atendimento
                  </Button>
                  <Button onClick={() => handleStatusChange('RESOLVIDO')} disabled={submitting}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Resolver
                  </Button>
                </>
              )}
              {incident.status === 'RESOLVIDO' && (
                <Button onClick={() => handleStatusChange('ENCERRADO')} disabled={submitting}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Encerrar
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Timeline de Ações
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Add Comment */}
              <div className="flex gap-2 mb-6">
                <Textarea
                  placeholder="Adicionar ação técnica ou comentário..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={2}
                  className="flex-1"
                />
                <Button onClick={handleAddComment} disabled={!newComment.trim() || submitting}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              {/* Actions List */}
              <div className="space-y-4">
                {actions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhuma ação registrada ainda
                  </p>
                ) : (
                  actions.map((action) => (
                    <div key={action.id} className="flex gap-3 p-3 rounded-lg bg-accent/30">
                      <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        {action.action_type === 'status_change' ? (
                          <ArrowUpRight className="h-4 w-4 text-primary" />
                        ) : action.action_type === 'assignment' ? (
                          <User className="h-4 w-4 text-primary" />
                        ) : (
                          <MessageSquare className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{action.user?.name || 'Sistema'}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(action.created_at), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-sm">{action.action_text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Root Cause */}
          {rootCause && (
            <Card>
              <CardHeader>
                <CardTitle>Causa Raiz</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className="mb-2">{ROOT_CAUSE_CATEGORY_LABELS[rootCause.category]}</Badge>
                <p>{rootCause.details}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle>Detalhes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Tipo</label>
                <p className="font-medium">{INCIDENT_TYPE_LABELS[incident.tipo]}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Origem</label>
                <p className="font-medium">{INCIDENT_ORIGIN_LABELS[incident.origin_channel]}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">SLA Aplicado</label>
                <p className="font-medium">{SLA_LEVEL_LABELS[incident.sla_level_aplicado]}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Abertura</label>
                <p className="font-medium">{format(new Date(incident.opened_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
              </div>
              {incident.resolved_at && (
                <div>
                  <label className="text-sm text-muted-foreground">Resolvido em</label>
                  <p className="font-medium">{format(new Date(incident.resolved_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Client */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {incident.client ? (
                <Link
                  to={`/modulos/atendimentos/suporte-tecnico/clientes/${incident.client_id}`}
                  className="hover:underline"
                >
                  <p className="font-medium">{incident.client.nome_fantasia || incident.client.razao_social}</p>
                  <p className="text-sm text-muted-foreground">SLA: {SLA_LEVEL_LABELS[incident.client.sla_level]}</p>
                </Link>
              ) : (
                <p className="text-muted-foreground">Cliente não encontrado</p>
              )}
            </CardContent>
          </Card>

          {/* Asset */}
          {incident.asset && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  Asset
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  to={`/modulos/atendimentos/suporte-tecnico/infra/${incident.asset_id}`}
                  className="hover:underline"
                >
                  <p className="font-medium">{incident.asset.identificador}</p>
                  <p className="text-sm text-muted-foreground">
                    {incident.asset.tipo}
                    {incident.asset.ip_principal && ` • ${incident.asset.ip_principal}`}
                  </p>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Owner */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Responsável
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={incident.owner_user_id ?? '__none__'}
                onValueChange={(v) => v !== '__none__' && handleAssignOwner(v)}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem responsável</SelectItem>
                  {users.filter(u => ['N1', 'N2', 'N3', 'ADMIN'].includes(u.role)).map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Root Cause Dialog */}
      <Dialog open={rootCauseDialogOpen} onOpenChange={setRootCauseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Causa Raiz</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Categoria</Label>
              <Select value={rootCauseCategory} onValueChange={(v) => setRootCauseCategory(v as RootCauseCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HARDWARE">Hardware</SelectItem>
                  <SelectItem value="CONFIG">Configuração</SelectItem>
                  <SelectItem value="HUMANO">Erro Humano</SelectItem>
                  <SelectItem value="EXTERNO">Fator Externo</SelectItem>
                  <SelectItem value="DESCONHECIDO">Desconhecido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Detalhes</Label>
              <Textarea
                value={rootCauseDetails}
                onChange={(e) => setRootCauseDetails(e.target.value)}
                placeholder="Descreva a causa raiz identificada..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRootCauseDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveRootCause} disabled={!rootCauseDetails.trim() || submitting}>
              Salvar e Encerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
