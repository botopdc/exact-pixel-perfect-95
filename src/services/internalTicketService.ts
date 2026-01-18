// ============================================================================
// INTERNAL TICKET SERVICE - Serviço de Chamados Internos
// Persistência em localStorage (como o sistema de tickets existente)
// ============================================================================

import {
  InternalTicket,
  InternalTicketType,
  InternalTicketPriority,
  InternalTicketStatus,
  InternalTicketHistoryItem,
  SLA_HOURS,
} from '@/types/internalTicket';

const STORAGE_KEY = 'open_internal_tickets_v1';

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

function calculateSLADeadline(priority: InternalTicketPriority): string {
  const hours = SLA_HOURS[priority];
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + hours);
  return deadline.toISOString();
}

function checkSLABreached(ticket: InternalTicket): boolean {
  if (ticket.status === 'resolvido' || ticket.status === 'encerrado') {
    // Se resolvido, verificar se foi resolvido antes do deadline
    const resolvedAt = ticket.resolved_at || ticket.closed_at;
    if (resolvedAt) {
      return new Date(resolvedAt) > new Date(ticket.sla_deadline);
    }
    return false;
  }
  // Se ainda aberto, verificar se passou do deadline
  return new Date() > new Date(ticket.sla_deadline);
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
  const slaHours = SLA_HOURS[params.priority];
  const slaDeadline = calculateSLADeadline(params.priority);

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
    sla_hours: slaHours,
    sla_deadline: slaDeadline,
    sla_breached: false,
    created_at: now,
    updated_at: now,
    history: [
      {
        id: crypto.randomUUID(),
        date: now,
        author: params.created_by_name,
        authorId: params.created_by_id,
        type: 'mudanca_status',
        content: 'Chamado criado',
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
  // Atualizar SLA breached status
  return tickets.map((t) => ({
    ...t,
    sla_breached: checkSLABreached(t),
  }));
}

export function listTicketsByUser(userId: number): InternalTicket[] {
  return listInternalTickets().filter((t) => t.created_by_id === userId);
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

  const historyItem: InternalTicketHistoryItem = {
    id: crypto.randomUUID(),
    date: now,
    author: authorName,
    authorId,
    type: 'mudanca_status',
    content: `Status alterado para ${newStatus}`,
    metadata: {
      old_status: ticket.status,
      new_status: newStatus,
    },
  };

  tickets[index] = {
    ...ticket,
    status: newStatus,
    updated_at: now,
    resolved_at: newStatus === 'resolvido' ? now : ticket.resolved_at,
    closed_at: newStatus === 'encerrado' ? now : ticket.closed_at,
    history: [...ticket.history, historyItem],
    sla_breached: checkSLABreached({
      ...ticket,
      status: newStatus,
      resolved_at: newStatus === 'resolvido' ? now : ticket.resolved_at,
    }),
  };

  saveTickets(tickets);
  return tickets[index];
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

  // Se está atribuindo e o status é "aberto", passar para "em_andamento"
  const newStatus = ticket.status === 'aberto' ? 'em_andamento' : ticket.status;

  tickets[index] = {
    ...ticket,
    assignee_id: assigneeId,
    assignee_name: assigneeName,
    status: newStatus,
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
  resolvidos_30d: number;
  dentro_sla: number;
  fora_sla: number;
}

export function getTicketStats(userId?: number): InternalTicketStats {
  let tickets = listInternalTickets();
  
  // Se userId fornecido, filtrar apenas tickets do usuário
  if (userId !== undefined) {
    tickets = tickets.filter((t) => t.created_by_id === userId);
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const abertos = tickets.filter((t) => t.status === 'aberto').length;
  const em_andamento = tickets.filter(
    (t) => t.status === 'em_andamento' || t.status === 'aguardando_resposta'
  ).length;
  const resolvidos_30d = tickets.filter(
    (t) =>
      (t.status === 'resolvido' || t.status === 'encerrado') &&
      t.resolved_at &&
      new Date(t.resolved_at) >= thirtyDaysAgo
  ).length;

  const activeTickets = tickets.filter(
    (t) => t.status !== 'encerrado'
  );
  const dentro_sla = activeTickets.filter((t) => !t.sla_breached).length;
  const fora_sla = activeTickets.filter((t) => t.sla_breached).length;

  return {
    abertos,
    em_andamento,
    resolvidos_30d,
    dentro_sla,
    fora_sla,
  };
}

// ============================================================================
// SEED DATA (para desenvolvimento)
// ============================================================================

export function seedInternalTickets(): void {
  const existingTickets = loadTickets();
  if (existingTickets.length > 0) return;

  const sampleTickets: CreateTicketParams[] = [
    {
      title: 'Erro ao acessar relatório de vendas',
      description: 'Ao tentar exportar o relatório mensal de vendas, o sistema retorna erro 500.',
      type: 'dados_relatorios',
      priority: 'alta',
      created_by_id: 700,
      created_by_name: 'Carlos Executivo',
      created_by_email: 'carlos@open.com.br',
      created_by_level: 700,
    },
    {
      title: 'Solicitar acesso ao Grafana',
      description: 'Preciso de acesso de leitura ao Grafana para acompanhar métricas de infraestrutura.',
      type: 'acesso_permissao',
      priority: 'media',
      created_by_id: 900,
      created_by_name: 'Ana Suporte',
      created_by_email: 'ana@open.com.br',
      created_by_level: 900,
    },
    {
      title: 'Problema com VPN corporativa',
      description: 'A VPN está desconectando frequentemente durante o trabalho remoto.',
      type: 'infraestrutura',
      priority: 'alta',
      created_by_id: 775,
      created_by_name: 'Maria CS',
      created_by_email: 'maria@open.com.br',
      created_by_level: 775,
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
  getById: getTicketById,
  updateStatus: updateTicketStatus,
  assign: assignTicket,
  addComment,
  getStats: getTicketStats,
  seed: seedInternalTickets,
};
