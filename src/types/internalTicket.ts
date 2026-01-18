// ============================================================================
// INTERNAL SUPPORT TICKETS - Tipos para Atendimento Interno
// Para usuários internos (level != 1)
// ============================================================================

// Tipos de chamado conforme especificação
export type InternalTicketType = 
  | 'suporte_tecnico'
  | 'infraestrutura'
  | 'sistemas_internos'
  | 'administrativo_rh';

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

// SLA padrão por tipo de chamado (em horas)
export const SLA_BY_TYPE: Record<InternalTicketType, number> = {
  suporte_tecnico: 8,
  infraestrutura: 4,
  sistemas_internos: 24,
  administrativo_rh: 48,
};

// SLA multiplicador por prioridade
export const SLA_PRIORITY_MULTIPLIER: Record<InternalTicketPriority, number> = {
  baixa: 2,      // 2x o SLA padrão
  media: 1,      // SLA padrão
  alta: 0.5,     // Metade do SLA
  critica: 0.25, // 1/4 do SLA
};

// Calcula SLA final em horas
export function calculateSLA(type: InternalTicketType, priority: InternalTicketPriority): number {
  const baseSLA = SLA_BY_TYPE[type];
  const multiplier = SLA_PRIORITY_MULTIPLIER[priority];
  return Math.max(1, Math.round(baseSLA * multiplier)); // Mínimo 1 hora
}

export interface InternalTicketHistoryItem {
  id: string;
  date: string;
  author: string;
  authorId: number;
  type: 'comentario' | 'mudanca_status' | 'atribuicao' | 'escalacao';
  content: string;
  metadata?: {
    old_status?: InternalTicketStatus;
    new_status?: InternalTicketStatus;
    old_assignee?: string;
    new_assignee?: string;
    sla_paused?: boolean;
  };
}

export interface InternalTicket {
  id: string;
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
  
  // Fila inicial (N1 = Suporte ID 900)
  queue: 'N1' | 'N2';
  
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

// Níveis que podem criar chamados de prioridade crítica
export const CRITICAL_PRIORITY_LEVELS = [750, 950, 1000];

// Níveis de suporte (podem gerenciar chamados)
export const SUPPORT_LEVELS = [900, 950, 1000];

// Sugestões por área do usuário
export const AREA_SUGGESTIONS: Record<string, { type: InternalTicketType; hint: string }[]> = {
  comercial: [
    { type: 'sistemas_internos', hint: 'Problema no CRM' },
    { type: 'suporte_tecnico', hint: 'Erro em relatório' },
  ],
  cs: [
    { type: 'suporte_tecnico', hint: 'Problema técnico de cliente' },
    { type: 'sistemas_internos', hint: 'Acesso a sistema' },
  ],
  suporte: [
    { type: 'infraestrutura', hint: 'Problema com servidor' },
    { type: 'sistemas_internos', hint: 'Acesso a ferramenta' },
  ],
  financeiro: [
    { type: 'administrativo_rh', hint: 'Solicitação financeira' },
    { type: 'sistemas_internos', hint: 'Problema em sistema financeiro' },
  ],
  lideranca: [
    { type: 'sistemas_internos', hint: 'Dashboard/Relatório' },
    { type: 'administrativo_rh', hint: 'Solicitação estratégica' },
  ],
};
