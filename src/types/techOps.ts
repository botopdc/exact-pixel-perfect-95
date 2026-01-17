// ============================================================================
// TECHNICAL OPERATIONS CENTER - TYPES
// ============================================================================

// ============================================================================
// ENUMS
// ============================================================================

export type TechRole = 'ADMIN' | 'N1' | 'N2' | 'N3' | 'CS';
export type ClientStatus = 'ATIVO' | 'SUSPENSO' | 'ENCERRADO';
export type SLALevel = 'PADRAO' | 'PREMIUM' | 'CRITICO';
export type AssetType = 'VM' | 'BAREMETAL' | 'GPU' | 'KUBERNETES' | 'STORAGE';
export type AssetEnvironment = 'PROD' | 'HOMOLOG' | 'DEV' | 'NAO_INFORMADO';
export type AssetStatus = 'ATIVO' | 'MANUTENCAO' | 'DESLIGADO';
export type CredentialType = 'ROOT' | 'ADMIN' | 'APP' | 'OUTRO';
export type CredentialVisibility = 'N2_PLUS' | 'N3_PLUS' | 'ADMIN_ONLY';
export type OnCallLevel = 'N1' | 'N2' | 'N3';
export type IncidentOrigin = 'PORTAL_CLIENTE' | 'PORTAL_INTERNO' | 'EMAIL' | 'WHATSAPP' | 'INTERNO';
export type IncidentType = 'QUEDA' | 'PERFORMANCE' | 'CONFIGURACAO' | 'DUVIDA' | 'MUDANCA' | 'OUTRO';
export type IncidentSeverity = 'S1' | 'S2' | 'S3' | 'S4';
export type IncidentStatus = 'ABERTO' | 'CLASSIFICADO' | 'EM_ATENDIMENTO' | 'ESCALADO' | 'RESOLVIDO' | 'ENCERRADO';
export type RootCauseCategory = 'HARDWARE' | 'CONFIG' | 'HUMANO' | 'EXTERNO' | 'DESCONHECIDO';

// ============================================================================
// ENTITIES
// ============================================================================

export interface TechUser {
  id: string;
  name: string;
  email: string;
  role: TechRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TechClient {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  status: ClientStatus;
  sla_level: SLALevel;
  segmento: string | null;
  cs_manager_id: string | null;
  cs_manager?: TechUser | null;
  created_at: string;
  updated_at: string;
  // Computed fields for display
  assets_count?: number;
  incidents_count?: number;
}

export interface TechAsset {
  id: string;
  client_id: string;
  client?: TechClient;
  tipo: AssetType;
  ambiente: AssetEnvironment;
  identificador: string;
  ip_principal: string | null;
  cpu: string | null;
  memoria_gb: number | null;
  disco_gb: number | null;
  status: AssetStatus;
  created_at: string;
  updated_at: string;
  // Computed
  credentials_count?: number;
}

export interface TechCredential {
  id: string;
  asset_id: string;
  asset?: TechAsset;
  cred_type: CredentialType;
  username: string;
  secret_value: string | null;
  secret_ref: string | null;
  visibility_level: CredentialVisibility;
  last_rotated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TechOnCallShift {
  id: string;
  user_id: string;
  user?: TechUser;
  level: OnCallLevel;
  start_at: string;
  end_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TechIncident {
  id: string;
  client_id: string;
  client?: TechClient;
  asset_id: string | null;
  asset?: TechAsset | null;
  origin_channel: IncidentOrigin;
  tipo: IncidentType;
  severidade: IncidentSeverity;
  status: IncidentStatus;
  sla_level_aplicado: SLALevel;
  owner_user_id: string | null;
  owner?: TechUser | null;
  title: string;
  description: string | null;
  opened_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  // Related
  actions?: TechIncidentAction[];
  root_cause?: TechIncidentRootCause | null;
}

export interface TechIncidentAction {
  id: string;
  incident_id: string;
  user_id: string | null;
  user?: TechUser | null;
  action_type: 'comment' | 'status_change' | 'assignment' | 'escalation';
  action_text: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface TechIncidentRootCause {
  id: string;
  incident_id: string;
  category: RootCauseCategory;
  details: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// LABELS FOR DISPLAY
// ============================================================================

export const TECH_ROLE_LABELS: Record<TechRole, string> = {
  ADMIN: 'Administrador',
  N1: 'Nível 1',
  N2: 'Nível 2',
  N3: 'Nível 3',
  CS: 'Customer Success',
};

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  ATIVO: 'Ativo',
  SUSPENSO: 'Suspenso',
  ENCERRADO: 'Encerrado',
};

export const SLA_LEVEL_LABELS: Record<SLALevel, string> = {
  PADRAO: 'Padrão',
  PREMIUM: 'Premium',
  CRITICO: 'Crítico',
};

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  VM: 'Virtual Machine',
  BAREMETAL: 'Bare Metal',
  GPU: 'GPU Server',
  KUBERNETES: 'Kubernetes',
  STORAGE: 'Storage',
};

export const ASSET_ENVIRONMENT_LABELS: Record<AssetEnvironment, string> = {
  PROD: 'Produção',
  HOMOLOG: 'Homologação',
  DEV: 'Desenvolvimento',
  NAO_INFORMADO: 'Não Informado',
};

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  ATIVO: 'Ativo',
  MANUTENCAO: 'Em Manutenção',
  DESLIGADO: 'Desligado',
};

export const CREDENTIAL_TYPE_LABELS: Record<CredentialType, string> = {
  ROOT: 'Root',
  ADMIN: 'Administrador',
  APP: 'Aplicação',
  OUTRO: 'Outro',
};

export const CREDENTIAL_VISIBILITY_LABELS: Record<CredentialVisibility, string> = {
  N2_PLUS: 'N2+',
  N3_PLUS: 'N3+',
  ADMIN_ONLY: 'Admin Only',
};

export const ON_CALL_LEVEL_LABELS: Record<OnCallLevel, string> = {
  N1: 'Nível 1',
  N2: 'Nível 2',
  N3: 'Nível 3',
};

export const INCIDENT_ORIGIN_LABELS: Record<IncidentOrigin, string> = {
  PORTAL_CLIENTE: 'Portal Cliente',
  PORTAL_INTERNO: 'Portal Interno',
  EMAIL: 'E-mail',
  WHATSAPP: 'WhatsApp',
  INTERNO: 'Interno',
};

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  QUEDA: 'Queda',
  PERFORMANCE: 'Performance',
  CONFIGURACAO: 'Configuração',
  DUVIDA: 'Dúvida',
  MUDANCA: 'Mudança',
  OUTRO: 'Outro',
};

export const INCIDENT_SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  S1: 'S1 - Crítico',
  S2: 'S2 - Alto',
  S3: 'S3 - Médio',
  S4: 'S4 - Baixo',
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  ABERTO: 'Aberto',
  CLASSIFICADO: 'Classificado',
  EM_ATENDIMENTO: 'Em Atendimento',
  ESCALADO: 'Escalado',
  RESOLVIDO: 'Resolvido',
  ENCERRADO: 'Encerrado',
};

export const ROOT_CAUSE_CATEGORY_LABELS: Record<RootCauseCategory, string> = {
  HARDWARE: 'Hardware',
  CONFIG: 'Configuração',
  HUMANO: 'Erro Humano',
  EXTERNO: 'Fator Externo',
  DESCONHECIDO: 'Desconhecido',
};

// ============================================================================
// STATUS COLORS
// ============================================================================

export const CLIENT_STATUS_COLORS: Record<ClientStatus, string> = {
  ATIVO: 'bg-green-500/20 text-green-400 border-green-500/30',
  SUSPENSO: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  ENCERRADO: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export const SLA_LEVEL_COLORS: Record<SLALevel, string> = {
  PADRAO: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  PREMIUM: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  CRITICO: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

export const ASSET_STATUS_COLORS: Record<AssetStatus, string> = {
  ATIVO: 'bg-green-500/20 text-green-400 border-green-500/30',
  MANUTENCAO: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  DESLIGADO: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export const INCIDENT_SEVERITY_COLORS: Record<IncidentSeverity, string> = {
  S1: 'bg-red-500/20 text-red-400 border-red-500/30',
  S2: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  S3: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  S4: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

export const INCIDENT_STATUS_COLORS: Record<IncidentStatus, string> = {
  ABERTO: 'bg-red-500/20 text-red-400 border-red-500/30',
  CLASSIFICADO: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  EM_ATENDIMENTO: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  ESCALADO: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  RESOLVIDO: 'bg-green-500/20 text-green-400 border-green-500/30',
  ENCERRADO: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

// ============================================================================
// INCIDENT FLOW STEPS
// ============================================================================

export const INCIDENT_FLOW_STEPS: { status: IncidentStatus; label: string }[] = [
  { status: 'ABERTO', label: 'Aberto' },
  { status: 'CLASSIFICADO', label: 'Classificado' },
  { status: 'EM_ATENDIMENTO', label: 'Em Atendimento' },
  { status: 'RESOLVIDO', label: 'Resolvido' },
  { status: 'ENCERRADO', label: 'Encerrado' },
];

// ============================================================================
// VALIDATION RULES
// ============================================================================

export const INCIDENT_TRANSITION_RULES: Record<IncidentStatus, IncidentStatus[]> = {
  ABERTO: ['CLASSIFICADO'],
  CLASSIFICADO: ['EM_ATENDIMENTO'],
  EM_ATENDIMENTO: ['ESCALADO', 'RESOLVIDO'],
  ESCALADO: ['EM_ATENDIMENTO', 'RESOLVIDO'],
  RESOLVIDO: ['ENCERRADO'],
  ENCERRADO: [],
};

// Check if user can view secrets based on role
export function canViewSecret(userRole: TechRole, visibility: CredentialVisibility): boolean {
  const role = userRole as string;
  if (role === 'ADMIN') return true;
  if (visibility === 'ADMIN_ONLY') return role === 'ADMIN';
  if (visibility === 'N3_PLUS') return ['N3', 'ADMIN'].includes(role);
  if (visibility === 'N2_PLUS') return ['N2', 'N3', 'ADMIN'].includes(role);
  return false;
}

// Validate incident transition
export function canTransitionTo(
  currentStatus: IncidentStatus,
  newStatus: IncidentStatus,
  incident: TechIncident,
  actionsCount: number
): { allowed: boolean; reason?: string } {
  // Check if transition is allowed
  const allowedTransitions = INCIDENT_TRANSITION_RULES[currentStatus];
  if (!allowedTransitions.includes(newStatus)) {
    return { allowed: false, reason: `Transição de ${currentStatus} para ${newStatus} não permitida` };
  }

  // Validation rules
  if (newStatus === 'CLASSIFICADO') {
    if (!incident.tipo || !incident.severidade || !incident.sla_level_aplicado) {
      return { allowed: false, reason: 'Tipo, severidade e SLA são obrigatórios para classificar' };
    }
  }

  if (newStatus === 'EM_ATENDIMENTO') {
    if (!incident.owner_user_id) {
      return { allowed: false, reason: 'É necessário atribuir um responsável' };
    }
  }

  if (newStatus === 'RESOLVIDO') {
    if (actionsCount === 0) {
      return { allowed: false, reason: 'É necessário registrar ao menos uma ação técnica' };
    }
  }

  if (newStatus === 'ENCERRADO') {
    if (!incident.root_cause) {
      return { allowed: false, reason: 'É necessário preencher a causa raiz' };
    }
  }

  return { allowed: true };
}
