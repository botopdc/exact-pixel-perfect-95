import { 
  Ticket, 
  TicketStatus, 
  TicketTimeAtual, 
  TicketHistoricoItem,
  TicketTransicaoCS,
  CATEGORIA_PESO,
  TicketCategoria,
  TicketPrioridade
} from '@/types/ticket';

const STORAGE_KEY = 'open_tickets_v1';

// Generate unique ID
const generateId = (): string => {
  return `TKT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
};

// Load tickets from localStorage
const loadTickets = (): Ticket[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

// Save tickets to localStorage
const saveTickets = (tickets: Ticket[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
};

// Calculate priority based on category and other factors
const calcularPrioridade = (categoria: TicketCategoria): TicketPrioridade => {
  const peso = CATEGORIA_PESO[categoria];
  if (peso >= 3) return 'alta';
  if (peso >= 2) return 'media';
  return 'baixa';
};

// Create a new ticket
export const criarTicket = (
  dados: Omit<Ticket, 'id' | 'status' | 'time_atual' | 'tipo_demanda' | 'historico' | 'criado_em' | 'ultima_interacao' | 'prioridade'>
): Ticket => {
  const agora = new Date().toISOString();
  const prioridadeCalculada = calcularPrioridade(dados.categoria);
  
  const novoTicket: Ticket = {
    ...dados,
    id: generateId(),
    status: 'novo',
    time_atual: 'suporte',
    tipo_demanda: 'tecnico',
    prioridade: prioridadeCalculada,
    historico: [
      {
        id: crypto.randomUUID(),
        data: agora,
        autor: 'Sistema',
        tipo: 'mudanca_status',
        conteudo: 'Ticket criado',
        metadados: { status_novo: 'novo' }
      }
    ],
    criado_em: agora,
    ultima_interacao: agora,
  };

  const tickets = loadTickets();
  tickets.unshift(novoTicket);
  saveTickets(tickets);

  return novoTicket;
};

// Get all tickets
export const listarTickets = (): Ticket[] => {
  return loadTickets();
};

// Get ticket by ID
export const buscarTicket = (id: string): Ticket | undefined => {
  const tickets = loadTickets();
  return tickets.find(t => t.id === id);
};

// Update ticket status
export const atualizarStatus = (
  id: string, 
  novoStatus: TicketStatus, 
  autor: string
): Ticket | undefined => {
  const tickets = loadTickets();
  const index = tickets.findIndex(t => t.id === id);
  
  if (index === -1) return undefined;

  const ticket = tickets[index];
  const agora = new Date().toISOString();

  const historicoItem: TicketHistoricoItem = {
    id: crypto.randomUUID(),
    data: agora,
    autor,
    tipo: 'mudanca_status',
    conteudo: `Status alterado`,
    metadados: {
      status_anterior: ticket.status,
      status_novo: novoStatus
    }
  };

  tickets[index] = {
    ...ticket,
    status: novoStatus,
    historico: [...ticket.historico, historicoItem],
    ultima_interacao: agora
  };

  saveTickets(tickets);
  return tickets[index];
};

// Add comment to ticket
export const adicionarComentario = (
  id: string,
  conteudo: string,
  autor: string
): Ticket | undefined => {
  const tickets = loadTickets();
  const index = tickets.findIndex(t => t.id === id);
  
  if (index === -1) return undefined;

  const agora = new Date().toISOString();
  const ticket = tickets[index];

  const historicoItem: TicketHistoricoItem = {
    id: crypto.randomUUID(),
    data: agora,
    autor,
    tipo: 'comentario',
    conteudo
  };

  tickets[index] = {
    ...ticket,
    historico: [...ticket.historico, historicoItem],
    ultima_interacao: agora
  };

  saveTickets(tickets);
  return tickets[index];
};

// Transition ticket from Suporte to CS
export const encaminharParaCS = (
  id: string,
  transicao: Omit<TicketTransicaoCS, 'data_transicao'>,
  autor: string
): Ticket | undefined => {
  const tickets = loadTickets();
  const index = tickets.findIndex(t => t.id === id);
  
  if (index === -1) return undefined;

  const ticket = tickets[index];
  const agora = new Date().toISOString();

  const historicoItem: TicketHistoricoItem = {
    id: crypto.randomUUID(),
    data: agora,
    autor,
    tipo: 'transicao_time',
    conteudo: `Encaminhado para Customer Success. Impacto: ${transicao.impacto}`,
    metadados: {
      status_anterior: ticket.status,
      status_novo: 'resolvido_tecnico',
      time_anterior: 'suporte',
      time_novo: 'cs'
    }
  };

  tickets[index] = {
    ...ticket,
    status: 'resolvido_tecnico',
    time_atual: 'cs',
    transicao_cs: {
      ...transicao,
      data_transicao: agora,
      autor
    },
    historico: [...ticket.historico, historicoItem],
    ultima_interacao: agora
  };

  saveTickets(tickets);
  return tickets[index];
};

// Update tipo_demanda (CS only)
export const atualizarTipoDemanda = (
  id: string,
  tipo_demanda: Ticket['tipo_demanda'],
  autor: string
): Ticket | undefined => {
  const tickets = loadTickets();
  const index = tickets.findIndex(t => t.id === id);
  
  if (index === -1) return undefined;

  const ticket = tickets[index];
  const agora = new Date().toISOString();

  const historicoItem: TicketHistoricoItem = {
    id: crypto.randomUUID(),
    data: agora,
    autor,
    tipo: 'comentario',
    conteudo: `Tipo de demanda alterado para: ${tipo_demanda}`
  };

  tickets[index] = {
    ...ticket,
    tipo_demanda,
    historico: [...ticket.historico, historicoItem],
    ultima_interacao: agora
  };

  saveTickets(tickets);
  return tickets[index];
};

// Encerrar ticket (CS only)
export const encerrarTicket = (
  id: string,
  autor: string
): Ticket | undefined => {
  const tickets = loadTickets();
  const index = tickets.findIndex(t => t.id === id);
  
  if (index === -1) return undefined;

  const ticket = tickets[index];
  const agora = new Date().toISOString();

  const historicoItem: TicketHistoricoItem = {
    id: crypto.randomUUID(),
    data: agora,
    autor,
    tipo: 'mudanca_status',
    conteudo: 'Ticket encerrado pelo CS',
    metadados: {
      status_anterior: ticket.status,
      status_novo: 'encerrado'
    }
  };

  tickets[index] = {
    ...ticket,
    status: 'encerrado',
    historico: [...ticket.historico, historicoItem],
    ultima_interacao: agora
  };

  saveTickets(tickets);
  return tickets[index];
};

// Get tickets for Suporte view
export const listarTicketsSuporte = (): Ticket[] => {
  const tickets = loadTickets();
  return tickets
    .filter(t => t.time_atual === 'suporte')
    .sort((a, b) => {
      // Sort by priority, then by creation date
      const prioridadeOrdem = { critica: 0, alta: 1, media: 2, baixa: 3 };
      const prioA = prioridadeOrdem[a.prioridade];
      const prioB = prioridadeOrdem[b.prioridade];
      if (prioA !== prioB) return prioA - prioB;
      return new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime();
    });
};

// Get tickets for CS view
export const listarTicketsCS = (): Ticket[] => {
  const tickets = loadTickets();
  return tickets
    .filter(t => t.time_atual === 'cs' || t.status === 'resolvido_tecnico')
    .sort((a, b) => {
      return new Date(b.ultima_interacao).getTime() - new Date(a.ultima_interacao).getTime();
    });
};

export const ticketsService = {
  criarTicket,
  listarTickets,
  buscarTicket,
  atualizarStatus,
  adicionarComentario,
  encaminharParaCS,
  atualizarTipoDemanda,
  encerrarTicket,
  listarTicketsSuporte,
  listarTicketsCS,
};
