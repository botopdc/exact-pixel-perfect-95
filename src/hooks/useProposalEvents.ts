import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Event types
export type ProposalEventType = 
  | 'view_public' 
  | 'view_internal' 
  | 'link_copy' 
  | 'email_send' 
  | 'accept' 
  | 'reject' 
  | 'pdf_download'
  | 'edit_open';

export interface ProposalEvent {
  id: string;
  proposalId: string;
  type: ProposalEventType;
  timestamp: string;
  channel: 'public_url' | 'ui' | 'email' | 'copied_link';
  userAgent?: string;
  referrer?: string;
  token?: string;
  metadata?: Record<string, any>;
}

// LocalStorage key for events
const EVENTS_KEY = 'open_proposal_events_v1';

// Generate unique ID
function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Get all events from localStorage
function getLocalEvents(): ProposalEvent[] {
  try {
    const stored = localStorage.getItem(EVENTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save events to localStorage
function saveLocalEvents(events: ProposalEvent[]): void {
  // Keep max 5000 events to avoid bloating localStorage
  const trimmed = events.slice(0, 5000);
  localStorage.setItem(EVENTS_KEY, JSON.stringify(trimmed));
}

// Get events for a specific proposal
export function getEventsForProposal(proposalId: string): ProposalEvent[] {
  return getLocalEvents().filter(e => e.proposalId === proposalId);
}

// Hook to fetch events for a proposal
export function useProposalEvents(proposalId: string | null) {
  return useQuery({
    queryKey: ['proposal-events', proposalId],
    queryFn: () => {
      if (!proposalId) return [];
      return getEventsForProposal(proposalId);
    },
    enabled: !!proposalId,
    staleTime: 1000 * 30, // 30 seconds
  });
}

// Hook to track/create an event
export function useTrackEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eventData: Omit<ProposalEvent, 'id' | 'timestamp'>) => {
      const event: ProposalEvent = {
        ...eventData,
        id: generateEventId(),
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        referrer: typeof document !== 'undefined' ? document.referrer : undefined,
      };

      const existing = getLocalEvents();
      existing.unshift(event);
      saveLocalEvents(existing);

      return Promise.resolve(event);
    },
    onSuccess: (event) => {
      queryClient.invalidateQueries({ queryKey: ['proposal-events', event.proposalId] });
    },
  });
}

// Get event statistics for a proposal
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

export function getEventStats(proposalId: string): ProposalEventStats {
  const events = getEventsForProposal(proposalId);
  
  const publicViews = events.filter(e => e.type === 'view_public').length;
  const internalViews = events.filter(e => e.type === 'view_internal').length;
  
  return {
    totalViews: publicViews + internalViews,
    publicViews,
    internalViews,
    linkCopies: events.filter(e => e.type === 'link_copy').length,
    emailsSent: events.filter(e => e.type === 'email_send').length,
    pdfDownloads: events.filter(e => e.type === 'pdf_download').length,
    accepted: events.some(e => e.type === 'accept'),
    rejected: events.some(e => e.type === 'reject'),
    lastActivity: events[0] || null,
    timeline: events.slice(0, 50), // Last 50 events
  };
}

export function useProposalEventStats(proposalId: string | null) {
  return useQuery({
    queryKey: ['proposal-event-stats', proposalId],
    queryFn: () => {
      if (!proposalId) return null;
      return getEventStats(proposalId);
    },
    enabled: !!proposalId,
    staleTime: 1000 * 30,
  });
}

// Utility: get event type label in Portuguese
export function getEventTypeLabel(type: ProposalEventType): string {
  const labels: Record<ProposalEventType, string> = {
    view_public: 'Visualização (Cliente)',
    view_internal: 'Visualização (Interna)',
    link_copy: 'Link Copiado',
    email_send: 'Email Enviado',
    accept: 'Proposta Aceita',
    reject: 'Proposta Recusada',
    pdf_download: 'PDF Baixado',
    edit_open: 'Edição Iniciada',
  };
  return labels[type] || type;
}

// Utility: get event type color for UI
export function getEventTypeColor(type: ProposalEventType): string {
  const colors: Record<ProposalEventType, string> = {
    view_public: 'text-blue-500',
    view_internal: 'text-slate-500',
    link_copy: 'text-purple-500',
    email_send: 'text-cyan-500',
    accept: 'text-green-500',
    reject: 'text-red-500',
    pdf_download: 'text-orange-500',
    edit_open: 'text-yellow-500',
  };
  return colors[type] || 'text-muted-foreground';
}
