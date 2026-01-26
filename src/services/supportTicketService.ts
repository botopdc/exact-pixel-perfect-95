// ============================================================================
// SUPPORT TICKET SERVICE - HTTP calls to Laravel API
// Endpoints: /api/support/tickets/*, /api/admin/sla-policies, /api/admin/reports/tickets
// ============================================================================

import axios, { AxiosInstance } from 'axios';
import {
  SupportTicket,
  SupportTicketFilters,
  SupportTicketListResponse,
  SupportTicketUpdatePayload,
  SupportTicketMessagePayload,
  SupportTicketMessage,
  SLAPolicy,
  SLAPolicyPayload,
  TicketReportFilters,
  TicketReportData,
} from '@/types/supportTicket';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
if (!API_BASE_URL) {
  throw new Error('VITE_API_BASE_URL não está definida. Configure a variável de ambiente.');
}

const AUTH_TOKEN_KEY = 'open_access_token';
const LEGACY_AUTH_TOKEN_KEY = 'open_api_token';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Auth interceptor
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Error interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('[supportTicketService] Unauthorized - token expired or invalid');
    }
    return Promise.reject(error);
  }
);

// ============================================================================
// TICKETS CRUD
// ============================================================================

/**
 * List support tickets with filters
 * GET /api/support/tickets
 */
export async function listSupportTickets(
  filters: SupportTicketFilters = {},
  page = 1,
  perPage = 50
): Promise<SupportTicketListResponse> {
  const params: Record<string, string | number> = {
    __page: page,
    __perPage: perPage,
  };

  // Build filter params
  if (filters.status) {
    params.status = Array.isArray(filters.status) ? filters.status.join(',') : filters.status;
  }
  if (filters.priority) {
    params.priority = Array.isArray(filters.priority) ? filters.priority.join(',') : filters.priority;
  }
  if (filters.impact) {
    params.impact = Array.isArray(filters.impact) ? filters.impact.join(',') : filters.impact;
  }
  if (filters.assigned_team) {
    params.assigned_team = filters.assigned_team;
  }
  if (filters.assigned_to) {
    params.assigned_to_user_id = filters.assigned_to;
  }
  if (filters.client_id) {
    params.client_id = filters.client_id;
  }
  if (filters.resource_type) {
    params.resource_type = filters.resource_type;
  }
  if (filters.date_from) {
    params.date_from = filters.date_from;
  }
  if (filters.date_to) {
    params.date_to = filters.date_to;
  }
  if (filters.search) {
    params.__q = filters.search;
  }

  const response = await apiClient.get<SupportTicketListResponse>('/support/tickets', { params });
  return response.data;
}

/**
 * Get single ticket by ticket_number
 * GET /api/support/tickets/{ticket_number}
 */
export async function getSupportTicket(ticketNumber: string): Promise<SupportTicket> {
  const response = await apiClient.get<SupportTicket>(`/support/tickets/${ticketNumber}`);
  return response.data;
}

/**
 * Update ticket (status, assignment, impact, priority)
 * PATCH /api/support/tickets/{ticket_number}
 */
export async function updateSupportTicket(
  ticketNumber: string,
  payload: SupportTicketUpdatePayload
): Promise<SupportTicket> {
  const response = await apiClient.patch<SupportTicket>(`/support/tickets/${ticketNumber}`, payload);
  return response.data;
}

/**
 * Add message to ticket
 * POST /api/support/tickets/{ticket_number}/messages
 */
export async function addTicketMessage(
  ticketNumber: string,
  payload: SupportTicketMessagePayload
): Promise<SupportTicketMessage> {
  // Use FormData if there are attachments
  if (payload.attachments && payload.attachments.length > 0) {
    const formData = new FormData();
    formData.append('message', payload.message);
    formData.append('is_internal_note', payload.is_internal_note ? '1' : '0');
    payload.attachments.forEach((file, index) => {
      formData.append(`attachments[${index}]`, file);
    });

    const response = await apiClient.post<SupportTicketMessage>(
      `/support/tickets/${ticketNumber}/messages`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000, // Longer timeout for file uploads
      }
    );
    return response.data;
  }

  // Regular JSON request
  const response = await apiClient.post<SupportTicketMessage>(
    `/support/tickets/${ticketNumber}/messages`,
    {
      message: payload.message,
      is_internal_note: payload.is_internal_note,
    }
  );
  return response.data;
}

/**
 * Quick action: Assign ticket to current user
 */
export async function assignToMe(
  ticketNumber: string,
  userId: number
): Promise<SupportTicket> {
  return updateSupportTicket(ticketNumber, { assigned_to_user_id: userId });
}

/**
 * Quick action: Change status
 */
export async function changeStatus(
  ticketNumber: string,
  status: SupportTicket['status']
): Promise<SupportTicket> {
  return updateSupportTicket(ticketNumber, { status });
}

/**
 * Quick action: Escalate to team
 */
export async function escalateToTeam(
  ticketNumber: string,
  team: SupportTicket['assigned_team']
): Promise<SupportTicket> {
  return updateSupportTicket(ticketNumber, { 
    assigned_team: team,
    assigned_to_user_id: null, // Unassign when escalating
  });
}

// ============================================================================
// SLA POLICIES (Admin only)
// ============================================================================

/**
 * List all SLA policies
 * GET /api/admin/sla-policies
 */
export async function listSLAPolicies(): Promise<SLAPolicy[]> {
  const response = await apiClient.get<{ data: SLAPolicy[] }>('/admin/sla-policies');
  return response.data.data || [];
}

/**
 * Get single SLA policy
 * GET /api/admin/sla-policies/{id}
 */
export async function getSLAPolicy(id: number): Promise<SLAPolicy> {
  const response = await apiClient.get<SLAPolicy>(`/admin/sla-policies/${id}`);
  return response.data;
}

/**
 * Create SLA policy
 * POST /api/admin/sla-policies
 */
export async function createSLAPolicy(payload: SLAPolicyPayload): Promise<SLAPolicy> {
  const response = await apiClient.post<SLAPolicy>('/admin/sla-policies', payload);
  return response.data;
}

/**
 * Update SLA policy
 * PUT /api/admin/sla-policies/{id}
 */
export async function updateSLAPolicy(id: number, payload: SLAPolicyPayload): Promise<SLAPolicy> {
  const response = await apiClient.put<SLAPolicy>(`/admin/sla-policies/${id}`, payload);
  return response.data;
}

/**
 * Delete SLA policy
 * DELETE /api/admin/sla-policies/{id}
 */
export async function deleteSLAPolicy(id: number): Promise<void> {
  await apiClient.delete(`/admin/sla-policies/${id}`);
}

// ============================================================================
// REPORTS (Admin only)
// ============================================================================

/**
 * Get ticket reports
 * GET /api/admin/reports/tickets
 */
export async function getTicketReports(filters: TicketReportFilters): Promise<TicketReportData[]> {
  const params: Record<string, string | number> = {
    date_from: filters.date_from,
    date_to: filters.date_to,
  };
  if (filters.group_by) params.group_by = filters.group_by;
  if (filters.team) params.team = filters.team;
  if (filters.client_id) params.client_id = filters.client_id;

  const response = await apiClient.get<{ data: TicketReportData[] }>('/admin/reports/tickets', { params });
  return response.data.data || [];
}

// ============================================================================
// STATS HELPERS
// ============================================================================

export interface SupportTicketStats {
  total: number;
  abertos: number;
  em_andamento: number;
  aguardando_cliente: number;
  p0_count: number;
  sla_breach_count: number;
  unassigned_count: number;
}

/**
 * Calculate stats from ticket list
 */
export function calculateStats(tickets: SupportTicket[]): SupportTicketStats {
  return {
    total: tickets.length,
    abertos: tickets.filter(t => t.status === 'aberto').length,
    em_andamento: tickets.filter(t => t.status === 'em_andamento').length,
    aguardando_cliente: tickets.filter(t => t.status === 'aguardando_cliente').length,
    p0_count: tickets.filter(t => t.priority === 'P0').length,
    sla_breach_count: tickets.filter(t => t.sla.resolution_breached || t.sla.first_response_breached).length,
    unassigned_count: tickets.filter(t => !t.assigned_to_user_id).length,
  };
}

// Export default service object
export const supportTicketService = {
  // Tickets
  listTickets: listSupportTickets,
  getTicket: getSupportTicket,
  updateTicket: updateSupportTicket,
  addMessage: addTicketMessage,
  assignToMe,
  changeStatus,
  escalateToTeam,
  
  // SLA Policies
  listSLAPolicies,
  getSLAPolicy,
  createSLAPolicy,
  updateSLAPolicy,
  deleteSLAPolicy,
  
  // Reports
  getTicketReports,
  
  // Helpers
  calculateStats,
};

export default supportTicketService;
