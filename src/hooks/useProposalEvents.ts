import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Event types matching proposal_views.source values
export type ProposalEventType =
  | 'view_public'
  | 'view_internal'
  | 'link_copied'
  | 'email_sent'
  | 'pdf_download'
  | 'approved'
  | 'rejected';

export interface ProposalEvent {
  id: string;
  proposalId: string;
  type: ProposalEventType;
  timestamp: string;
  clientEmail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface ProposalEventStats {
  totalViews: number;
  publicViews: number;
  internalViews: number;
  linkCopies: number;
  emailsSent: number;
  pdfDownloads: number;
  accepted: boolean;
  rejected: boolean;
  lastActivity: ProposalEvent | null;
  timeline: ProposalEvent[];
}

function mapRow(row: any): ProposalEvent {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    type: row.source as ProposalEventType,
    timestamp: row.viewed_at,
    clientEmail: row.client_email,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
  };
}

// Fetch events via Edge Function (bypasses RLS)
async function fetchEvents(proposalId: string): Promise<ProposalEvent[]> {
  const { data, error } = await supabase.functions.invoke('proposal-track', {
    body: { action: 'list', proposalId },
  });

  if (error) {
    console.error('[useProposalEvents] edge function error:', error);
    return [];
  }

  if (!data?.success) {
    console.error('[useProposalEvents] API error:', data?.error);
    return [];
  }

  return (data.events || []).map(mapRow);
}

function buildStats(events: ProposalEvent[]): ProposalEventStats {
  const publicViews = events.filter(e => e.type === 'view_public').length;
  const internalViews = events.filter(e => e.type === 'view_internal').length;

  return {
    totalViews: publicViews + internalViews,
    publicViews,
    internalViews,
    linkCopies: events.filter(e => e.type === 'link_copied').length,
    emailsSent: events.filter(e => e.type === 'email_sent').length,
    pdfDownloads: events.filter(e => e.type === 'pdf_download').length,
    accepted: events.some(e => e.type === 'approved'),
    rejected: events.some(e => e.type === 'rejected'),
    lastActivity: events[0] || null,
    timeline: events.slice(0, 50),
  };
}

export function useProposalEvents(proposalId: string | null) {
  return useQuery({
    queryKey: ['proposal-events', proposalId],
    queryFn: () => fetchEvents(proposalId!),
    enabled: !!proposalId,
    staleTime: 1000 * 30,
  });
}

export function useProposalEventStats(proposalId: string | null) {
  return useQuery({
    queryKey: ['proposal-event-stats', proposalId],
    queryFn: async () => {
      if (!proposalId) return null;
      const events = await fetchEvents(proposalId);
      return buildStats(events);
    },
    enabled: !!proposalId,
    staleTime: 1000 * 30,
  });
}

// Labels in Portuguese
export function getEventTypeLabel(type: ProposalEventType): string {
  const labels: Record<ProposalEventType, string> = {
    view_public: 'Visualização (Cliente)',
    view_internal: 'Visualização (Interna)',
    link_copied: 'Link Copiado',
    email_sent: 'Email Enviado',
    approved: 'Proposta Aceita',
    rejected: 'Proposta Recusada',
    pdf_download: 'PDF Baixado',
  };
  return labels[type] || type;
}

// Colors for UI
export function getEventTypeColor(type: ProposalEventType): string {
  const colors: Record<ProposalEventType, string> = {
    view_public: 'text-blue-500',
    view_internal: 'text-slate-500',
    link_copied: 'text-purple-500',
    email_sent: 'text-cyan-500',
    approved: 'text-green-500',
    rejected: 'text-red-500',
    pdf_download: 'text-orange-500',
  };
  return colors[type] || 'text-muted-foreground';
}
