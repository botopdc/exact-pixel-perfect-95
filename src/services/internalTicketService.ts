// ============================================================================
// INTERNAL TICKET SERVICE - Serviço de Chamados Internos
// Persistência em localStorage
// ============================================================================

import {
  InternalTicket,
  InternalTicketType,
  InternalTicketPriority,
  InternalTicketStatus,
  InternalTicketHistoryItem,
  calculateSLA,
} from '@/types/internalTicket';

const STORAGE_KEY = 'open_internal_tickets_v2';

// ============================================================================
// HELPERS
// ============================================================================

function generateId(): string {
  return `INT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
}

function loadTickets(): InternalTicket[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveTickets(tickets: InternalTicket[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
}

function calculateSLADeadline(slaHours: number): string {
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + slaHours);
  return deadline.toISOString();
}

function checkSLABreached(ticket: InternalTicket): boolean {
  // Se resolvido ou encerrado, verificar se foi dentro do prazo
  if (ticket.status === 'resolvido' || ticket.status === 'encerrado') {
    const resolvedAt = ticket.resolved_at || ticket.closed_at;
    if (resolvedAt) {
      // Considerar tempo pausado
      const effectiveDeadline = new Date(
        new Date(ticket.sla_deadline).getTime() + ticket.sla_accumulated_pause_ms
      );
      return new Date(resolvedAt) > effectiveDeadline;
    }
    return false;
  }
  
  // Se pausado, não está em breach
  if (ticket.sla_paused) {
    return false;
  }
  
  // Calcular deadline efetivo com tempo pausado
  const effectiveDeadline = new Date(
    new Date(ticket.sla_deadline).getTime() + ticket.sla_accumulated_pause_ms
  );
  return new Date() > effectiveDeadline;
}

function getEffectiveDeadline(ticket: InternalTicket): Date {
  const baseDeadline = new Date(ticket.sla_deadline);
  return new Date(baseDeadline.getTime() + ticket.sla_accumulated_pause_ms);
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

export interface CreateTicketParams {
  title: string;
  description: string;
  type: InternalTicketType;
  priority: InternalTicketPriority;
  created_by_id: number;
  created_by_name: string;
  created_by_email: string;
  created_by_level: number;
}

export function createInternalTicket(params: CreateTicketParams): InternalTicket {
  const now = new Date().toISOString();
  const slaHours = calculateSLA(params.type, params.priority);
  const slaDeadline = calculateSLADeadline(slaHours);

  const ticket: InternalTicket = {
    id: generateId(),
    title: params.title,
    description: params.description,
    type: params.type,
    priority: params.priority,
    status: 'aberto',
    created_by_id: params.created_by_id,
    created_by_name: params.created_by_name,
    created_by_email: params.created_by_email,
    created_by_level: params.created_by_level,
    queue: 'N1', // Sempre inicia na fila N1
    sla_hours: slaHours,
    sla_deadline: slaDeadline,
    sla_breached: false,
    sla_paused: false,
    sla_accumulated_pause_ms: 0,
    created_at: now,
    updated_at: now,
    history: [
      {
        id: crypto.randomUUID(),
        date: now,
        author: params.created_by_name,
        authorId: params.created_by_id,
        type: 'mudanca_status',
        content: `Chamado criado e atribuído à fila N1 (Suporte). SLA: ${slaHours}h`,
        metadata: { new_status: 'aberto' },
      },
    ],
  };

  const tickets = loadTickets();
  tickets.unshift(ticket);
  saveTickets(tickets);

  return ticket;
}

export function listInternalTickets(): InternalTicket[] {
  const tickets = loadTickets();
  return tickets.map((t) => ({
    ...t,
    sla_breached: checkSLABreached(t),
  }));
}

export function listTicketsByUser(userId: number): InternalTicket[] {
  return listInternalTickets().filter((t) => t.created_by_id === userId);
}

export function listTicketsByQueue(queue: 'N1' | 'N2'): InternalTicket[] {
  return listInternalTickets().filter((t) => t.queue === queue);
}

export function listOpenTickets(): InternalTicket[] {
  return listInternalTickets().filter(
    (t) => t.status !== 'resolvido' && t.status !== 'encerrado'
  );
}

export function getTicketById(id: string): InternalTicket | undefined {
  const tickets = listInternalTickets();
  return tickets.find((t) => t.id === id);
}

export function updateTicketStatus(
  id: string,
  newStatus: InternalTicketStatus,
  authorName: string,
  authorId: number
): InternalTicket | undefined {
  const tickets = loadTickets();
  const index = tickets.findIndex((t) => t.id === id);

  if (index === -1) return undefined;

  const ticket = tickets[index];
  const now = new Date().toISOString();
  const oldStatus = ticket.status;

  // Gerenciar pausa de SLA
  let slaPaused = ticket.sla_paused;
  let slaPausedAt = ticket.sla_paused_at;
  let accumulatedPause = ticket.sla_accumulated_pause_ms;

  // Se mudando para "aguardando_solicitante", pausar SLA
  if (newStatus === 'aguardando_solicitante' && !ticket.sla_paused) {
    slaPaused = true;
    slaPausedAt = now;
  }
  
  // Se saindo de "aguardando_solicitante", retomar SLA
  if (oldStatus === 'aguardando_solicitante' && newStatus !== 'aguardando_solicitante' && ticket.sla_paused) {
    slaPaused = false;
    if (ticket.sla_paused_at) {
      accumulatedPause += new Date().getTime() - new Date(ticket.sla_paused_at).getTime();
    }
    slaPausedAt = undefined;
  }

  const historyItem: InternalTicketHistoryItem = {
    id: crypto.randomUUID(),
    date: now,
    author: authorName,
    authorId,
    type: 'mudanca_status',
    content: `Status alterado de "${oldStatus}" para "${newStatus}"`,
    metadata: {
      old_status: oldStatus,
      new_status: newStatus,
      sla_paused: slaPaused,
    },
  };

  const updatedTicket = {
    ...ticket,
    status: newStatus,
    updated_at: now,
    resolved_at: newStatus === 'resolvido' ? now : ticket.resolved_at,
    closed_at: newStatus === 'encerrado' ? now : ticket.closed_at,
    sla_paused: slaPaused,
    sla_paused_at: slaPausedAt,
    sla_accumulated_pause_ms: accumulatedPause,
    history: [...ticket.history, historyItem],
  };

  updatedTicket.sla_breached = checkSLABreached(updatedTicket);
  tickets[index] = updatedTicket;
  saveTickets(tickets);
  
  return updatedTicket;
}

export function assignTicket(
  id: string,
  assigneeId: number,
  assigneeName: string,
  authorName: string,
  authorId: number
): InternalTicket | undefined {
  const tickets = loadTickets();
  const index = tickets.findIndex((t) => t.id === id);

  if (index === -1) return undefined;

  const ticket = tickets[index];
  const now = new Date().toISOString();

  const historyItem: InternalTicketHistoryItem = {
    id: crypto.randomUUID(),
    date: now,
    author: authorName,
    authorId,
    type: 'atribuicao',
    content: `Chamado atribuído para ${assigneeName}`,
    metadata: {
      old_assignee: ticket.assignee_name,
      new_assignee: assigneeName,
    },
  };

  // Se está atribuindo e o status é "aberto", passar para "em_atendimento"
  const newStatus = ticket.status === 'aberto' ? 'em_atendimento' : ticket.status;

  const statusHistoryItem: InternalTicketHistoryItem | null = 
    ticket.status === 'aberto' 
      ? {
          id: crypto.randomUUID(),
          date: now,
          author: authorName,
          authorId,
          type: 'mudanca_status',
          content: 'Status alterado automaticamente para "Em Atendimento"',
          metadata: { old_status: 'aberto', new_status: 'em_atendimento' },
        }
      : null;

  tickets[index] = {
    ...ticket,
    assignee_id: assigneeId,
    assignee_name: assigneeName,
    status: newStatus,
    updated_at: now,
    history: statusHistoryItem 
      ? [...ticket.history, historyItem, statusHistoryItem]
      : [...ticket.history, historyItem],
  };

  saveTickets(tickets);
  return tickets[index];
}

export function escalateToN2(
  id: string,
  authorName: string,
  authorId: number
): InternalTicket | undefined {
  const tickets = loadTickets();
  const index = tickets.findIndex((t) => t.id === id);

  if (index === -1) return undefined;

  const ticket = tickets[index];
  const now = new Date().toISOString();

  const historyItem: InternalTicketHistoryItem = {
    id: crypto.randomUUID(),
    date: now,
    author: authorName,
    authorId,
    type: 'escalacao',
    content: 'Chamado escalado para N2',
  };

  tickets[index] = {
    ...ticket,
    queue: 'N2',
    status: 'escalado_n2',
    assignee_id: undefined,
    assignee_name: undefined,
    updated_at: now,
    history: [...ticket.history, historyItem],
  };

  saveTickets(tickets);
  return tickets[index];
}

export function addComment(
  id: string,
  content: string,
  authorName: string,
  authorId: number
): InternalTicket | undefined {
  const tickets = loadTickets();
  const index = tickets.findIndex((t) => t.id === id);

  if (index === -1) return undefined;

  const ticket = tickets[index];
  const now = new Date().toISOString();

  const historyItem: InternalTicketHistoryItem = {
    id: crypto.randomUUID(),
    date: now,
    author: authorName,
    authorId,
    type: 'comentario',
    content,
  };

  tickets[index] = {
    ...ticket,
    updated_at: now,
    history: [...ticket.history, historyItem],
  };

  saveTickets(tickets);
  return tickets[index];
}

// ============================================================================
// STATISTICS
// ============================================================================

export interface InternalTicketStats {
  abertos: number;
  em_andamento: number;
  aguardando: number;
  escalados: number;
  resolvidos_30d: number;
  dentro_sla: number;
  fora_sla: number;
}

export function getTicketStats(userId?: number): InternalTicketStats {
  let tickets = listInternalTickets();
  
  if (userId !== undefined) {
    tickets = tickets.filter((t) => t.created_by_id === userId);
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const abertos = tickets.filter((t) => t.status === 'aberto').length;
  const em_andamento = tickets.filter((t) => t.status === 'em_atendimento').length;
  const aguardando = tickets.filter((t) => t.status === 'aguardando_solicitante').length;
  const escalados = tickets.filter((t) => t.status === 'escalado_n2').length;
  
  const resolvidos_30d = tickets.filter(
    (t) =>
      (t.status === 'resolvido' || t.status === 'encerrado') &&
      t.resolved_at &&
      new Date(t.resolved_at) >= thirtyDaysAgo
  ).length;

  const activeTickets = tickets.filter(
    (t) => t.status !== 'encerrado' && t.status !== 'resolvido'
  );
  const dentro_sla = activeTickets.filter((t) => !t.sla_breached).length;
  const fora_sla = activeTickets.filter((t) => t.sla_breached).length;

  return {
    abertos,
    em_andamento,
    aguardando,
    escalados,
    resolvidos_30d,
    dentro_sla,
    fora_sla,
  };
}

// ============================================================================
// SEED DATA
// ============================================================================

export function seedInternalTickets(): void {
  const existingTickets = loadTickets();
  if (existingTickets.length > 0) return;

  const sampleTickets: CreateTicketParams[] = [
    {
      title: 'Erro ao acessar relatório de vendas',
      description: 'Ao tentar exportar o relatório mensal de vendas, o sistema retorna erro 500.',
      type: 'sistemas_internos',
      priority: 'alta',
      created_by_id: 700,
      created_by_name: 'Carlos Executivo',
      created_by_email: 'carlos@open.com.br',
      created_by_level: 700,
    },
    {
      title: 'Solicitar acesso ao Grafana',
      description: 'Preciso de acesso de leitura ao Grafana para acompanhar métricas.',
      type: 'suporte_tecnico',
      priority: 'media',
      created_by_id: 775,
      created_by_name: 'Maria CS',
      created_by_email: 'maria@open.com.br',
      created_by_level: 775,
    },
    {
      title: 'Problema com VPN corporativa',
      description: 'A VPN está desconectando frequentemente durante o trabalho remoto.',
      type: 'infraestrutura',
      priority: 'alta',
      created_by_id: 750,
      created_by_name: 'João Gerente',
      created_by_email: 'joao@open.com.br',
      created_by_level: 750,
    },
  ];

  sampleTickets.forEach(createInternalTicket);
}

// ============================================================================
// EXPORTED SERVICE OBJECT
// ============================================================================

export const internalTicketService = {
  create: createInternalTicket,
  list: listInternalTickets,
  listByUser: listTicketsByUser,
  listByQueue: listTicketsByQueue,
  listOpen: listOpenTickets,
  getById: getTicketById,
  updateStatus: updateTicketStatus,
  assign: assignTicket,
  escalateToN2,
  addComment,
  getStats: getTicketStats,
  seed: seedInternalTickets,
};
