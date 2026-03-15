// ============================================================================
// SUPPORT TICKET CORE SERVICE - Supabase Edge Functions
// Source of truth: current_queue_id + current_support_level
// ============================================================================

import { supabase } from '@/integrations/supabase/client';
import { authService } from '@/services/authService';

const AUTH_TOKEN_KEY = 'open_access_token';
const LEGACY_AUTH_TOKEN_KEY = 'open_api_token';

function getToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Response types ──────────────────────────────────────────────────────

export interface EdgeResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  meta?: { current_page: number; last_page: number; per_page: number; total: number };
}

// ── Ticket types ────────────────────────────────────────────────────────

export type TicketStatus =
  | 'novo' | 'triagem' | 'em_atendimento'
  | 'aguardando_cliente' | 'aguardando_terceiro'
  | 'resolvido_suporte' | 'encerrado_cs'
  | 'reaberto' | 'cancelado';

export type TicketSeverity = 'S1' | 'S2' | 'S3' | 'S4';
export type TicketPriority = 'critical' | 'high' | 'medium' | 'low';
export type SupportLevel = 'N1' | 'N2' | 'N3';
export type SupportQueue = 'N1' | 'N2' | 'N3' | 'CS';
export type AuthorType = 'client' | 'support' | 'cs' | 'manager' | 'system' | 'integration';
export type OriginChannel = 'portal' | 'internal_portal' | 'zabbix' | 'api' | 'email';

export interface CoreTicket {
  id: string;
  ticket_number: number;
  public_code: string;
  company_id: string | null;
  requester_user_id: string | null;
  requester_level: number | null;
  requester_name: string;
  requester_email: string | null;
  requester_phone: string | null;
  origin_channel: OriginChannel;
  ticket_type: string;
  category: string;
  subcategory: string | null;
  severity: TicketSeverity;
  priority: TicketPriority;
  status: TicketStatus;
  support_level: SupportLevel;
  current_queue: SupportQueue;
  current_queue_id: string | null;
  current_support_level: string;
  service_name: string | null;
  asset_id: string | null;
  asset_label: string | null;
  title: string;
  description: string;
  customer_visible: boolean;
  assigned_to_user_id: string | null;
  assigned_to_name: string | null;
  assigned_at: string | null;
  assigned_team: string | null;
  support_resolved_by: string | null;
  cs_closed_by: string | null;
  resolution_summary: string | null;
  close_reason: string | null;
  sla_policy_id: string | null;
  first_response_due_at: string | null;
  resolution_due_at: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  last_customer_message_at: string | null;
  last_internal_update_at: string | null;
  source_system: string | null;
  external_reference: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Enriched by Edge Functions
  queue_code?: string;
  queue_name?: string;
}

export interface CoreTicketMessage {
  id: string;
  ticket_id: string;
  author_user_id: string | null;
  author_level: number | null;
  author_name: string;
  author_email: string | null;
  author_type: AuthorType;
  is_internal_note: boolean;
  body: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CoreTicketStatusHistory {
  id: string;
  ticket_id: string;
  old_status: string | null;
  new_status: string;
  changed_by_user_id: string | null;
  changed_by_name: string | null;
  reason: string | null;
  created_at: string;
}

export interface CoreTicketAssignment {
  id: string;
  ticket_id: string;
  from_user_name: string | null;
  to_user_name: string | null;
  from_queue: string | null;
  to_queue: string | null;
  reason: string | null;
  assigned_by_name: string | null;
  created_at: string;
}

export interface CoreTicketAttachment {
  id: string;
  ticket_id: string;
  original_filename: string;
  mime_type: string | null;
  file_size: number | null;
  is_internal: boolean;
  created_at: string;
  uploaded_by_name: string | null;
  storage_path: string;
  signed_url?: string;
}

export interface CoreTicketQueueHistory {
  id: string;
  ticket_id: string;
  from_queue_id: string | null;
  to_queue_id: string;
  from_support_level: string | null;
  to_support_level: string;
  from_queue_code?: string | null;
  from_queue_name?: string | null;
  to_queue_code?: string;
  to_queue_name?: string;
  changed_by_name: string | null;
  reason: string | null;
  created_at: string;
}

export interface CoreTicketDetail extends CoreTicket {
  messages: CoreTicketMessage[];
  status_history: CoreTicketStatusHistory[];
  assignments: CoreTicketAssignment[];
  attachments: CoreTicketAttachment[];
  queue_history?: CoreTicketQueueHistory[];
  sla?: {
    is_first_response_breached: boolean;
    is_resolution_breached: boolean;
    sla_first_response_remaining_seconds: number | null;
    sla_resolution_remaining_seconds: number | null;
  };
  permissions?: Record<string, boolean>;
}

// ── Queue types ─────────────────────────────────────────────────────────

export interface SupportQueueRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  queue_type: string;
  is_active: boolean;
  sort_order: number;
}

export interface QueueMember {
  id: string;
  queue_id: string;
  user_id: number;
  user_name: string;
  user_email: string;
  user_level: number;
  is_primary: boolean;
  can_receive_auto_assign: boolean;
  is_active: boolean;
  support_queues?: { code: string; name: string };
}

export interface AnalystCapacitySummary {
  name: string;
  email: string;
  user_id: number;
  level: number;
  queues: {
    queue_id: string;
    queue_code: string;
    queue_name: string;
    is_primary: boolean;
    is_active: boolean;
    member_id: string;
  }[];
  active_tickets: number;
  breached_tickets: number;
  resolved_today: number;
  avg_first_response_minutes: number | null;
  avg_resolution_minutes: number | null;
  is_oncall: boolean;
  oncall_team: string | null;
}

// ── Filters ─────────────────────────────────────────────────────────────

export interface TicketListFilters {
  status?: string;
  current_queue?: string;
  current_queue_id?: string;
  assigned_to_user_id?: string;
  severity?: string;
  priority?: string;
  ticket_type?: string;
  category?: string;
  company_id?: string;
  requester_name?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  only_mine?: boolean;
  only_unassigned?: boolean;
  only_sla_breached?: boolean;
  page?: number;
  per_page?: number;
  order_by?: string;
  order_dir?: 'asc' | 'desc';
  // Injected by hooks
  user_level?: number;
  user_id?: string;
  user_email?: string;
}

// ── Create payload ──────────────────────────────────────────────────────

export interface CreateTicketPayload {
  requester_name: string;
  requester_email?: string;
  requester_phone?: string;
  requester_user_id?: string;
  requester_level?: number;
  company_id?: string;
  ticket_type: string;
  category: string;
  subcategory?: string;
  severity: TicketSeverity;
  title: string;
  description: string;
  service_name?: string;
  asset_id?: string;
  asset_label?: string;
  origin_channel?: OriginChannel;
}

// ── Action payloads ─────────────────────────────────────────────────────

export type TicketAction =
  | 'assign' | 'start' | 'transfer' | 'escalate'
  | 'wait_customer' | 'wait_third_party'
  | 'resolve' | 'close' | 'reopen' | 'cancel';

export interface TicketActionPayload {
  ticket_id: string;
  action: TicketAction;
  actor_user_id?: string;
  actor_name?: string;
  actor_level?: number;
  assigned_to_user_id?: string;
  assigned_to_name?: string;
  to_user_id?: string;
  to_user_name?: string;
  to_user_level?: number;
  to_queue?: string;
  target_level?: 'N2' | 'N3';
  reason?: string;
}

// ── Message payload ─────────────────────────────────────────────────────

export interface AddMessagePayload {
  ticket_id: string;
  body: string;
  is_internal_note: boolean;
  author_name: string;
  author_email?: string;
  author_user_id?: string;
  author_level?: number;
  author_type?: AuthorType;
}

export interface UploadAttachmentResult {
  id: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  is_internal: boolean;
  storage_path: string;
  signed_url?: string;
}

export interface CoreSLAPolicy {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  ticket_type: string | null;
  category: string | null;
  severity: string | null;
  customer_plan: string | null;
  business_hours_only: boolean;
  first_response_minutes: number;
  resolution_minutes: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ── Edge Function Caller ────────────────────────────────────────────────

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<EdgeResponse<T>> {
  const token = getToken();
  console.log(`[supportTicketCore] invoke ${fn}`, {
    hasToken: !!token,
    tokenLen: token?.length,
    bodyKeys: Object.keys(body),
  });

  const { data, error } = await supabase.functions.invoke(fn, {
    body,
    headers: authHeaders(),
  });

  if (error) {
    console.error(`[supportTicketCore] ${fn} error:`, error);
    const errMsg = error.message || `Erro ao chamar ${fn}`;
    const enrichedError = new Error(errMsg);
    (enrichedError as any).status = error.status;
    throw enrichedError;
  }

  console.log(`[supportTicketCore] ${fn} raw response type:`, typeof data, data ? Object.keys(data) : 'null');

  const resp = data as EdgeResponse<T>;
  if (!resp.success) {
    console.error(`[supportTicketCore] ${fn} not success:`, resp);
    const errMsg = resp.message || resp.errors?.join(', ') || 'Erro desconhecido';
    const enrichedError = new Error(errMsg);
    (enrichedError as any).debug = (resp as any).debug;
    throw enrichedError;
  }

  const resultCount = Array.isArray(resp.data) ? resp.data.length : (resp.data ? 1 : 0);
  console.log(`[supportTicketCore] ${fn} success — items: ${resultCount}, meta:`, resp.meta);

  return resp;
}

// ── Queue user context (standalone to avoid `this` issues in object literal) ──

function getQueueUserContext(): {
  actor_user_id?: string;
  actor_level: number;
  actor_email?: string;
  actor_name?: string;
} {
  const session = authService.getSession();
  if (session) {
    const numericId = session.apiUser?.id
      ? String(session.apiUser.id)
      : (/^\d+$/.test(session.userId) ? session.userId : undefined);
    return {
      actor_user_id: numericId,
      actor_level: session.level ?? 0,
      actor_email: session.email,
      actor_name: session.name,
    };
  }
  try {
    const raw = localStorage.getItem('open_user');
    if (raw) {
      const u = JSON.parse(raw);
      return {
        actor_user_id: u?.id ? String(u.id) : undefined,
        actor_level: Number(u?.level) || 0,
        actor_email: u?.email,
        actor_name: u?.name,
      };
    }
  } catch { /* ignore */ }
  return { actor_level: 0 };
}

// ── Service Methods ─────────────────────────────────────────────────────

export const supportTicketCoreService = {
  async createTicket(payload: CreateTicketPayload): Promise<CoreTicket> {
    const resp = await invoke<CoreTicket>('support-ticket-create', payload as unknown as Record<string, unknown>);
    return resp.data!;
  },

  async listTickets(filters: TicketListFilters = {}): Promise<{ tickets: CoreTicket[]; meta: EdgeResponse['meta'] }> {
    const resp = await invoke<CoreTicket[]>('support-ticket-list', filters as unknown as Record<string, unknown>);
    return { tickets: resp.data || [], meta: resp.meta };
  },

  async getTicket(ticketId: string, userLevel?: number, userId?: string): Promise<CoreTicketDetail> {
    const resp = await invoke<CoreTicketDetail>('support-ticket-get', {
      ticket_id: ticketId,
      user_level: userLevel,
      user_id: userId,
    });
    return resp.data!;
  },

  async updateTicket(payload: TicketActionPayload): Promise<CoreTicket> {
    const resp = await invoke<CoreTicket>('support-ticket-update', payload as unknown as Record<string, unknown>);
    return resp.data!;
  },

  async addMessage(payload: AddMessagePayload): Promise<CoreTicketMessage> {
    const resp = await invoke<CoreTicketMessage>('support-ticket-messages', payload as unknown as Record<string, unknown>);
    return resp.data!;
  },

  async uploadAttachment(
    ticketId: string, file: File, isInternal: boolean = false,
    uploaderName?: string, uploaderUserId?: string, uploaderLevel?: number
  ): Promise<UploadAttachmentResult> {
    const token = getToken();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('ticket_id', ticketId);
    formData.append('is_internal', String(isInternal));
    if (uploaderName) formData.append('uploader_name', uploaderName);
    if (uploaderUserId) formData.append('uploader_user_id', uploaderUserId);
    if (uploaderLevel !== undefined) formData.append('uploader_level', String(uploaderLevel));

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const url = `https://${projectId}.supabase.co/functions/v1/support-ticket-upload`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: formData,
    });

    const result = await response.json();
    if (!result.success) throw new Error(result.message || 'Erro ao enviar anexo');
    return result.data;
  },

  async getAttachmentUrl(attachmentId: string, ticketId: string): Promise<string> {
    const resp = await invoke<{ signed_url: string }>('support-ticket-upload', {
      action: 'get_url', attachment_id: attachmentId, ticket_id: ticketId,
    });
    return resp.data!.signed_url;
  },

  async listQueues(): Promise<SupportQueueRecord[]> {
    const ctx = getQueueUserContext();
    const resp = await invoke<SupportQueueRecord[]>('support-queue-admin', {
      action: 'list_queues',
      ...ctx,
    });
    return resp.data || [];
  },

  async listQueueMembers(queueId?: string, queueCode?: string): Promise<QueueMember[]> {
    const ctx = getQueueUserContext();
    const resp = await invoke<QueueMember[]>('support-queue-admin', {
      action: 'list_members', queue_id: queueId, queue_code: queueCode,
      ...ctx,
    });
    return resp.data || [];
  },

  async getMyQueues(userId: string): Promise<QueueMember[]> {
    const ctx = getQueueUserContext();
    const resp = await invoke<QueueMember[]>('support-queue-admin', {
      action: 'my_queues', user_id: userId || ctx.actor_user_id,
      ...ctx,
    });
    return resp.data || [];
  },

  async listAnalystCapacitySummary(): Promise<AnalystCapacitySummary[]> {
    const ctx = getQueueUserContext();
    const resp = await invoke<AnalystCapacitySummary[]>('support-queue-admin', {
      action: 'list_analyst_summary',
      ...ctx,
    });
    return resp.data || [];
  },

  async addQueueMember(payload: {
    queue_id: string; user_id: string; user_name: string;
    user_email: string; user_level?: number; is_primary?: boolean;
  }): Promise<QueueMember> {
    const ctx = getQueueUserContext();
    const resp = await invoke<QueueMember>('support-queue-admin', {
      action: 'add_member', ...payload,
      ...ctx,
    });
    return resp.data!;
  },

  async removeQueueMember(memberId: string): Promise<void> {
    const ctx = getQueueUserContext();
    await invoke('support-queue-admin', {
      action: 'remove_member', member_id: memberId,
      ...ctx,
    });
  },

  async toggleQueueMember(memberId: string): Promise<QueueMember> {
    const ctx = getQueueUserContext();
    const resp = await invoke<QueueMember>('support-queue-admin', {
      action: 'toggle_member', member_id: memberId,
      ...ctx,
    });
    return resp.data!;
  },

  // SLA Policies
  async listSlaPolicies(): Promise<CoreSLAPolicy[]> {
    const resp = await invoke<CoreSLAPolicy[]>('support-sla-admin', { action: 'list' });
    return resp.data || [];
  },

  async createSlaPolicy(policy: Partial<CoreSLAPolicy>): Promise<CoreSLAPolicy> {
    const resp = await invoke<CoreSLAPolicy>('support-sla-admin', { action: 'create', ...policy });
    return resp.data!;
  },

  async updateSlaPolicy(id: string, policy: Partial<CoreSLAPolicy>): Promise<CoreSLAPolicy> {
    const resp = await invoke<CoreSLAPolicy>('support-sla-admin', { action: 'update', id, ...policy });
    return resp.data!;
  },

  async deleteSlaPolicy(id: string): Promise<void> {
    await invoke('support-sla-admin', { action: 'delete', id });
  },
};
