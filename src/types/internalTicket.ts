// ============================================================================
// INTERNAL SUPPORT TICKETS - Tipos para Atendimento Interno
// Para usuários internos (level != 1)
// ============================================================================

export type InternalTicketType = 
  | 'suporte_tecnico'
  | 'infraestrutura'
  | 'dados_relatorios'
  | 'financeiro_admin'
  | 'acesso_permissao'
  | 'outro';

export type InternalTicketPriority = 'baixa' | 'media' | 'alta' | 'critica';

export type InternalTicketStatus = 
  | 'aberto'
  | 'em_andamento'
  | 'aguardando_resposta'
  | 'resolvido'
  | 'encerrado';

// SLA em horas por prioridade
export const SLA_HOURS: Record<InternalTicketPriority, number> = {
  baixa: 48,
  media: 24,
  alta: 8,
  critica: 2,
};

export interface InternalTicketHistoryItem {
  id: string;
  date: string;
  author: string;
  authorId: number;
  type: 'comentario' | 'mudanca_status' | 'atribuicao';
  content: string;
  metadata?: {
    old_status?: InternalTicketStatus;
    new_status?: InternalTicketStatus;
    old_assignee?: string;
    new_assignee?: string;
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
  
  // SLA
  sla_hours: number;
  sla_deadline: string; // ISO date
  sla_breached: boolean;
  
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
  dados_relatorios: 'Dados/Relatórios',
  financeiro_admin: 'Financeiro/Admin',
  acesso_permissao: 'Acesso/Permissão',
  outro: 'Outro',
};

export const TICKET_PRIORITY_LABELS: Record<InternalTicketPriority, string> = {
  baixa: 'Baixa (48h)',
  media: 'Média (24h)',
  alta: 'Alta (8h)',
  critica: 'Crítica (2h)',
};

export const TICKET_STATUS_LABELS: Record<InternalTicketStatus, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em Andamento',
  aguardando_resposta: 'Aguardando Resposta',
  resolvido: 'Resolvido',
  encerrado: 'Encerrado',
};

// Cores para status
export const TICKET_STATUS_COLORS: Record<InternalTicketStatus, string> = {
  aberto: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  em_andamento: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  aguardando_resposta: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
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

// Sugestões por área do usuário
export const AREA_SUGGESTIONS: Record<string, { type: InternalTicketType; hint: string }[]> = {
  comercial: [
    { type: 'dados_relatorios', hint: 'Relatório de vendas/pipeline' },
    { type: 'acesso_permissao', hint: 'Acesso ao CRM ou ferramenta' },
  ],
  cs: [
    { type: 'suporte_tecnico', hint: 'Problema técnico de cliente' },
    { type: 'dados_relatorios', hint: 'Relatório de health score' },
  ],
  suporte: [
    { type: 'infraestrutura', hint: 'Problema com servidor/ambiente' },
    { type: 'acesso_permissao', hint: 'Acesso a sistema interno' },
  ],
  financeiro: [
    { type: 'dados_relatorios', hint: 'Relatório financeiro' },
    { type: 'suporte_tecnico', hint: 'Problema com sistema financeiro' },
  ],
  lideranca: [
    { type: 'dados_relatorios', hint: 'Dashboard executivo' },
    { type: 'outro', hint: 'Solicitação estratégica' },
  ],
};

// Níveis que podem criar chamados de prioridade crítica
export const CRITICAL_PRIORITY_LEVELS = [750, 950, 1000];
