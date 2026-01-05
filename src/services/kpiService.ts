import { Ticket, TicketStatus, TicketCategoria, TicketPrioridade } from '@/types/ticket';
import { listarTickets } from './ticketsService';
import { differenceInMinutes, differenceInHours, differenceInDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';

export type PeriodoFiltro = 'hoje' | 'semana' | 'mes' | 'todos';
export type TimeFiltro = 'todos' | 'suporte' | 'cs';

export interface KPIFilters {
  periodo: PeriodoFiltro;
  time?: TimeFiltro;
  empresa?: string;
  servico?: string;
}

export interface AlertConfig {
  tempoMedioLimite: number; // em minutos
  slaMinimo: number; // percentual
  acumuloMaximo: number; // tickets
  recorrenciaMaxima: number; // tickets por cliente
}

const DEFAULT_ALERT_CONFIG: AlertConfig = {
  tempoMedioLimite: 240, // 4 horas
  slaMinimo: 80,
  acumuloMaximo: 10,
  recorrenciaMaxima: 5
};

// Helper to filter tickets by period
const filterByPeriod = (tickets: Ticket[], periodo: PeriodoFiltro): Ticket[] => {
  if (periodo === 'todos') return tickets;
  
  const now = new Date();
  let start: Date, end: Date;
  
  switch (periodo) {
    case 'hoje':
      start = startOfDay(now);
      end = endOfDay(now);
      break;
    case 'semana':
      start = startOfWeek(now, { weekStartsOn: 1 });
      end = endOfWeek(now, { weekStartsOn: 1 });
      break;
    case 'mes':
      start = startOfMonth(now);
      end = endOfMonth(now);
      break;
    default:
      return tickets;
  }
  
  return tickets.filter(t => {
    const criado = parseISO(t.criado_em);
    return isWithinInterval(criado, { start, end });
  });
};

// Helper to calculate time between stages
const calcularTempoEntreEtapas = (ticket: Ticket, de: TicketStatus, para: TicketStatus): number | null => {
  const timestamps = ticket.stage_timestamps;
  if (!timestamps) return null;
  
  const inicio = timestamps[de];
  const fim = timestamps[para];
  
  if (!inicio || !fim) return null;
  
  return differenceInMinutes(parseISO(fim), parseISO(inicio));
};

// Calculate time from creation to first response (em_atendimento)
const calcularTempoAtePrimeiroAtendimento = (ticket: Ticket): number | null => {
  const timestamps = ticket.stage_timestamps;
  if (!timestamps?.em_atendimento) return null;
  
  return differenceInMinutes(parseISO(timestamps.em_atendimento), parseISO(ticket.criado_em));
};

// Calculate total lifecycle time
const calcularTempoTotal = (ticket: Ticket): number | null => {
  if (ticket.status !== 'encerrado') return null;
  
  const timestamps = ticket.stage_timestamps;
  if (!timestamps?.encerrado) return null;
  
  return differenceInMinutes(parseISO(timestamps.encerrado), parseISO(ticket.criado_em));
};

// =================
// KPIs - Chamado Criado
// =================
export const getKPIsChamadoCriado = (filters: KPIFilters) => {
  const allTickets = listarTickets();
  const tickets = filterByPeriod(allTickets, filters.periodo);
  
  // Tickets criados por período
  const ticketsCriados = tickets.length;
  
  // Origem do ticket
  const origens = tickets.reduce((acc, t) => {
    const origem = t.origem || 'manual';
    acc[origem] = (acc[origem] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Tempo médio até primeiro atendimento
  const temposAtendimento = tickets
    .map(calcularTempoAtePrimeiroAtendimento)
    .filter((t): t is number => t !== null);
  
  const tempoMedioPrimeiroAtendimento = temposAtendimento.length > 0
    ? temposAtendimento.reduce((a, b) => a + b, 0) / temposAtendimento.length
    : 0;
  
  // % de tickets que violaram SLA de primeira resposta (considerando 2h = 120min)
  const SLA_PRIMEIRA_RESPOSTA = 120;
  const violacoesSLA = temposAtendimento.filter(t => t > SLA_PRIMEIRA_RESPOSTA).length;
  const percentualViolacaoSLA = temposAtendimento.length > 0
    ? (violacoesSLA / temposAtendimento.length) * 100
    : 0;
  
  return {
    ticketsCriados,
    origens,
    tempoMedioPrimeiroAtendimento,
    percentualViolacaoSLA,
    slaCumprido: 100 - percentualViolacaoSLA
  };
};

// =================
// KPIs - Suporte Em Atendimento
// =================
export const getKPIsSuporteEmAtendimento = (filters: KPIFilters) => {
  const allTickets = listarTickets();
  const tickets = filterByPeriod(allTickets, filters.periodo);
  
  // Tickets in suporte
  const ticketsSuporte = tickets.filter(t => t.time_atual === 'suporte');
  
  // Tempo médio de atendimento técnico (novo -> resolvido_tecnico)
  const temposAtendimento = tickets
    .map(t => calcularTempoEntreEtapas(t, 'novo', 'resolvido_tecnico'))
    .filter((t): t is number => t !== null);
  
  const tempoMedioAtendimento = temposAtendimento.length > 0
    ? temposAtendimento.reduce((a, b) => a + b, 0) / temposAtendimento.length
    : 0;
  
  // Tickets em aberto por responsável
  const ticketsPorResponsavel = ticketsSuporte.reduce((acc, t) => {
    const resp = t.responsavel || 'Não atribuído';
    acc[resp] = (acc[resp] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // % de tickets reabertos (verificar no histórico se voltou de CS para Suporte)
  const ticketsReabertos = tickets.filter(t => {
    const transicoes = t.historico.filter(h => h.tipo === 'transicao_time');
    // Se teve mais de uma transição, foi reaberto
    return transicoes.length > 1;
  }).length;
  const percentualReabertos = tickets.length > 0
    ? (ticketsReabertos / tickets.length) * 100
    : 0;
  
  // Tickets por categoria
  const ticketsPorCategoria = tickets.reduce((acc, t) => {
    acc[t.categoria] = (acc[t.categoria] || 0) + 1;
    return acc;
  }, {} as Record<TicketCategoria, number>);
  
  // SLA técnico cumprido (considerando 4h = 240min para resolução)
  const SLA_TECNICO = 240;
  const dentroSLA = temposAtendimento.filter(t => t <= SLA_TECNICO).length;
  const slaTecnicoCumprido = temposAtendimento.length > 0
    ? (dentroSLA / temposAtendimento.length) * 100
    : 100;
  
  return {
    ticketsEmAberto: ticketsSuporte.length,
    tempoMedioAtendimento,
    ticketsPorResponsavel,
    percentualReabertos,
    ticketsPorCategoria,
    slaTecnicoCumprido
  };
};

// =================
// KPIs - Resolvido Técnico
// =================
export const getKPIsResolvidoTecnico = (filters: KPIFilters) => {
  const allTickets = listarTickets();
  const tickets = filterByPeriod(allTickets, filters.periodo);
  
  const ticketsResolvidos = tickets.filter(t => 
    t.stage_timestamps?.resolvido_tecnico ||
    t.status === 'resolvido_tecnico' ||
    t.status === 'validacao_cs' ||
    t.status === 'encerrado'
  );
  
  // Tempo médio até resolução técnica
  const temposResolucao = ticketsResolvidos
    .map(t => {
      const ts = t.stage_timestamps;
      if (!ts?.resolvido_tecnico) return null;
      return differenceInMinutes(parseISO(ts.resolvido_tecnico), parseISO(t.criado_em));
    })
    .filter((t): t is number => t !== null);
  
  const tempoMedioResolucao = temposResolucao.length > 0
    ? temposResolucao.reduce((a, b) => a + b, 0) / temposResolucao.length
    : 0;
  
  // % resolvidos na primeira intervenção (1 comentário antes de resolver)
  const resolvidosPrimeiraIntervencao = ticketsResolvidos.filter(t => {
    const comentarios = t.historico.filter(h => h.tipo === 'comentario');
    return comentarios.length <= 1;
  }).length;
  const percentualPrimeiraIntervencao = ticketsResolvidos.length > 0
    ? (resolvidosPrimeiraIntervencao / ticketsResolvidos.length) * 100
    : 0;
  
  // Tempo médio aguardando transição para CS
  const temposTransicao = ticketsResolvidos
    .map(t => {
      const ts = t.stage_timestamps;
      if (!ts?.resolvido_tecnico || !ts?.validacao_cs) return null;
      return differenceInMinutes(parseISO(ts.validacao_cs), parseISO(ts.resolvido_tecnico));
    })
    .filter((t): t is number => t !== null);
  
  const tempoMedioTransicaoCS = temposTransicao.length > 0
    ? temposTransicao.reduce((a, b) => a + b, 0) / temposTransicao.length
    : 0;
  
  // Tickets resolvidos por serviço
  const resolvidosPorServico = ticketsResolvidos.reduce((acc, t) => {
    acc[t.servico] = (acc[t.servico] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return {
    totalResolvidos: ticketsResolvidos.length,
    tempoMedioResolucao,
    percentualPrimeiraIntervencao,
    tempoMedioTransicaoCS,
    resolvidosPorServico
  };
};

// =================
// KPIs - CS Validação
// =================
export const getKPIsCSValidacao = (filters: KPIFilters) => {
  const allTickets = listarTickets();
  const tickets = filterByPeriod(allTickets, filters.periodo);
  
  const ticketsCS = tickets.filter(t => 
    t.time_atual === 'cs' ||
    t.status === 'validacao_cs' ||
    t.status === 'encerrado'
  );
  
  // Tempo médio de validação (validacao_cs -> encerrado)
  const temposValidacao = ticketsCS
    .map(t => calcularTempoEntreEtapas(t, 'validacao_cs', 'encerrado'))
    .filter((t): t is number => t !== null);
  
  const tempoMedioValidacao = temposValidacao.length > 0
    ? temposValidacao.reduce((a, b) => a + b, 0) / temposValidacao.length
    : 0;
  
  // Tickets encerrados (considerar com base no status)
  const encerrados = ticketsCS.filter(t => t.status === 'encerrado');
  
  // Tickets com impacto alto
  const impactoAlto = ticketsCS.filter(t => t.transicao_cs?.impacto === 'alto').length;
  
  // Tickets que geraram risco ou oportunidade de expansão
  const ticketsRisco = ticketsCS.filter(t => t.tipo_demanda === 'risco').length;
  const ticketsExpansao = ticketsCS.filter(t => t.tipo_demanda === 'expansao').length;
  
  return {
    totalCS: ticketsCS.length,
    encerrados: encerrados.length,
    tempoMedioValidacao,
    impactoAlto,
    ticketsRisco,
    ticketsExpansao,
    aguardandoValidacao: ticketsCS.filter(t => t.status !== 'encerrado').length
  };
};

// =================
// KPIs - Encerrado
// =================
export const getKPIsEncerrado = (filters: KPIFilters) => {
  const allTickets = listarTickets();
  const tickets = filterByPeriod(allTickets, filters.periodo);
  
  const ticketsEncerrados = tickets.filter(t => t.status === 'encerrado');
  
  // Tempo total de vida do ticket
  const temposTotais = ticketsEncerrados
    .map(calcularTempoTotal)
    .filter((t): t is number => t !== null);
  
  const tempoMedioTotal = temposTotais.length > 0
    ? temposTotais.reduce((a, b) => a + b, 0) / temposTotais.length
    : 0;
  
  // SLA final cumprido (considerando 24h = 1440min para resolver ponta a ponta)
  const SLA_TOTAL = 1440;
  const dentroSLA = temposTotais.filter(t => t <= SLA_TOTAL).length;
  const slaFinalCumprido = temposTotais.length > 0
    ? (dentroSLA / temposTotais.length) * 100
    : 100;
  
  // Tickets por cliente (recorrência)
  const ticketsPorCliente = ticketsEncerrados.reduce((acc, t) => {
    acc[t.empresa] = (acc[t.empresa] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Top 10 clientes
  const top10Clientes = Object.entries(ticketsPorCliente)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([empresa, count]) => ({ empresa, count }));
  
  return {
    totalEncerrados: ticketsEncerrados.length,
    tempoMedioTotal,
    slaFinalCumprido,
    ticketsPorCliente,
    top10Clientes
  };
};

// =================
// Dashboard Agregado - Suporte
// =================
export const getDashboardSuporte = (filters: KPIFilters) => {
  const allTickets = listarTickets();
  const tickets = filterByPeriod(allTickets, filters.periodo);
  
  const ticketsSuporte = tickets.filter(t => t.time_atual === 'suporte');
  
  // Backlog atual
  const backlog = ticketsSuporte.length;
  
  // Por status
  const porStatus = ticketsSuporte.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<TicketStatus, number>);
  
  // Por prioridade
  const porPrioridade = ticketsSuporte.reduce((acc, t) => {
    acc[t.prioridade] = (acc[t.prioridade] || 0) + 1;
    return acc;
  }, {} as Record<TicketPrioridade, number>);
  
  // Gargalos por categoria
  const porCategoria = ticketsSuporte.reduce((acc, t) => {
    acc[t.categoria] = (acc[t.categoria] || 0) + 1;
    return acc;
  }, {} as Record<TicketCategoria, number>);
  
  // Top técnicos
  const topTecnicos = Object.entries(
    ticketsSuporte.reduce((acc, t) => {
      const resp = t.responsavel || 'Não atribuído';
      acc[resp] = (acc[resp] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  )
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([nome, count]) => ({ nome, count }));
  
  const kpisEmAtendimento = getKPIsSuporteEmAtendimento(filters);
  
  return {
    backlog,
    porStatus,
    porPrioridade,
    porCategoria,
    topTecnicos,
    tempoMedioAtendimento: kpisEmAtendimento.tempoMedioAtendimento,
    slaTecnicoCumprido: kpisEmAtendimento.slaTecnicoCumprido
  };
};

// =================
// Dashboard Agregado - CS
// =================
export const getDashboardCS = (filters: KPIFilters) => {
  const allTickets = listarTickets();
  const tickets = filterByPeriod(allTickets, filters.periodo);
  
  const ticketsCS = tickets.filter(t => t.time_atual === 'cs' || t.status === 'resolvido_tecnico');
  
  // Tickets aguardando validação
  const aguardandoValidacao = ticketsCS.filter(t => t.status !== 'encerrado').length;
  
  // Clientes críticos (com impacto alto ou muitos tickets)
  const clientesCriticos = [...new Set(
    ticketsCS
      .filter(t => t.transicao_cs?.impacto === 'alto')
      .map(t => t.empresa)
  )];
  
  // Recorrência por cliente
  const recorrenciaPorCliente = tickets.reduce((acc, t) => {
    acc[t.empresa] = (acc[t.empresa] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Top clientes recorrentes
  const topClientesRecorrentes = Object.entries(recorrenciaPorCliente)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([empresa, count]) => ({ empresa, count }));
  
  const kpisValidacao = getKPIsCSValidacao(filters);
  const kpisEncerrado = getKPIsEncerrado(filters);
  
  return {
    aguardandoValidacao,
    clientesCriticos,
    topClientesRecorrentes,
    impactoAlto: kpisValidacao.impactoAlto,
    tempoMedioValidacao: kpisValidacao.tempoMedioValidacao,
    tempoMedioFechamento: kpisEncerrado.tempoMedioTotal,
    ticketsRisco: kpisValidacao.ticketsRisco,
    ticketsExpansao: kpisValidacao.ticketsExpansao
  };
};

// =================
// Dashboard Agregado - Gestão
// =================
export const getDashboardGestao = (filters: KPIFilters) => {
  const allTickets = listarTickets();
  const tickets = filterByPeriod(allTickets, filters.periodo);
  
  // Volume total
  const volumeTotal = tickets.length;
  
  // Por status
  const porStatus = tickets.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<TicketStatus, number>);
  
  // KPIs
  const kpisEncerrado = getKPIsEncerrado(filters);
  const kpisCriado = getKPIsChamadoCriado(filters);
  
  // Gargalo principal (etapa com mais tickets)
  const etapas: Record<TicketStatus, number> = {
    novo: 0,
    em_atendimento: 0,
    resolvido_tecnico: 0,
    validacao_cs: 0,
    encerrado: 0
  };
  
  tickets.forEach(t => {
    etapas[t.status]++;
  });
  
  // Remover encerrado do cálculo de gargalo
  const etapasSemEncerrado = { ...etapas };
  delete (etapasSemEncerrado as Record<string, number>).encerrado;
  
  const gargaloPrincipal = Object.entries(etapasSemEncerrado)
    .sort(([, a], [, b]) => (b as number) - (a as number))[0];
  
  return {
    volumeTotal,
    porStatus,
    slaGeral: kpisEncerrado.slaFinalCumprido,
    tempoMedioPontaAPonta: kpisEncerrado.tempoMedioTotal,
    gargaloPrincipal: gargaloPrincipal ? { etapa: gargaloPrincipal[0], count: gargaloPrincipal[1] } : null,
    top10Clientes: kpisEncerrado.top10Clientes,
    ticketsCriados: kpisCriado.ticketsCriados,
    origens: kpisCriado.origens,
    slaPrimeiraResposta: kpisCriado.slaCumprido
  };
};

// =================
// Alertas
// =================
export const getAlertas = (config: AlertConfig = DEFAULT_ALERT_CONFIG) => {
  const allTickets = listarTickets();
  const alertas: Array<{
    tipo: 'warning' | 'error';
    titulo: string;
    descricao: string;
  }> = [];
  
  // Verificar tempo médio
  const kpisSuporte = getKPIsSuporteEmAtendimento({ periodo: 'mes' });
  if (kpisSuporte.tempoMedioAtendimento > config.tempoMedioLimite) {
    alertas.push({
      tipo: 'warning',
      titulo: 'Tempo médio de atendimento alto',
      descricao: `O tempo médio de atendimento está em ${Math.round(kpisSuporte.tempoMedioAtendimento / 60)}h, acima do limite de ${Math.round(config.tempoMedioLimite / 60)}h`
    });
  }
  
  // Verificar SLA
  if (kpisSuporte.slaTecnicoCumprido < config.slaMinimo) {
    alertas.push({
      tipo: 'error',
      titulo: 'SLA técnico abaixo do esperado',
      descricao: `O SLA técnico está em ${kpisSuporte.slaTecnicoCumprido.toFixed(1)}%, abaixo do mínimo de ${config.slaMinimo}%`
    });
  }
  
  // Verificar acúmulo
  const ticketsPorEtapa = allTickets.reduce((acc, t) => {
    if (t.status !== 'encerrado') {
      acc[t.status] = (acc[t.status] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  
  Object.entries(ticketsPorEtapa).forEach(([etapa, count]) => {
    if (count > config.acumuloMaximo) {
      alertas.push({
        tipo: 'warning',
        titulo: `Acúmulo na etapa "${etapa}"`,
        descricao: `Existem ${count} tickets acumulados nesta etapa, acima do limite de ${config.acumuloMaximo}`
      });
    }
  });
  
  // Verificar recorrência de clientes
  const recorrencia = allTickets.reduce((acc, t) => {
    acc[t.empresa] = (acc[t.empresa] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  Object.entries(recorrencia).forEach(([empresa, count]) => {
    if (count > config.recorrenciaMaxima) {
      alertas.push({
        tipo: 'warning',
        titulo: `Cliente com alta recorrência`,
        descricao: `${empresa} tem ${count} tickets, acima do limite de ${config.recorrenciaMaxima}`
      });
    }
  });
  
  return alertas;
};

// Helper to format minutes to readable time
export const formatarTempo = (minutos: number): string => {
  if (minutos < 60) return `${Math.round(minutos)}min`;
  if (minutos < 1440) return `${Math.round(minutos / 60)}h`;
  return `${Math.round(minutos / 1440)}d`;
};

// Get unique values for filters
export const getFilterOptions = () => {
  const tickets = listarTickets();
  
  return {
    empresas: [...new Set(tickets.map(t => t.empresa))].filter(Boolean),
    servicos: [...new Set(tickets.map(t => t.servico))].filter(Boolean)
  };
};

export const kpiService = {
  getKPIsChamadoCriado,
  getKPIsSuporteEmAtendimento,
  getKPIsResolvidoTecnico,
  getKPIsCSValidacao,
  getKPIsEncerrado,
  getDashboardSuporte,
  getDashboardCS,
  getDashboardGestao,
  getAlertas,
  getFilterOptions,
  formatarTempo
};
