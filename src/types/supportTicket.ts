// ============================================================================
// SUPPORT TICKETS - Types for Atendimento/Chamados (Client-facing tickets)
// API Endpoints: /api/support/tickets/* (Laravel backend)
// ============================================================================

// Status values from API
export type SupportTicketStatus = 
  | 'aberto'
  | 'em_andamento'
  | 'aguardando_cliente'
  | 'aguardando_terceiro'
  | 'resolvido'
  | 'encerrado';

// Priority values from API
export type SupportTicketPriority = 'P0' | 'P1' | 'P2' | 'P3';

// Impact values from API
export type SupportTicketImpact = 'critico' | 'alto' | 'medio' | 'baixo';

// Team/Queue values
export type SupportTeam = 'N1' | 'N2' | 'N3' | 'INFRA' | 'NOC';

// Message attachment
export interface SupportAttachment {
  id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  url: string;
  created_at: string;
}

// Ticket message (comments/notes)
export interface SupportTicketMessage {
  id: number;
  ticket_id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  message: string;
  is_internal_note: boolean;
  attachments: SupportAttachment[];
  created_at: string;
  updated_at: string;
}

// Resource snapshot (VM, Server, etc.)
export interface SupportResourceSnapshot {
  id: number;
  code: string;
  type: string;
  hostname?: string;
  datacenter?: string;
  ip_principal?: string;
  vcpu?: number;
  ram_gb?: number;
  disco_gb?: number;
}

// Client information
export interface SupportClient {
  id: number;
  name: string;
  legal_name?: string;
  cnpj?: string;
  segment?: string;
}

// SLA Timer info
export interface SupportSLAInfo {
  policy_id: number;
  policy_name: string;
  first_response_hours: number;
  resolution_hours: number;
  first_response_due: string; // ISO date
  resolution_due: string; // ISO date
  first_response_at?: string;
  first_response_breached: boolean;
  resolution_breached: boolean;
  paused: boolean;
  paused_at?: string;
  accumulated_pause_minutes: number;
}

// Main Support Ticket entity
export interface SupportTicket {
  id: number;
  ticket_number: string; // e.g., "OPEN-2024-00123"
  
  // Client & Resource
  client_id: number;
  client: SupportClient;
  resource_id?: number;
  resource?: SupportResourceSnapshot;
  
  // Ticket info
  subject: string;
  description: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  impact: SupportTicketImpact;
  
  // Assignment
  assigned_team: SupportTeam;
  assigned_to_user_id?: number;
  assigned_to_user_name?: string;
  assigned_to_user_email?: string;
  
  // SLA
  sla: SupportSLAInfo;
  
  // Metadata
  origin_channel: 'portal' | 'email' | 'whatsapp' | 'telefone' | 'interno';
  tags?: string[];
  metadata?: Record<string, unknown>;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  closed_at?: string;
  
  // Relations
  messages?: SupportTicketMessage[];
  messages_count?: number;
}

// ============================================================================
// FILTER & QUERY TYPES
// ============================================================================

export interface SupportTicketFilters {
  status?: SupportTicketStatus | SupportTicketStatus[];
  priority?: SupportTicketPriority | SupportTicketPriority[];
  impact?: SupportTicketImpact | SupportTicketImpact[];
  assigned_team?: SupportTeam;
  assigned_to?: number;
  client_id?: number;
  resource_type?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface SupportTicketListResponse {
  data: SupportTicket[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

// ============================================================================
// UPDATE/CREATE TYPES
// ============================================================================

export interface SupportTicketUpdatePayload {
  status?: SupportTicketStatus;
  assigned_team?: SupportTeam;
  assigned_to_user_id?: number | null;
  impact?: SupportTicketImpact;
  priority_override?: SupportTicketPriority; // Admin only
}

export interface SupportTicketMessagePayload {
  message: string;
  is_internal_note: boolean;
  attachments?: File[];
}

// ============================================================================
// SLA POLICY TYPES (Admin only)
// ============================================================================

export interface SLAPolicy {
  id: number;
  name: string;
  description?: string;
  priority: SupportTicketPriority;
  impact: SupportTicketImpact;
  first_response_hours: number;
  resolution_hours: number;
  business_hours_only: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SLAPolicyPayload {
  name: string;
  description?: string;
  priority: SupportTicketPriority;
  impact: SupportTicketImpact;
  first_response_hours: number;
  resolution_hours: number;
  business_hours_only: boolean;
  is_active: boolean;
}

// ============================================================================
// REPORT TYPES (Admin only)
// ============================================================================

export interface TicketReportFilters {
  date_from: string;
  date_to: string;
  group_by?: 'day' | 'week' | 'month';
  team?: SupportTeam;
  client_id?: number;
}

export interface TicketReportData {
  period: string;
  opened: number;
  resolved: number;
  closed: number;
  avg_first_response_minutes: number;
  avg_resolution_minutes: number;
  sla_compliance_pct: number;
  by_priority: Record<SupportTicketPriority, number>;
  by_team: Record<SupportTeam, number>;
}

// ============================================================================
// LABELS & DISPLAY HELPERS
// ============================================================================

export const STATUS_LABELS: Record<SupportTicketStatus, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em Andamento',
  aguardando_cliente: 'Aguardando Cliente',
  aguardando_terceiro: 'Aguardando Terceiro',
  resolvido: 'Resolvido',
  encerrado: 'Encerrado',
};

export const PRIORITY_LABELS: Record<SupportTicketPriority, string> = {
  P0: 'P0 - Produção Parada',
  P1: 'P1 - Crítico',
  P2: 'P2 - Alto',
  P3: 'P3 - Médio',
};

export const IMPACT_LABELS: Record<SupportTicketImpact, string> = {
  critico: 'Crítico',
  alto: 'Alto',
  medio: 'Médio',
  baixo: 'Baixo',
};

export const TEAM_LABELS: Record<SupportTeam, string> = {
  N1: 'Suporte N1',
  N2: 'Suporte N2',
  N3: 'Suporte N3',
  INFRA: 'Infraestrutura',
  NOC: 'NOC',
};

// Status colors (semantic tokens)
export const STATUS_COLORS: Record<SupportTicketStatus, string> = {
  aberto: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  em_andamento: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  aguardando_cliente: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  aguardando_terceiro: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  resolvido: 'bg-green-500/20 text-green-400 border-green-500/30',
  encerrado: 'bg-muted text-muted-foreground border-border',
};

// Priority colors
export const PRIORITY_COLORS: Record<SupportTicketPriority, string> = {
  P0: 'bg-red-600/20 text-red-400 border-red-500/30',
  P1: 'bg-red-500/20 text-red-400 border-red-500/30',
  P2: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  P3: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

// Impact colors
export const IMPACT_COLORS: Record<SupportTicketImpact, string> = {
  critico: 'bg-red-600/20 text-red-400 border-red-500/30',
  alto: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medio: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  baixo: 'bg-green-500/20 text-green-400 border-green-500/30',
};

// Team colors
export const TEAM_COLORS: Record<SupportTeam, string> = {
  N1: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  N2: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  N3: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  INFRA: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  NOC: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
};

// ============================================================================
// ROLE CHECKS
// ============================================================================

export const SUPPORT_ROLE_ID = 900;
export const ADMIN_ROLE_ID = 1000;

export function canAccessSupportModule(level: number): boolean {
  return level >= SUPPORT_ROLE_ID;
}

export function canManageSLAs(level: number): boolean {
  return level >= ADMIN_ROLE_ID;
}

export function canViewReports(level: number): boolean {
  return level >= ADMIN_ROLE_ID;
}

export function canOverridePriority(level: number): boolean {
  return level >= ADMIN_ROLE_ID;
}
