// ============================================================================
// TICKET PERMISSIONS HELPER
// Derives UI permissions from user level and ticket state
// Backend remains the authority — these are UI hints only
// ============================================================================

import type { CoreTicket, TicketStatus, TicketAction } from '@/services/supportTicketCoreService';

export interface TicketPermissions {
  canView: boolean;
  canCreate: boolean;
  canAssign: boolean;
  canStart: boolean;
  canTransfer: boolean;
  canEscalate: boolean;
  canWaitCustomer: boolean;
  canWaitThirdParty: boolean;
  canResolve: boolean;
  canClose: boolean;
  canReopen: boolean;
  canCancel: boolean;
  canAddPublicMessage: boolean;
  canAddInternalNote: boolean;
  canViewInternalNotes: boolean;
  canViewQueue: boolean;
  canManageSLA: boolean;
  isClient: boolean;
  isInternal: boolean;
}

const ACTIVE_STATUSES: TicketStatus[] = [
  'novo', 'triagem', 'em_atendimento',
  'aguardando_cliente', 'aguardando_terceiro',
  'escalado_n2', 'escalado_n3', 'reaberto',
];

const WAITING_STATUSES: TicketStatus[] = [
  'aguardando_cliente', 'aguardando_terceiro',
];

export function getTicketPermissions(
  userLevel: number,
  ticket?: CoreTicket | null,
  userId?: string
): TicketPermissions {
  const isClient = userLevel <= 200;
  const isInternal = userLevel >= 600;
  const isCS = userLevel >= 775;
  const isSupport = userLevel >= 900;
  const isManager = userLevel >= 950;
  const isAdmin = userLevel >= 1000;

  const status = ticket?.status;
  const isActive = status ? ACTIVE_STATUSES.includes(status) : false;
  const isAssignedToMe = ticket?.assigned_to_user_id === userId;
  const isResolved = status === 'resolvido_suporte';
  const isClosed = status === 'encerrado_cs';
  const isCancelled = status === 'cancelado';
  const isTerminal = isClosed || isCancelled;

  return {
    canView: true,
    canCreate: true,
    canAssign: (isSupport || isManager || isAdmin) && isActive,
    canStart: (isSupport || isAdmin) && (status === 'novo' || status === 'triagem' || status === 'reaberto'),
    canTransfer: (isManager || isAdmin) && isActive,
    canEscalate: (isSupport || isManager || isAdmin) && isActive,
    canWaitCustomer: (isSupport || isAdmin) && isActive && !WAITING_STATUSES.includes(status!),
    canWaitThirdParty: (isSupport || isAdmin) && isActive && !WAITING_STATUSES.includes(status!),
    canResolve: (isSupport || isAdmin) && isActive,
    canClose: (isCS || isManager || isAdmin) && (isResolved || isActive),
    canReopen: (isCS || isManager || isAdmin) && (isResolved || isClosed),
    canCancel: (isManager || isAdmin) && !isTerminal,
    canAddPublicMessage: !isTerminal,
    canAddInternalNote: isInternal && !isTerminal,
    canViewInternalNotes: isInternal,
    canViewQueue: isInternal,
    canManageSLA: isAdmin || isManager,
    isClient,
    isInternal,
  };
}

// ── Display labels ──────────────────────────────────────────────────────

export const STATUS_LABELS: Record<TicketStatus, string> = {
  novo: 'Novo',
  triagem: 'Em Triagem',
  em_atendimento: 'Em Atendimento',
  aguardando_cliente: 'Aguardando Cliente',
  aguardando_terceiro: 'Aguardando Terceiro',
  escalado_n2: 'Escalado N2',
  escalado_n3: 'Escalado N3',
  resolvido_suporte: 'Resolvido (Suporte)',
  encerrado_cs: 'Encerrado',
  reaberto: 'Reaberto',
  cancelado: 'Cancelado',
};

export const STATUS_VARIANT: Record<TicketStatus, string> = {
  novo: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  triagem: 'bg-cyan-500/15 text-cyan-500 border-cyan-500/30',
  em_atendimento: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30',
  aguardando_cliente: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  aguardando_terceiro: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  escalado_n2: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  escalado_n3: 'bg-red-500/15 text-red-400 border-red-500/30',
  resolvido_suporte: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  encerrado_cs: 'bg-muted text-muted-foreground border-border',
  reaberto: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  cancelado: 'bg-muted text-muted-foreground border-border',
};

export const SEVERITY_LABELS: Record<string, string> = {
  S1: 'S1 — Crítico',
  S2: 'S2 — Alto',
  S3: 'S3 — Médio',
  S4: 'S4 — Baixo',
};

export const SEVERITY_VARIANT: Record<string, string> = {
  S1: 'bg-red-600/20 text-red-400 border-red-600/30',
  S2: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  S3: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  S4: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

export const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export const CATEGORY_LABELS: Record<string, string> = {
  infraestrutura: 'Infraestrutura',
  virtualizacao: 'Virtualização',
  backup: 'Backup',
  banco_de_dados: 'Banco de Dados',
  rede: 'Rede',
  firewall: 'Firewall',
  storage: 'Storage',
  billing: 'Financeiro',
  acesso: 'Acesso',
  outros: 'Outros',
};

export const TICKET_TYPE_LABELS: Record<string, string> = {
  incidente: 'Incidente',
  solicitacao: 'Solicitação',
  duvida: 'Dúvida',
  alteracao: 'Alteração',
  financeiro: 'Financeiro',
};

export const QUEUE_LABELS: Record<string, string> = {
  N1: 'Fila N1',
  N2: 'Fila N2',
  N3: 'Fila N3',
  CS: 'Fila CS',
};
