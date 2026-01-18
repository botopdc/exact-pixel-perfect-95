import { Ticket } from '@/types/ticket';
import { 
  ClientHealthScore, 
  HealthScoreComponents, 
  HealthScoreHistoryItem,
  COMPONENT_WEIGHTS,
  getHealthStatus 
} from '@/types/healthScore';
import { listarTickets } from './ticketsService';
import { logDataSource } from '@/lib/logDataSource';

const STORAGE_KEY = 'open_health_scores_v1';

// Helper functions
function getStoredScores(): ClientHealthScore[] {
  const data = localStorage.getItem(STORAGE_KEY);
  logDataSource({ module: 'HealthScoreService', source: 'LocalStorage', operation: 'READ', key: STORAGE_KEY, details: 'MOCK - Depende de Tickets' });
  return data ? JSON.parse(data) : [];
}

function saveScores(scores: ClientHealthScore[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  logDataSource({ module: 'HealthScoreService', source: 'LocalStorage', operation: 'WRITE', key: STORAGE_KEY, details: 'MOCK - Depende de Tickets' });
}

function getTicketsForClient(cliente: string, dias: number = 90): Ticket[] {
  const tickets = listarTickets();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - dias);
  
  return tickets.filter(t => 
    t.empresa === cliente && 
    new Date(t.criado_em) >= cutoffDate
  );
}

// Calculate SLA component (0-100)
function calculateSLAScore(tickets: Ticket[]): number {
  if (tickets.length === 0) return 100;
  
  const encerrados = tickets.filter(t => t.status === 'encerrado');
  if (encerrados.length === 0) return 80;
  
  // Check timestamps for SLA compliance
  let slaCompliant = 0;
  encerrados.forEach(ticket => {
    const created = new Date(ticket.criado_em);
    const closed = ticket.stage_timestamps?.encerrado 
      ? new Date(ticket.stage_timestamps.encerrado) 
      : new Date(ticket.ultima_interacao);
    
    const hoursToResolve = (closed.getTime() - created.getTime()) / (1000 * 60 * 60);
    
    // SLA thresholds based on priority
    const slaThresholds: Record<string, number> = {
      critica: 4,
      alta: 8,
      media: 24,
      baixa: 72
    };
    
    const threshold = slaThresholds[ticket.prioridade] || 24;
    if (hoursToResolve <= threshold) slaCompliant++;
  });
  
  return Math.round((slaCompliant / encerrados.length) * 100);
}

// Calculate Recurrence component (0-100, inverted - more tickets = lower score)
function calculateRecurrenceScore(tickets: Ticket[]): number {
  if (tickets.length === 0) return 100;
  
  // Penalize for high volume
  const volumePenalty = Math.min(tickets.length * 2, 40);
  
  // Check for repeated services
  const serviceCount: Record<string, number> = {};
  tickets.forEach(t => {
    serviceCount[t.servico] = (serviceCount[t.servico] || 0) + 1;
  });
  
  const maxRepetition = Math.max(...Object.values(serviceCount));
  const repetitionPenalty = maxRepetition > 3 ? Math.min((maxRepetition - 3) * 5, 30) : 0;
  
  // Check for reopened tickets (approximation based on history)
  const reopened = tickets.filter(t => 
    t.historico.some(h => h.tipo === 'mudanca_status' && 
      h.metadados?.status_anterior === 'encerrado')
  ).length;
  const reopenPenalty = reopened * 10;
  
  return Math.max(0, 100 - volumePenalty - repetitionPenalty - reopenPenalty);
}

// Calculate Impact component (0-100, inverted - high impact = lower score)
function calculateImpactScore(tickets: Ticket[]): number {
  if (tickets.length === 0) return 100;
  
  // Count high impact tickets
  const highImpact = tickets.filter(t => 
    t.transicao_cs?.impacto === 'alto'
  ).length;
  
  const mediumImpact = tickets.filter(t => 
    t.transicao_cs?.impacto === 'medio'
  ).length;
  
  // Count critical incidents
  const criticalIncidents = tickets.filter(t => 
    t.categoria === 'incidente' && t.prioridade === 'critica'
  ).length;
  
  // Count risk tickets
  const riskTickets = tickets.filter(t => 
    t.tipo_demanda === 'risco'
  ).length;
  
  const penalty = (highImpact * 15) + (mediumImpact * 5) + (criticalIncidents * 20) + (riskTickets * 10);
  
  return Math.max(0, 100 - Math.min(penalty, 100));
}

// Calculate Client Behavior component (0-100)
function calculateBehaviorScore(tickets: Ticket[]): number {
  if (tickets.length === 0) return 100;
  
  // Count tickets closed without validation
  const closedWithoutValidation = tickets.filter(t => {
    if (t.status !== 'encerrado') return false;
    // Check if went directly from resolvido_tecnico to encerrado quickly
    const resolved = t.stage_timestamps?.resolvido_tecnico;
    const closed = t.stage_timestamps?.encerrado;
    if (!resolved || !closed) return false;
    
    const validationTime = (new Date(closed).getTime() - new Date(resolved).getTime()) / (1000 * 60);
    return validationTime < 5; // Less than 5 minutes
  }).length;
  
  const noValidationPenalty = closedWithoutValidation * 5;
  
  // Check for negative patterns in history (approximation)
  const longOpenTickets = tickets.filter(t => {
    if (t.status === 'encerrado') return false;
    const created = new Date(t.criado_em);
    const now = new Date();
    const daysOpen = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    return daysOpen > 7;
  }).length;
  
  const longOpenPenalty = longOpenTickets * 10;
  
  return Math.max(0, 100 - noValidationPenalty - longOpenPenalty);
}

// Calculate Service Stability component (0-100)
function calculateStabilityScore(tickets: Ticket[]): number {
  if (tickets.length === 0) return 100;
  
  // Count incidents (indicates instability)
  const incidents = tickets.filter(t => t.categoria === 'incidente').length;
  const incidentPenalty = incidents * 8;
  
  // Count critical priority tickets
  const critical = tickets.filter(t => t.prioridade === 'critica').length;
  const criticalPenalty = critical * 12;
  
  // Count unique services affected
  const servicesAffected = new Set(tickets.map(t => t.servico)).size;
  const servicePenalty = servicesAffected > 3 ? (servicesAffected - 3) * 5 : 0;
  
  return Math.max(0, 100 - incidentPenalty - criticalPenalty - servicePenalty);
}

// Main calculation function
export function calculateHealthScore(cliente: string): ClientHealthScore {
  const tickets = getTicketsForClient(cliente);
  
  const componentes: HealthScoreComponents = {
    sla: calculateSLAScore(tickets),
    recorrencia: calculateRecurrenceScore(tickets),
    impacto: calculateImpactScore(tickets),
    comportamento: calculateBehaviorScore(tickets),
    estabilidade: calculateStabilityScore(tickets),
  };
  
  const healthScore = Math.round(
    (componentes.sla * COMPONENT_WEIGHTS.sla) +
    (componentes.recorrencia * COMPONENT_WEIGHTS.recorrencia) +
    (componentes.impacto * COMPONENT_WEIGHTS.impacto) +
    (componentes.comportamento * COMPONENT_WEIGHTS.comportamento) +
    (componentes.estabilidade * COMPONENT_WEIGHTS.estabilidade)
  );
  
  const servicesSet = new Set(tickets.map(t => t.servico));
  
  // Get existing score to preserve history
  const existingScores = getStoredScores();
  const existingClient = existingScores.find(s => s.cliente_id === cliente);
  
  const today = new Date().toISOString().split('T')[0];
  let historico: HealthScoreHistoryItem[] = existingClient?.historico_scores || [];
  
  // Add today's score if not already added
  if (!historico.find(h => h.data === today)) {
    historico = [...historico, { data: today, score: healthScore }].slice(-30); // Keep last 30 days
  }
  
  return {
    cliente_id: cliente,
    cliente_nome: cliente,
    health_score_atual: healthScore,
    status_atual: getHealthStatus(healthScore),
    componentes,
    historico_scores: historico,
    ultima_atualizacao: new Date().toISOString(),
    tickets_periodo: tickets.length,
    servicos_impactados: Array.from(servicesSet),
  };
}

// Update and persist health score for a client
export function updateClientHealthScore(cliente: string): ClientHealthScore {
  const newScore = calculateHealthScore(cliente);
  
  const scores = getStoredScores();
  const existingIndex = scores.findIndex(s => s.cliente_id === cliente);
  
  if (existingIndex >= 0) {
    scores[existingIndex] = newScore;
  } else {
    scores.push(newScore);
  }
  
  saveScores(scores);
  return newScore;
}

// Get all unique clients from tickets and calculate their health scores
export function getAllClientHealthScores(): ClientHealthScore[] {
  const tickets = listarTickets();
  const uniqueClients = [...new Set(tickets.map(t => t.empresa))];
  
  return uniqueClients.map(cliente => calculateHealthScore(cliente));
}

// Update all client health scores (daily routine simulation)
export function updateAllHealthScores(): ClientHealthScore[] {
  const scores = getAllClientHealthScores();
  saveScores(scores);
  return scores;
}

// Get stored health scores
export function getStoredHealthScores(): ClientHealthScore[] {
  return getStoredScores();
}

// Get clients at risk
export function getClientsAtRisk(): ClientHealthScore[] {
  const scores = getAllClientHealthScores();
  return scores.filter(s => s.status_atual === 'risco').sort((a, b) => a.health_score_atual - b.health_score_atual);
}

// Get clients needing attention
export function getClientsNeedingAttention(): ClientHealthScore[] {
  const scores = getAllClientHealthScores();
  return scores.filter(s => s.status_atual === 'atencao').sort((a, b) => a.health_score_atual - b.health_score_atual);
}

// Get healthy clients (potential expansion)
export function getHealthyClients(): ClientHealthScore[] {
  const scores = getAllClientHealthScores();
  return scores.filter(s => s.status_atual === 'saudavel').sort((a, b) => b.health_score_atual - a.health_score_atual);
}

// Get health score distribution
export function getHealthScoreDistribution(): { saudavel: number; atencao: number; risco: number } {
  const scores = getAllClientHealthScores();
  return {
    saudavel: scores.filter(s => s.status_atual === 'saudavel').length,
    atencao: scores.filter(s => s.status_atual === 'atencao').length,
    risco: scores.filter(s => s.status_atual === 'risco').length,
  };
}

// Get average health score
export function getAverageHealthScore(): number {
  const scores = getAllClientHealthScores();
  if (scores.length === 0) return 100;
  return Math.round(scores.reduce((sum, s) => sum + s.health_score_atual, 0) / scores.length);
}
