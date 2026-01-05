// Health Score types and interfaces

export type HealthStatus = 'saudavel' | 'atencao' | 'risco';

export interface HealthScoreHistoryItem {
  data: string;
  score: number;
}

export interface HealthScoreComponents {
  sla: number;           // 0-100
  recorrencia: number;   // 0-100
  impacto: number;       // 0-100
  comportamento: number; // 0-100
  estabilidade: number;  // 0-100
}

export interface ClientHealthScore {
  cliente_id: string;
  cliente_nome: string;
  health_score_atual: number;
  status_atual: HealthStatus;
  componentes: HealthScoreComponents;
  historico_scores: HealthScoreHistoryItem[];
  ultima_atualizacao: string;
  tickets_periodo: number;
  servicos_impactados: string[];
}

export const HEALTH_STATUS_CONFIG: Record<HealthStatus, { label: string; color: string; bgColor: string }> = {
  saudavel: { label: 'Saudável', color: 'text-green-600', bgColor: 'bg-green-100' },
  atencao: { label: 'Atenção', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  risco: { label: 'Risco', color: 'text-red-600', bgColor: 'bg-red-100' },
};

export const COMPONENT_WEIGHTS = {
  sla: 0.30,
  recorrencia: 0.25,
  impacto: 0.20,
  comportamento: 0.15,
  estabilidade: 0.10,
};

export function getHealthStatus(score: number): HealthStatus {
  if (score >= 80) return 'saudavel';
  if (score >= 60) return 'atencao';
  return 'risco';
}
