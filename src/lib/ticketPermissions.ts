// ============================================================================
// TICKET PERMISSIONS HELPER — Role-first with level fallback
// Uses roles from useAuth() as primary, falls back to profile.level
// Backend remains the authority — these are UI hints only
// ============================================================================

import type { CoreTicket, TicketStatus, TicketAction } from '@/services/supportTicketCoreService';
import type { UserProfile } from '@/contexts/AuthContext';
import type { UserRole } from '@/lib/rbac';
import {
  getEffectiveRoles,
  hasRole as _hasRole,
  isAdmin as _isAdminR,
  isSupport as _isSupportR,
  isSupportManager as _isSupportManagerR,
  isCS as _isCSR,
  isInternal as _isInternalR,
  isClient as _isClientR,
  isPartner as _isPartnerR,
} from '@/lib/rbac';

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
  canManageQueues: boolean;
  canUploadAttachment: boolean;
  isClient: boolean;
  isPartner: boolean;
  isInternal: boolean;
}

// ── Level helpers (exported for guards — backward compat) ───────────────

export function isClientUser(level: number): boolean { return level === 1; }
export function isPartnerUser(level: number): boolean { return level === 200; }
export function isInternalUser(level: number): boolean { return level >= 600; }
export function isSupportUser(level: number): boolean { return level >= 900; }
export function isCSUser(level: number): boolean { return level >= 775 && level < 900; }
export function isSupportManagerUser(level: number): boolean { return level >= 950; }
export function isAdminUser(level: number): boolean { return level >= 1000; }

const ACTIVE_STATUSES: TicketStatus[] = [
  'novo', 'triagem', 'em_atendimento',
  'aguardando_cliente', 'aguardando_terceiro',
  'reaberto',
];

const WAITING_STATUSES: TicketStatus[] = [
  'aguardando_cliente', 'aguardando_terceiro',
];

// ── Role-based permissions (NEW — primary) ──────────────────────────────

export function getTicketPermissionsFromRoles(
  profile: UserProfile | null,
  roles: UserRole[] | null | undefined,
  ticket?: CoreTicket | null,
  userId?: string
): TicketPermissions {
  const eff = getEffectiveRoles(roles, profile);
  const _isAdmin = _isAdminR(eff);
  const _isSupportManager = _isSupportManagerR(eff);
  const _isSupport = _isSupportR(eff);
  const _isCS = _isCSR(eff);
  const _isInternal = _isInternalR(eff);
  const _isClient = _isClientR(eff);
  const _isPartner = _isPartnerR(eff);
  const _isNocManager = _hasRole(eff, 'noc_manager');

  const status = ticket?.status;
  const isActive = status ? ACTIVE_STATUSES.includes(status) : false;
  const isResolved = status === 'resolvido_suporte';
  const isClosed = status === 'encerrado_cs';
  const isCancelled = status === 'cancelado';
  const isTerminal = isClosed || isCancelled;

  return {
    canView: true,
    canCreate: _isClient || _isInternal,
    canAssign: (_isSupport || _isSupportManager || _isAdmin) && isActive,
    canStart: (_isSupport || _isAdmin) && (status === 'novo' || status === 'triagem' || status === 'reaberto'),
    canTransfer: (_isSupport || _isSupportManager || _isAdmin) && isActive,
    canEscalate: (_isSupport || _isSupportManager || _isAdmin) && isActive,
    canWaitCustomer: (_isSupport || _isAdmin) && isActive && !WAITING_STATUSES.includes(status!),
    canWaitThirdParty: (_isSupport || _isAdmin) && isActive && !WAITING_STATUSES.includes(status!),
    canResolve: (_isSupport || _isAdmin) && isActive,
    canClose: (_isCS || _isSupportManager || _isAdmin) && (isResolved || isActive),
    canReopen: (_isCS || _isSupportManager || _isAdmin) && (isResolved || isClosed),
    canCancel: (_isSupportManager || _isAdmin) && !isTerminal,
    canAddPublicMessage: !isTerminal && (_isClient || _isInternal),
    canAddInternalNote: _isInternal && !isTerminal,
    canViewInternalNotes: _isInternal,
    canViewQueue: _isInternal,
    canManageSLA: _isAdmin || _isSupportManager,
    canManageQueues: _isSupport || _isSupportManager || _isAdmin,
    canUploadAttachment: !isTerminal && (_isClient || _isInternal),
    isClient: _isClient,
    isPartner: _isPartner,
    isInternal: _isInternal,
  };
}

// ── Legacy level-based permissions (fallback) ───────────────────────────

export function getTicketPermissions(
  userLevel: number,
  ticket?: CoreTicket | null,
  userId?: string
): TicketPermissions {
  const isClient = isClientUser(userLevel);
  const isPartner = isPartnerUser(userLevel);
  const _isInternal = isInternalUser(userLevel);
  const _isCS = userLevel >= 775;
  const _isSupport = userLevel >= 900;
  const isManager = userLevel >= 950;
  const _isAdmin = userLevel >= 1000;

  const status = ticket?.status;
  const isActive = status ? ACTIVE_STATUSES.includes(status) : false;
  const isResolved = status === 'resolvido_suporte';
  const isClosed = status === 'encerrado_cs';
  const isCancelled = status === 'cancelado';
  const isTerminal = isClosed || isCancelled;

  return {
    canView: true,
    canCreate: isClient || _isInternal,
    canAssign: (_isSupport || isManager || _isAdmin) && isActive,
    canStart: (_isSupport || _isAdmin) && (status === 'novo' || status === 'triagem' || status === 'reaberto'),
    canTransfer: (_isSupport || isManager || _isAdmin) && isActive,
    canEscalate: (_isSupport || isManager || _isAdmin) && isActive,
    canWaitCustomer: (_isSupport || _isAdmin) && isActive && !WAITING_STATUSES.includes(status!),
    canWaitThirdParty: (_isSupport || _isAdmin) && isActive && !WAITING_STATUSES.includes(status!),
    canResolve: (_isSupport || _isAdmin) && isActive,
    canClose: (_isCS || isManager || _isAdmin) && (isResolved || isActive),
    canReopen: (_isCS || isManager || _isAdmin) && (isResolved || isClosed),
    canCancel: (isManager || _isAdmin) && !isTerminal,
    canAddPublicMessage: !isTerminal && (isClient || _isInternal),
    canAddInternalNote: _isInternal && !isTerminal,
    canViewInternalNotes: _isInternal,
    canViewQueue: _isInternal,
    canManageSLA: _isAdmin || isManager,
    canManageQueues: _isSupport || isManager || _isAdmin,
    canUploadAttachment: !isTerminal && (isClient || _isInternal),
    isClient,
    isPartner,
    isInternal: _isInternal,
  };
}

// ── Display labels ──────────────────────────────────────────────────────

export const STATUS_LABELS: Record<string, string> = {
  novo: 'Novo',
  triagem: 'Em Triagem',
  em_atendimento: 'Em Atendimento',
  aguardando_cliente: 'Aguardando Cliente',
  aguardando_terceiro: 'Aguardando Terceiro',
  resolvido_suporte: 'Resolvido (Suporte)',
  encerrado_cs: 'Encerrado',
  reaberto: 'Reaberto',
  cancelado: 'Cancelado',
};

export const STATUS_VARIANT: Record<string, string> = {
  novo: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  triagem: 'bg-cyan-500/15 text-cyan-500 border-cyan-500/30',
  em_atendimento: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30',
  aguardando_cliente: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  aguardando_terceiro: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
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
  VM: 'VM / Virtualização',
  BARE_METAL: 'Bare Metal',
  BACKUP: 'Backup',
  STORAGE: 'Storage',
  REDE: 'Rede',
  FIREWALL: 'Firewall',
  BANCO: 'Banco de Dados',
  CLOUD: 'Cloud',
  OUTROS: 'Outros',
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
  INCIDENTE: 'Incidente',
  SOLICITACAO: 'Solicitação',
  DUVIDA: 'Dúvida',
  ALTERACAO: 'Alteração',
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

// ── Route helpers ───────────────────────────────────────────────────────

export const TICKET_LIST_ROUTE = '/modulos/atendimentos/suporte-tecnico';
export const TICKET_DETAIL_ROUTE = (id: string) => `/modulos/atendimentos/suporte-tecnico/${id}`;
export const CLIENT_TICKET_LIST_ROUTE = '/portal/tickets';
export const CLIENT_TICKET_DETAIL_ROUTE = (id: string) => `/portal/tickets/${id}`;

export function getTicketListRoute(userLevel: number): string {
  return isInternalUser(userLevel) ? TICKET_LIST_ROUTE : CLIENT_TICKET_LIST_ROUTE;
}

export function getTicketDetailRoute(userLevel: number, ticketId: string): string {
  return isInternalUser(userLevel) ? TICKET_DETAIL_ROUTE(ticketId) : CLIENT_TICKET_DETAIL_ROUTE(ticketId);
}
