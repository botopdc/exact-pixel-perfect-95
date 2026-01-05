// Enums and types for the Atendimentos module

export type TicketCategoria = 
  | 'requisicao'
  | 'incidente'
  | 'problema'
  | 'mudanca'
  | 'projeto'
  | 'duvida';

export type TicketPrioridade = 'baixa' | 'media' | 'alta' | 'critica';

export type TicketStatus = 
  | 'novo'
  | 'em_atendimento'
  | 'resolvido_tecnico'
  | 'validacao_cs'
  | 'encerrado';

export type TicketTimeAtual = 'suporte' | 'cs';

export type TicketTipoDemanda = 
  | 'tecnico'
  | 'comunicacao'
  | 'risco'
  | 'expansao'
  | 'financeiro';

export interface TicketHistoricoItem {
  id: string;
  data: string;
  autor: string;
  tipo: 'comentario' | 'mudanca_status' | 'transicao_time' | 'anexo';
  conteudo: string;
  metadados?: {
    status_anterior?: TicketStatus;
    status_novo?: TicketStatus;
    time_anterior?: TicketTimeAtual;
    time_novo?: TicketTimeAtual;
  };
}

// Stage timestamps for KPI tracking
export interface TicketStageTimestamps {
  novo?: string;
  em_atendimento?: string;
  resolvido_tecnico?: string;
  validacao_cs?: string;
  encerrado?: string;
}

export interface TicketTransicaoCS {
  resumo_tecnico: string;
  acao_tomada: string;
  impacto: 'baixo' | 'medio' | 'alto';
  data_transicao: string;
  autor: string;
}

export interface Ticket {
  id: string;
  titulo: string;
  descricao: string;
  empresa: string;
  servico: string;
  setor: string;
  categoria: TicketCategoria;
  tipo_demanda: TicketTipoDemanda;
  prioridade: TicketPrioridade;
  status: TicketStatus;
  time_atual: TicketTimeAtual;
  responsavel?: string;
  dispositivos?: string;
  anexo?: string;
  privado: boolean;
  historico: TicketHistoricoItem[];
  transicao_cs?: TicketTransicaoCS;
  criado_em: string;
  ultima_interacao: string;
  // KPI tracking
  stage_timestamps?: TicketStageTimestamps;
  origem?: 'manual' | 'cliente' | 'monitoramento';
}

// Labels for display
export const CATEGORIA_LABELS: Record<TicketCategoria, string> = {
  requisicao: 'Requisição',
  incidente: 'Incidente',
  problema: 'Problema',
  mudanca: 'Mudança',
  projeto: 'Projeto',
  duvida: 'Dúvida',
};

export const PRIORIDADE_LABELS: Record<TicketPrioridade, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  novo: 'Novo',
  em_atendimento: 'Em Atendimento',
  resolvido_tecnico: 'Resolvido (Técnico)',
  validacao_cs: 'CS – Validação',
  encerrado: 'Encerrado',
};

export const TIME_LABELS: Record<TicketTimeAtual, string> = {
  suporte: 'Suporte',
  cs: 'Customer Success',
};

export const TIPO_DEMANDA_LABELS: Record<TicketTipoDemanda, string> = {
  tecnico: 'Técnico',
  comunicacao: 'Comunicação',
  risco: 'Risco',
  expansao: 'Expansão',
  financeiro: 'Financeiro',
};

// Flow steps for the stepper
export const TICKET_FLOW_STEPS = [
  { status: 'novo', label: 'Chamado Criado' },
  { status: 'em_atendimento', label: 'Suporte – Em Atendimento' },
  { status: 'resolvido_tecnico', label: 'Resolvido (Técnico)' },
  { status: 'validacao_cs', label: 'CS – Validação' },
  { status: 'encerrado', label: 'Encerrado' },
] as const;

// Priority weights for auto-calculation
export const CATEGORIA_PESO: Record<TicketCategoria, number> = {
  incidente: 3,
  problema: 2,
  mudanca: 1,
  projeto: 1,
  requisicao: 1,
  duvida: 1,
};
