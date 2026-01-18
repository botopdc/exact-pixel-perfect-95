// ============================================================================
// INTERNAL SUPPORT TICKETS - Tipos para Atendimento Interno
// Para usuários internos (level != 1)
// ============================================================================

// Tipos de chamado conforme especificação
export type InternalTicketType = 
  | 'suporte_tecnico'
  | 'infraestrutura'
  | 'sistemas_internos'
  | 'administrativo_rh'
  | 'customer_success'
  | 'financeiro'
  | 'comercial';

// Prioridade do chamado (define SLA)
export type InternalTicketPriority = 'baixa' | 'media' | 'alta' | 'critica';

// Status padrão conforme especificação
export type InternalTicketStatus = 
  | 'aberto'
  | 'em_atendimento'
  | 'aguardando_solicitante'
  | 'escalado_n2'
  | 'resolvido'
  | 'encerrado';

// Filas disponíveis
export type TicketQueue = 'N1' | 'N2' | 'CS' | 'INFRA' | 'FIN' | 'COM';

// SLA padrão por prioridade (em horas)
export const SLA_BY_PRIORITY: Record<InternalTicketPriority, number> = {
  baixa: 24,
  media: 12,
  alta: 8,
  critica: 4,
};

// SLA padrão por tipo de chamado (em horas) - backup
export const SLA_BY_TYPE: Record<InternalTicketType, number> = {
  suporte_tecnico: 8,
  infraestrutura: 4,
  sistemas_internos: 24,
  administrativo_rh: 48,
  customer_success: 12,
  financeiro: 24,
  comercial: 12,
};

// SLA multiplicador por prioridade
export const SLA_PRIORITY_MULTIPLIER: Record<InternalTicketPriority, number> = {
  baixa: 2,      // 2x o SLA padrão
  media: 1,      // SLA padrão
  alta: 0.5,     // Metade do SLA
  critica: 0.25, // 1/4 do SLA
};

// Fila padrão por tipo de chamado
export const DEFAULT_QUEUE_BY_TYPE: Record<InternalTicketType, TicketQueue> = {
  suporte_tecnico: 'N1',
  infraestrutura: 'INFRA',
  sistemas_internos: 'N1',
  administrativo_rh: 'N1',
  customer_success: 'CS',
  financeiro: 'FIN',
  comercial: 'COM',
};

// Calcula SLA final em horas
export function calculateSLA(type: InternalTicketType, priority: InternalTicketPriority): number {
  // Usar SLA por prioridade diretamente (mais simples e previsível)
  return SLA_BY_PRIORITY[priority];
}

// Retorna a fila padrão para um tipo
export function getDefaultQueue(type: InternalTicketType): TicketQueue {
  return DEFAULT_QUEUE_BY_TYPE[type] || 'N1';
}

export interface InternalTicketHistoryItem {
  id: string;
  date: string;
  author: string;
  authorId: number;
  type: 'comentario' | 'mudanca_status' | 'atribuicao' | 'escalacao' | 'transferencia';
  content: string;
  is_internal_note?: boolean;
  metadata?: {
    old_status?: InternalTicketStatus;
    new_status?: InternalTicketStatus;
    old_assignee?: string;
    new_assignee?: string;
    old_queue?: TicketQueue;
    new_queue?: TicketQueue;
    sla_paused?: boolean;
  };
}

export interface InternalTicket {
  id: string;
  code?: string; // INT-XXXX
  title: string;
  description: string;
  type: InternalTicketType;
  priority: InternalTicketPriority;
  status: InternalTicketStatus;
  
  // Criador
  created_by_id: number;
  created_by_name: string;
  created_by_email: string;
  created_by_level: number;
  
  // Responsável (quem está atendendo)
  assignee_id?: number;
  assignee_name?: string;
  assignee_email?: string;
  
  // Fila
  queue: TicketQueue;
  
  // SLA
  sla_hours: number;
  sla_deadline: string; // ISO date
  sla_breached: boolean;
  sla_paused: boolean; // Pausado quando aguardando solicitante
  sla_paused_at?: string;
  sla_accumulated_pause_ms: number; // Tempo total pausado
  
  // Timestamps
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  closed_at?: string;
  
  // Histórico
  history: InternalTicketHistoryItem[];
}

// Labels para exibição
export const TICKET_TYPE_LABELS: Record<InternalTicketType, string> = {
  suporte_tecnico: 'Suporte Técnico',
  infraestrutura: 'Infraestrutura',
  sistemas_internos: 'Sistemas Internos',
  administrativo_rh: 'Administrativo / RH',
  customer_success: 'Customer Success',
  financeiro: 'Financeiro',
  comercial: 'Comercial',
};

export const TICKET_PRIORITY_LABELS: Record<InternalTicketPriority, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
};

export const TICKET_STATUS_LABELS: Record<InternalTicketStatus, string> = {
  aberto: 'Aberto',
  em_atendimento: 'Em Atendimento',
  aguardando_solicitante: 'Aguardando Solicitante',
  escalado_n2: 'Escalado N2',
  resolvido: 'Resolvido',
  encerrado: 'Encerrado',
};

export const QUEUE_LABELS: Record<TicketQueue, string> = {
  N1: 'Suporte N1',
  N2: 'Suporte N2',
  CS: 'Customer Success',
  INFRA: 'Infraestrutura',
  FIN: 'Financeiro',
  COM: 'Comercial',
};

// Cores para status (usando tokens semânticos)
export const TICKET_STATUS_COLORS: Record<InternalTicketStatus, string> = {
  aberto: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  em_atendimento: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  aguardando_solicitante: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  escalado_n2: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  resolvido: 'bg-green-500/20 text-green-400 border-green-500/30',
  encerrado: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

// Cores para prioridade
export const TICKET_PRIORITY_COLORS: Record<InternalTicketPriority, string> = {
  baixa: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  media: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  alta: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  critica: 'bg-red-500/20 text-red-400 border-red-500/30',
};

// Cores para filas
export const QUEUE_COLORS: Record<TicketQueue, string> = {
  N1: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  N2: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  CS: 'bg-green-500/20 text-green-400 border-green-500/30',
  INFRA: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  FIN: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  COM: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
};

// Níveis que podem criar chamados de prioridade crítica
export const CRITICAL_PRIORITY_LEVELS = [750, 950, 1000];

// ============================================================================
// PERMISSÕES POR PAPEL
// ============================================================================

// Níveis de suporte (podem gerenciar chamados)
export const SUPPORT_LEVELS = [900, 950, 1000];

// Níveis de CS (CS e Gerente Comercial veem todos os chamados)
export const CS_LEVELS = [750, 775, 1000];

// Níveis de Admin (vê tudo)
export const ADMIN_LEVELS = [1000];

// Níveis que podem ver todos os chamados (não apenas os próprios)
export const VIEW_ALL_LEVELS = [750, 775, 900, 950, 1000];

// Permissões de filas por nível
export const QUEUE_PERMISSIONS: Record<number, TicketQueue[]> = {
  // Gerente Comercial e CS vêem todos (para visualização completa)
  750: ['N1', 'N2', 'CS', 'INFRA', 'FIN', 'COM'],
  775: ['N1', 'N2', 'CS', 'INFRA', 'FIN', 'COM'],
  // Suporte vê N1, N2, INFRA
  900: ['N1', 'N2', 'INFRA'],
  950: ['N1', 'N2', 'INFRA'],
  // Admin vê tudo
  1000: ['N1', 'N2', 'CS', 'INFRA', 'FIN', 'COM'],
};

// Verifica se usuário pode ver todos os chamados
export function canViewAllTickets(level: number): boolean {
  return level >= 750;
}

// Verifica se um nível é suporte
export function isSupport(level: number): boolean {
  return SUPPORT_LEVELS.includes(level);
}

// Verifica se um nível é CS
export function isCS(level: number): boolean {
  return CS_LEVELS.includes(level);
}

// Verifica se um nível é admin
export function isAdmin(level: number): boolean {
  return ADMIN_LEVELS.includes(level);
}

// Retorna as filas permitidas para um nível
export function getAllowedQueues(level: number): TicketQueue[] {
  return QUEUE_PERMISSIONS[level] || [];
}

// Verifica se usuário pode ver uma fila específica
export function canAccessQueue(level: number, queue: TicketQueue): boolean {
  const allowed = getAllowedQueues(level);
  return allowed.includes(queue);
}

// Verifica se usuário pode gerenciar chamados (atribuir, transferir, etc)
export function canManageTickets(level: number): boolean {
  return isSupport(level) || isCS(level) || isAdmin(level);
}

// ============================================================================
// SUGESTÕES POR ÁREA DO USUÁRIO
// ============================================================================

export const AREA_SUGGESTIONS: Record<string, { type: InternalTicketType; hint: string }[]> = {
  comercial: [
    { type: 'sistemas_internos', hint: 'Problema no CRM' },
    { type: 'suporte_tecnico', hint: 'Erro em relatório' },
  ],
  cs: [
    { type: 'customer_success', hint: 'Suporte a cliente' },
    { type: 'sistemas_internos', hint: 'Acesso a sistema' },
  ],
  suporte: [
    { type: 'infraestrutura', hint: 'Problema com servidor' },
    { type: 'sistemas_internos', hint: 'Acesso a ferramenta' },
  ],
  financeiro: [
    { type: 'financeiro', hint: 'Solicitação financeira' },
    { type: 'sistemas_internos', hint: 'Problema em sistema financeiro' },
  ],
  lideranca: [
    { type: 'sistemas_internos', hint: 'Dashboard/Relatório' },
    { type: 'administrativo_rh', hint: 'Solicitação estratégica' },
  ],
};
