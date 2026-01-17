// ============================================================================
// TECHNICAL OPERATIONS CENTER - SERVICE
// ============================================================================

import { supabase } from '@/integrations/supabase/client';
import type {
  TechUser,
  TechClient,
  TechAsset,
  TechCredential,
  TechOnCallShift,
  TechIncident,
  TechIncidentAction,
  TechIncidentRootCause,
  TechRole,
  ClientStatus,
  SLALevel,
  AssetType,
  AssetEnvironment,
  AssetStatus,
  CredentialType,
  CredentialVisibility,
  OnCallLevel,
  IncidentOrigin,
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
  RootCauseCategory,
} from '@/types/techOps';

// ============================================================================
// TECH USERS
// ============================================================================

export async function getTechUsers(filters?: { role?: TechRole; is_active?: boolean }) {
  let query = supabase.from('tech_users').select('*').order('name');
  
  if (filters?.role) query = query.eq('role', filters.role);
  if (filters?.is_active !== undefined) query = query.eq('is_active', filters.is_active);
  
  const { data, error } = await query;
  if (error) throw error;
  return data as TechUser[];
}

export async function getTechUser(id: string) {
  const { data, error } = await supabase
    .from('tech_users')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as TechUser | null;
}

export async function createTechUser(user: Omit<TechUser, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase.from('tech_users').insert(user).select().single();
  if (error) throw error;
  return data as TechUser;
}

export async function updateTechUser(id: string, user: Partial<TechUser>) {
  const { data, error } = await supabase.from('tech_users').update(user).eq('id', id).select().single();
  if (error) throw error;
  return data as TechUser;
}

// ============================================================================
// TECH CLIENTS
// ============================================================================

export async function getTechClients(filters?: { status?: ClientStatus; sla_level?: SLALevel }) {
  let query = supabase
    .from('tech_clients')
    .select('*, cs_manager:tech_users!cs_manager_id(id, name, email)')
    .order('razao_social');
  
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.sla_level) query = query.eq('sla_level', filters.sla_level);
  
  const { data, error } = await query;
  if (error) throw error;
  return data as TechClient[];
}

export async function getTechClient(id: string) {
  const { data, error } = await supabase
    .from('tech_clients')
    .select('*, cs_manager:tech_users!cs_manager_id(id, name, email)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as TechClient | null;
}

export async function createTechClient(client: Omit<TechClient, 'id' | 'created_at' | 'updated_at' | 'cs_manager'>) {
  const { data, error } = await supabase.from('tech_clients').insert(client).select().single();
  if (error) throw error;
  return data as TechClient;
}

export async function updateTechClient(id: string, client: Partial<TechClient>) {
  const { cs_manager, ...updateData } = client;
  const { data, error } = await supabase.from('tech_clients').update(updateData).eq('id', id).select().single();
  if (error) throw error;
  return data as TechClient;
}

// ============================================================================
// TECH ASSETS
// ============================================================================

export async function getTechAssets(filters?: { client_id?: string; tipo?: AssetType; status?: AssetStatus }) {
  let query = supabase
    .from('tech_assets')
    .select('*, client:tech_clients!client_id(id, razao_social, nome_fantasia)')
    .order('identificador');
  
  if (filters?.client_id) query = query.eq('client_id', filters.client_id);
  if (filters?.tipo) query = query.eq('tipo', filters.tipo);
  if (filters?.status) query = query.eq('status', filters.status);
  
  const { data, error } = await query;
  if (error) throw error;
  return data as TechAsset[];
}

export async function getTechAsset(id: string) {
  const { data, error } = await supabase
    .from('tech_assets')
    .select('*, client:tech_clients!client_id(id, razao_social, nome_fantasia, sla_level)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as TechAsset | null;
}

export async function createTechAsset(asset: Omit<TechAsset, 'id' | 'created_at' | 'updated_at' | 'client'>) {
  const { data, error } = await supabase.from('tech_assets').insert(asset).select().single();
  if (error) throw error;
  return data as TechAsset;
}

export async function updateTechAsset(id: string, asset: Partial<TechAsset>) {
  const { client, ...updateData } = asset;
  const { data, error } = await supabase.from('tech_assets').update(updateData).eq('id', id).select().single();
  if (error) throw error;
  return data as TechAsset;
}

// ============================================================================
// TECH CREDENTIALS
// ============================================================================

export async function getTechCredentials(assetId: string) {
  const { data, error } = await supabase
    .from('tech_credentials')
    .select('*')
    .eq('asset_id', assetId)
    .order('cred_type');
  if (error) throw error;
  return data as TechCredential[];
}

export async function createTechCredential(credential: Omit<TechCredential, 'id' | 'created_at' | 'updated_at' | 'asset'>) {
  const { data, error } = await supabase.from('tech_credentials').insert(credential).select().single();
  if (error) throw error;
  return data as TechCredential;
}

export async function updateTechCredential(id: string, credential: Partial<TechCredential>) {
  const { asset, ...updateData } = credential;
  const { data, error } = await supabase.from('tech_credentials').update(updateData).eq('id', id).select().single();
  if (error) throw error;
  return data as TechCredential;
}

export async function deleteTechCredential(id: string) {
  const { error } = await supabase.from('tech_credentials').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================================
// ON-CALL SHIFTS
// ============================================================================

export async function getOnCallShifts(filters?: { is_active?: boolean; level?: OnCallLevel }) {
  let query = supabase
    .from('tech_on_call_shifts')
    .select('*, user:tech_users!user_id(id, name, email, role)')
    .order('start_at', { ascending: false });
  
  if (filters?.is_active !== undefined) query = query.eq('is_active', filters.is_active);
  if (filters?.level) query = query.eq('level', filters.level);
  
  const { data, error } = await query;
  if (error) throw error;
  return data as TechOnCallShift[];
}

export async function getCurrentOnCallUsers() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('tech_on_call_shifts')
    .select('*, user:tech_users!user_id(id, name, email, role)')
    .eq('is_active', true)
    .lte('start_at', now)
    .gte('end_at', now);
  if (error) throw error;
  return data as TechOnCallShift[];
}

export async function createOnCallShift(shift: Omit<TechOnCallShift, 'id' | 'created_at' | 'updated_at' | 'user'>) {
  const { data, error } = await supabase.from('tech_on_call_shifts').insert(shift).select().single();
  if (error) throw error;
  return data as TechOnCallShift;
}

export async function updateOnCallShift(id: string, shift: Partial<TechOnCallShift>) {
  const { user, ...updateData } = shift;
  const { data, error } = await supabase.from('tech_on_call_shifts').update(updateData).eq('id', id).select().single();
  if (error) throw error;
  return data as TechOnCallShift;
}

// ============================================================================
// INCIDENTS
// ============================================================================

export async function getIncidents(filters?: {
  status?: IncidentStatus | IncidentStatus[];
  severidade?: IncidentSeverity;
  client_id?: string;
  owner_user_id?: string;
}) {
  let query = supabase
    .from('tech_incidents')
    .select(`
      *,
      client:tech_clients!client_id(id, razao_social, nome_fantasia, sla_level),
      asset:tech_assets!asset_id(id, identificador, tipo, ip_principal),
      owner:tech_users!owner_user_id(id, name, email, role)
    `)
    .order('opened_at', { ascending: false });
  
  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query = query.in('status', filters.status);
    } else {
      query = query.eq('status', filters.status);
    }
  }
  if (filters?.severidade) query = query.eq('severidade', filters.severidade);
  if (filters?.client_id) query = query.eq('client_id', filters.client_id);
  if (filters?.owner_user_id) query = query.eq('owner_user_id', filters.owner_user_id);
  
  const { data, error } = await query;
  if (error) throw error;
  return data as TechIncident[];
}

export async function getIncident(id: string) {
  const { data, error } = await supabase
    .from('tech_incidents')
    .select(`
      *,
      client:tech_clients!client_id(id, razao_social, nome_fantasia, sla_level),
      asset:tech_assets!asset_id(id, identificador, tipo, ip_principal),
      owner:tech_users!owner_user_id(id, name, email, role)
    `)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as TechIncident | null;
}

export async function createIncident(incident: {
  client_id: string;
  asset_id?: string | null;
  origin_channel: IncidentOrigin;
  tipo: IncidentType;
  severidade?: IncidentSeverity;
  sla_level_aplicado: SLALevel;
  title: string;
  description?: string | null;
}) {
  const { data, error } = await supabase
    .from('tech_incidents')
    .insert({
      ...incident,
      status: 'ABERTO' as IncidentStatus,
    })
    .select()
    .single();
  if (error) throw error;
  return data as TechIncident;
}

export async function updateIncident(id: string, incident: Partial<TechIncident>) {
  const { client, asset, owner, actions, root_cause, ...updateData } = incident;
  const { data, error } = await supabase.from('tech_incidents').update(updateData).eq('id', id).select().single();
  if (error) throw error;
  return data as TechIncident;
}

// ============================================================================
// INCIDENT ACTIONS
// ============================================================================

export async function getIncidentActions(incidentId: string) {
  const { data, error } = await supabase
    .from('tech_incident_actions')
    .select('*, user:tech_users!user_id(id, name, email)')
    .eq('incident_id', incidentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as TechIncidentAction[];
}

export async function createIncidentAction(action: {
  incident_id: string;
  user_id?: string | null;
  action_type: 'comment' | 'status_change' | 'assignment' | 'escalation';
  action_text: string;
  metadata?: Record<string, unknown> | null;
}) {
  // Cast to any to bypass strict typing - Supabase types are auto-generated
  const insertData: Record<string, unknown> = {
    incident_id: action.incident_id,
    user_id: action.user_id || null,
    action_type: action.action_type,
    action_text: action.action_text,
    metadata: action.metadata || null,
  };
  const { data, error } = await supabase.from('tech_incident_actions').insert(insertData as never).select().single();
  if (error) throw error;
  return data as TechIncidentAction;
}

// ============================================================================
// INCIDENT ROOT CAUSE
// ============================================================================

export async function getIncidentRootCause(incidentId: string) {
  const { data, error } = await supabase
    .from('tech_incident_root_cause')
    .select('*')
    .eq('incident_id', incidentId)
    .maybeSingle();
  if (error) throw error;
  return data as TechIncidentRootCause | null;
}

export async function createIncidentRootCause(rootCause: {
  incident_id: string;
  category: RootCauseCategory;
  details: string;
}) {
  const { data, error } = await supabase.from('tech_incident_root_cause').insert(rootCause).select().single();
  if (error) throw error;
  return data as TechIncidentRootCause;
}

export async function updateIncidentRootCause(id: string, rootCause: Partial<TechIncidentRootCause>) {
  const { data, error } = await supabase.from('tech_incident_root_cause').update(rootCause).eq('id', id).select().single();
  if (error) throw error;
  return data as TechIncidentRootCause;
}

// ============================================================================
// DASHBOARD STATS
// ============================================================================

export async function getIncidentStats() {
  const { data, error } = await supabase
    .from('tech_incidents')
    .select('status, severidade');
  if (error) throw error;

  const incidents = data as { status: IncidentStatus; severidade: IncidentSeverity }[];
  
  return {
    total: incidents.length,
    abertos: incidents.filter(i => i.status === 'ABERTO').length,
    em_atendimento: incidents.filter(i => i.status === 'EM_ATENDIMENTO').length,
    escalados: incidents.filter(i => i.status === 'ESCALADO').length,
    resolvidos: incidents.filter(i => i.status === 'RESOLVIDO').length,
    s1_ativos: incidents.filter(i => i.severidade === 'S1' && !['RESOLVIDO', 'ENCERRADO'].includes(i.status)).length,
    s2_ativos: incidents.filter(i => i.severidade === 'S2' && !['RESOLVIDO', 'ENCERRADO'].includes(i.status)).length,
  };
}

export async function getClientStats() {
  const { data, error } = await supabase
    .from('tech_clients')
    .select('status');
  if (error) throw error;
  
  const clients = data as { status: ClientStatus }[];
  
  return {
    total: clients.length,
    ativos: clients.filter(c => c.status === 'ATIVO').length,
    suspensos: clients.filter(c => c.status === 'SUSPENSO').length,
    encerrados: clients.filter(c => c.status === 'ENCERRADO').length,
  };
}

export async function getAssetStats() {
  const { data, error } = await supabase
    .from('tech_assets')
    .select('tipo, status');
  if (error) throw error;
  
  const assets = data as { tipo: AssetType; status: AssetStatus }[];
  
  return {
    total: assets.length,
    ativos: assets.filter(a => a.status === 'ATIVO').length,
    manutencao: assets.filter(a => a.status === 'MANUTENCAO').length,
    por_tipo: {
      VM: assets.filter(a => a.tipo === 'VM').length,
      BAREMETAL: assets.filter(a => a.tipo === 'BAREMETAL').length,
      GPU: assets.filter(a => a.tipo === 'GPU').length,
      KUBERNETES: assets.filter(a => a.tipo === 'KUBERNETES').length,
      STORAGE: assets.filter(a => a.tipo === 'STORAGE').length,
    },
  };
}
