// ============================================================================
// HOOK: useSupportDashboard — fetches operational KPIs for Atendimentos home
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const AUTH_TOKEN_KEY = 'open_access_token';
const LEGACY_AUTH_TOKEN_KEY = 'open_api_token';

function getToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
}

export interface OnCallShift {
  id: string;
  team: string;
  user_id: number;
  user_name: string;
  user_email: string;
  start_at: string;
  end_at: string | null;
  is_active: boolean;
}

export interface ServiceStatus {
  id: string;
  service_code: string;
  service_name: string;
  status: 'operational' | 'degraded' | 'down' | 'maintenance';
  status_message: string | null;
  source: string;
  updated_at: string;
}

export interface ActiveIncident {
  id: string;
  public_code: string;
  title: string;
  severity: string;
  priority: string;
  created_at: string;
  status: string;
}

export interface DashboardStats {
  open_tickets: number;
  sla_ok: number;
  sla_breached: number;
  critical_count: number;
  avg_first_response_minutes: number;
  avg_resolution_minutes: number;
  queue_distribution: Record<string, number>;
  queue_unassigned: Record<string, number>;
  queue_breached: Record<string, number>;
  oncall_shifts: OnCallShift[];
  active_incidents: ActiveIncident[];
  service_status: ServiceStatus[];
}

async function fetchDashboardStats(): Promise<DashboardStats> {
  const token = getToken();
  const { data, error } = await supabase.functions.invoke('support-dashboard-stats', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: {},
  });

  if (error) throw new Error(error.message || 'Erro ao carregar dashboard');
  if (!data?.success) throw new Error(data?.message || 'Erro ao carregar dashboard');
  return data.data;
}

export function useSupportDashboard() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['support-dashboard-stats'],
    queryFn: fetchDashboardStats,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return {
    stats: data,
    isLoading,
    error,
    refetch,
  };
}
