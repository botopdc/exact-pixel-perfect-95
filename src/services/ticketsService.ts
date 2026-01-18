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
import { logDataSource } from '@/lib/logDataSource';

const STORAGE_KEY = 'open_tickets_v1';

// Generate unique ID
const generateId = (): string => {
  return `TKT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
};

// Load tickets from localStorage
const loadTickets = (): Ticket[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    logDataSource({ module: 'TicketsService', source: 'LocalStorage', operation: 'READ', key: STORAGE_KEY, details: 'MOCK - Migrar para API' });
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

// Save tickets to localStorage
const saveTickets = (tickets: Ticket[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  logDataSource({ module: 'TicketsService', source: 'LocalStorage', operation: 'WRITE', key: STORAGE_KEY, details: 'MOCK - Migrar para API' });
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
  dados: Omit<Ticket, 'id' | 'status' | 'time_atual' | 'tipo_demanda' | 'historico' | 'criado_em' | 'ultima_interacao' | 'prioridade' | 'stage_timestamps'>
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
    origem: dados.origem || 'manual',
    stage_timestamps: {
      novo: agora
    },
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

  // Update stage timestamps
  const stage_timestamps = { ...ticket.stage_timestamps };
  if (!stage_timestamps[novoStatus]) {
    stage_timestamps[novoStatus] = agora;
  }

  tickets[index] = {
    ...ticket,
    status: novoStatus,
    stage_timestamps,
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

  // Update stage timestamps
  const stage_timestamps = { ...ticket.stage_timestamps };
  if (!stage_timestamps.resolvido_tecnico) {
    stage_timestamps.resolvido_tecnico = agora;
  }
  if (!stage_timestamps.validacao_cs) {
    stage_timestamps.validacao_cs = agora;
  }

  tickets[index] = {
    ...ticket,
    status: 'resolvido_tecnico',
    time_atual: 'cs',
    stage_timestamps,
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

  // Update stage timestamps
  const stage_timestamps = { ...ticket.stage_timestamps };
  if (!stage_timestamps.encerrado) {
    stage_timestamps.encerrado = agora;
  }

  tickets[index] = {
    ...ticket,
    status: 'encerrado',
    stage_timestamps,
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

// Seed sample tickets for testing
export const seedSampleTickets = (): void => {
  const existingTickets = loadTickets();
  if (existingTickets.length > 0) return; // Don't seed if tickets exist

  const empresas = ['TechCorp Brasil', 'Indústria ABC', 'Banco FinanceX', 'Varejo Express', 'Logística Prime'];
  const servicos = ['Firewall', 'Backup Cloud', 'Monitoramento 24x7', 'Antivírus Corporativo', 'VPN'];
  const setores = ['TI', 'Financeiro', 'Operações', 'RH', 'Comercial'];
  const tecnicos = ['João Silva', 'Maria Santos', 'Pedro Costa', 'Ana Oliveira'];

  const agora = new Date();
  const tickets: Ticket[] = [];

  // Cliente em RISCO: TechCorp Brasil (muitos incidentes, alto impacto)
  for (let i = 0; i < 8; i++) {
    const dataBase = new Date(agora);
    dataBase.setDate(dataBase.getDate() - Math.floor(Math.random() * 30));
    
    tickets.push({
      id: `TKT-RISK-${i}`,
      titulo: `Incidente crítico - Sistema ${i + 1}`,
      descricao: 'Problema crítico impactando operações',
      empresa: 'TechCorp Brasil',
      servico: servicos[i % servicos.length],
      setor: 'TI',
      categoria: i % 2 === 0 ? 'incidente' : 'problema',
      tipo_demanda: i < 3 ? 'risco' : 'tecnico',
      prioridade: i < 4 ? 'critica' : 'alta',
      status: i < 3 ? 'em_atendimento' : 'encerrado',
      time_atual: i < 3 ? 'suporte' : 'cs',
      responsavel: tecnicos[i % tecnicos.length],
      privado: false,
      origem: 'cliente',
      stage_timestamps: {
        novo: new Date(dataBase.getTime() - 86400000).toISOString(),
        em_atendimento: dataBase.toISOString(),
        ...(i >= 3 && { resolvido_tecnico: new Date(dataBase.getTime() + 43200000).toISOString() }),
        ...(i >= 3 && { encerrado: new Date(dataBase.getTime() + 86400000).toISOString() }),
      },
      transicao_cs: i >= 3 ? {
        resumo_tecnico: 'Problema resolvido após análise',
        acao_tomada: 'Reinicialização do serviço',
        impacto: 'alto',
        data_transicao: new Date(dataBase.getTime() + 43200000).toISOString(),
        autor: tecnicos[i % tecnicos.length]
      } : undefined,
      historico: [{
        id: crypto.randomUUID(),
        data: dataBase.toISOString(),
        autor: 'Sistema',
        tipo: 'mudanca_status',
        conteudo: 'Ticket criado',
        metadados: { status_novo: 'novo' }
      }],
      criado_em: new Date(dataBase.getTime() - 86400000).toISOString(),
      ultima_interacao: dataBase.toISOString(),
    });
  }

  // Cliente em ATENÇÃO: Indústria ABC (volume moderado, alguns problemas)
  for (let i = 0; i < 5; i++) {
    const dataBase = new Date(agora);
    dataBase.setDate(dataBase.getDate() - Math.floor(Math.random() * 60));
    
    tickets.push({
      id: `TKT-ATT-${i}`,
      titulo: `Requisição de suporte #${i + 1}`,
      descricao: 'Solicitação de ajuste no sistema',
      empresa: 'Indústria ABC',
      servico: servicos[i % servicos.length],
      setor: setores[i % setores.length],
      categoria: i < 2 ? 'incidente' : 'requisicao',
      tipo_demanda: 'tecnico',
      prioridade: 'media',
      status: i < 2 ? 'validacao_cs' : 'encerrado',
      time_atual: 'cs',
      responsavel: tecnicos[i % tecnicos.length],
      privado: false,
      origem: 'manual',
      stage_timestamps: {
        novo: new Date(dataBase.getTime() - 172800000).toISOString(),
        em_atendimento: new Date(dataBase.getTime() - 86400000).toISOString(),
        resolvido_tecnico: dataBase.toISOString(),
        ...(i >= 2 && { encerrado: new Date(dataBase.getTime() + 43200000).toISOString() }),
      },
      transicao_cs: {
        resumo_tecnico: 'Configuração ajustada',
        acao_tomada: 'Aplicação de patch',
        impacto: 'medio',
        data_transicao: dataBase.toISOString(),
        autor: tecnicos[i % tecnicos.length]
      },
      historico: [{
        id: crypto.randomUUID(),
        data: dataBase.toISOString(),
        autor: 'Sistema',
        tipo: 'mudanca_status',
        conteudo: 'Ticket criado',
        metadados: { status_novo: 'novo' }
      }],
      criado_em: new Date(dataBase.getTime() - 172800000).toISOString(),
      ultima_interacao: dataBase.toISOString(),
    });
  }

  // Cliente SAUDÁVEL: Banco FinanceX (poucos tickets, bem resolvidos)
  for (let i = 0; i < 2; i++) {
    const dataBase = new Date(agora);
    dataBase.setDate(dataBase.getDate() - Math.floor(Math.random() * 90));
    
    tickets.push({
      id: `TKT-OK-${i}`,
      titulo: `Dúvida sobre configuração #${i + 1}`,
      descricao: 'Pergunta sobre uso do sistema',
      empresa: 'Banco FinanceX',
      servico: servicos[i % servicos.length],
      setor: 'TI',
      categoria: 'duvida',
      tipo_demanda: 'tecnico',
      prioridade: 'baixa',
      status: 'encerrado',
      time_atual: 'cs',
      responsavel: tecnicos[i % tecnicos.length],
      privado: false,
      origem: 'cliente',
      stage_timestamps: {
        novo: new Date(dataBase.getTime() - 7200000).toISOString(),
        em_atendimento: new Date(dataBase.getTime() - 3600000).toISOString(),
        resolvido_tecnico: dataBase.toISOString(),
        encerrado: new Date(dataBase.getTime() + 1800000).toISOString(),
      },
      transicao_cs: {
        resumo_tecnico: 'Orientação fornecida',
        acao_tomada: 'Documentação enviada',
        impacto: 'baixo',
        data_transicao: dataBase.toISOString(),
        autor: tecnicos[i % tecnicos.length]
      },
      historico: [{
        id: crypto.randomUUID(),
        data: dataBase.toISOString(),
        autor: 'Sistema',
        tipo: 'mudanca_status',
        conteudo: 'Ticket criado',
        metadados: { status_novo: 'novo' }
      }],
      criado_em: new Date(dataBase.getTime() - 7200000).toISOString(),
      ultima_interacao: new Date(dataBase.getTime() + 1800000).toISOString(),
    });
  }

  // Cliente SAUDÁVEL: Varejo Express (expansão potencial)
  tickets.push({
    id: 'TKT-EXP-1',
    titulo: 'Consulta sobre novos serviços',
    descricao: 'Cliente interessado em ampliar contrato',
    empresa: 'Varejo Express',
    servico: 'Backup Cloud',
    setor: 'TI',
    categoria: 'requisicao',
    tipo_demanda: 'expansao',
    prioridade: 'baixa',
    status: 'encerrado',
    time_atual: 'cs',
    responsavel: 'Maria Santos',
    privado: false,
    origem: 'cliente',
    stage_timestamps: {
      novo: new Date(agora.getTime() - 604800000).toISOString(),
      em_atendimento: new Date(agora.getTime() - 518400000).toISOString(),
      resolvido_tecnico: new Date(agora.getTime() - 432000000).toISOString(),
      encerrado: new Date(agora.getTime() - 345600000).toISOString(),
    },
    transicao_cs: {
      resumo_tecnico: 'Proposta comercial enviada',
      acao_tomada: 'Agendamento de reunião',
      impacto: 'baixo',
      data_transicao: new Date(agora.getTime() - 432000000).toISOString(),
      autor: 'Maria Santos'
    },
    historico: [{
      id: crypto.randomUUID(),
      data: new Date(agora.getTime() - 604800000).toISOString(),
      autor: 'Sistema',
      tipo: 'mudanca_status',
      conteudo: 'Ticket criado',
      metadados: { status_novo: 'novo' }
    }],
    criado_em: new Date(agora.getTime() - 604800000).toISOString(),
    ultima_interacao: new Date(agora.getTime() - 345600000).toISOString(),
  });

  // Cliente em RISCO: Logística Prime (problemas financeiros)
  for (let i = 0; i < 4; i++) {
    const dataBase = new Date(agora);
    dataBase.setDate(dataBase.getDate() - Math.floor(Math.random() * 45));
    
    tickets.push({
      id: `TKT-FIN-${i}`,
      titulo: i < 2 ? `Problema de conectividade #${i + 1}` : `Cobrança contestada #${i - 1}`,
      descricao: i < 2 ? 'Falha na conexão VPN' : 'Cliente questiona valores',
      empresa: 'Logística Prime',
      servico: i < 2 ? 'VPN' : 'Monitoramento 24x7',
      setor: i < 2 ? 'TI' : 'Financeiro',
      categoria: i < 2 ? 'incidente' : 'requisicao',
      tipo_demanda: i < 2 ? 'tecnico' : 'financeiro',
      prioridade: i < 2 ? 'alta' : 'media',
      status: i === 0 ? 'novo' : i === 1 ? 'em_atendimento' : 'encerrado',
      time_atual: i < 2 ? 'suporte' : 'cs',
      responsavel: tecnicos[i % tecnicos.length],
      privado: i >= 2,
      origem: 'cliente',
      stage_timestamps: {
        novo: new Date(dataBase.getTime() - 86400000).toISOString(),
        ...(i >= 1 && { em_atendimento: dataBase.toISOString() }),
        ...(i >= 2 && { resolvido_tecnico: new Date(dataBase.getTime() + 21600000).toISOString() }),
        ...(i >= 2 && { encerrado: new Date(dataBase.getTime() + 43200000).toISOString() }),
      },
      transicao_cs: i >= 2 ? {
        resumo_tecnico: 'Análise financeira realizada',
        acao_tomada: 'Desconto aplicado',
        impacto: 'medio',
        data_transicao: new Date(dataBase.getTime() + 21600000).toISOString(),
        autor: tecnicos[i % tecnicos.length]
      } : undefined,
      historico: [{
        id: crypto.randomUUID(),
        data: dataBase.toISOString(),
        autor: 'Sistema',
        tipo: 'mudanca_status',
        conteudo: 'Ticket criado',
        metadados: { status_novo: 'novo' }
      }],
      criado_em: new Date(dataBase.getTime() - 86400000).toISOString(),
      ultima_interacao: dataBase.toISOString(),
    });
  }

  saveTickets(tickets);
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
  seedSampleTickets,
};
