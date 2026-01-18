// ============================================================================
// INTERNAL TICKET SERVICE - Serviço de Chamados Internos
// Persistência em localStorage
// TODO: Substituir por chamadas à OPEN API quando backend entregar endpoints
// ============================================================================

import {
  InternalTicket,
  InternalTicketType,
  InternalTicketPriority,
  InternalTicketStatus,
  InternalTicketHistoryItem,
  TicketQueue,
  calculateSLA,
  getDefaultQueue,
  getAllowedQueues,
  isAdmin,
} from '@/types/internalTicket';

const STORAGE_KEY = 'open_internal_tickets_v3';

// ============================================================================
// HELPERS
// ============================================================================

function generateId(): string {
  return `INT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
}

function generateCode(): string {
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `INT-${num}`;
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
  const queue = getDefaultQueue(params.type);

  const ticket: InternalTicket = {
    id: generateId(),
    code: generateCode(),
    title: params.title,
    description: params.description,
    type: params.type,
    priority: params.priority,
    status: 'aberto',
    created_by_id: params.created_by_id,
    created_by_name: params.created_by_name,
    created_by_email: params.created_by_email,
    created_by_level: params.created_by_level,
    queue,
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
        content: `Chamado criado e atribuído à fila ${queue}. SLA: ${slaHours}h`,
        metadata: { new_status: 'aberto', new_queue: queue },
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

// Lista apenas chamados do usuário (Meus Chamados)
export function listMyTickets(userId: number): InternalTicket[] {
  return listInternalTickets().filter((t) => t.created_by_id === userId);
}

// Lista chamados por fila (para suporte/CS)
export function listTicketsByQueue(queue: TicketQueue): InternalTicket[] {
  return listInternalTickets().filter((t) => t.queue === queue);
}

// Lista chamados visíveis para um usuário baseado no nível
export function listVisibleTickets(userId: number, userLevel: number): InternalTicket[] {
  const allTickets = listInternalTickets();
  
  // Admin vê tudo
  if (isAdmin(userLevel)) {
    return allTickets;
  }
  
  // Para suporte/CS, ver chamados das filas permitidas OU atribuídos a si
  const allowedQueues = getAllowedQueues(userLevel);
  
  if (allowedQueues.length > 0) {
    return allTickets.filter((t) => 
      allowedQueues.includes(t.queue) || 
      t.assignee_id === userId
    );
  }
  
  // Usuários comuns veem apenas seus próprios chamados
  return allTickets.filter((t) => t.created_by_id === userId);
}

// Lista chamados por filas específicas (para tela de fila de suporte/CS)
export function listTicketsByQueues(queues: TicketQueue[]): InternalTicket[] {
  return listInternalTickets().filter((t) => queues.includes(t.queue));
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

// Verifica se usuário pode ver um chamado específico
export function canViewTicket(ticket: InternalTicket, userId: number, userLevel: number): boolean {
  // Admin pode ver tudo
  if (isAdmin(userLevel)) return true;
  
  // Criador pode ver
  if (ticket.created_by_id === userId) return true;
  
  // Atribuído pode ver
  if (ticket.assignee_id === userId) return true;
  
  // Usuário com permissão na fila pode ver
  const allowedQueues = getAllowedQueues(userLevel);
  return allowedQueues.includes(ticket.queue);
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
  assigneeEmail: string,
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
    assignee_email: assigneeEmail,
    status: newStatus,
    updated_at: now,
    history: statusHistoryItem 
      ? [...ticket.history, historyItem, statusHistoryItem]
      : [...ticket.history, historyItem],
  };

  saveTickets(tickets);
  return tickets[index];
}

export function transferQueue(
  id: string,
  newQueue: TicketQueue,
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
    type: 'transferencia',
    content: `Chamado transferido para fila ${newQueue}`,
    metadata: {
      old_queue: ticket.queue,
      new_queue: newQueue,
    },
  };

  // Se transferir para outra fila, remover atribuição (o responsável pode não ter acesso)
  tickets[index] = {
    ...ticket,
    queue: newQueue,
    assignee_id: undefined,
    assignee_name: undefined,
    assignee_email: undefined,
    updated_at: now,
    history: [...ticket.history, historyItem],
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
    metadata: {
      old_queue: ticket.queue,
      new_queue: 'N2',
    },
  };

  tickets[index] = {
    ...ticket,
    queue: 'N2',
    status: 'escalado_n2',
    assignee_id: undefined,
    assignee_name: undefined,
    assignee_email: undefined,
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
  authorId: number,
  isInternalNote: boolean = false
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
    is_internal_note: isInternalNote,
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
  nao_atribuidos: number;
}

export function getTicketStats(userId?: number, queues?: TicketQueue[]): InternalTicketStats {
  let tickets = listInternalTickets();
  
  // Filtrar por usuário (Meus Chamados)
  if (userId !== undefined && !queues) {
    tickets = tickets.filter((t) => t.created_by_id === userId);
  }
  
  // Filtrar por filas (Fila de Suporte/CS)
  if (queues && queues.length > 0) {
    tickets = tickets.filter((t) => queues.includes(t.queue));
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const abertos = tickets.filter((t) => t.status === 'aberto').length;
  const em_andamento = tickets.filter((t) => t.status === 'em_atendimento').length;
  const aguardando = tickets.filter((t) => t.status === 'aguardando_solicitante').length;
  const escalados = tickets.filter((t) => t.status === 'escalado_n2').length;
  const nao_atribuidos = tickets.filter((t) => 
    (t.status === 'aberto' || t.status === 'escalado_n2') && !t.assignee_id
  ).length;
  
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
    nao_atribuidos,
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
    {
      title: 'Dúvida sobre comissionamento',
      description: 'Preciso entender como funciona o cálculo de comissão para novas vendas.',
      type: 'comercial',
      priority: 'baixa',
      created_by_id: 700,
      created_by_name: 'Ana Comercial',
      created_by_email: 'ana@open.com.br',
      created_by_level: 700,
    },
    {
      title: 'Cliente reclamando de instabilidade',
      description: 'O cliente XYZ está reportando lentidão no acesso ao portal.',
      type: 'customer_success',
      priority: 'alta',
      created_by_id: 775,
      created_by_name: 'Pedro CS',
      created_by_email: 'pedro@open.com.br',
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
  listMy: listMyTickets,
  listByQueue: listTicketsByQueue,
  listByQueues: listTicketsByQueues,
  listVisible: listVisibleTickets,
  listOpen: listOpenTickets,
  getById: getTicketById,
  canView: canViewTicket,
  updateStatus: updateTicketStatus,
  assign: assignTicket,
  transferQueue,
  escalateToN2,
  addComment,
  getStats: getTicketStats,
  seed: seedInternalTickets,
};
