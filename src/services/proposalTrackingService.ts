/**
 * proposalTrackingService - Client for tracking proposal events via Edge Function
 * 
 * Uses Edge Function with Service Role to bypass RLS on proposal_views table.
 */

import { coreSupabase } from '@/integrations/supabase/coreClient';

export type TrackingSource = 
  | 'email_sent'
  | 'link_copied'
  | 'pdf_download'
  | 'view_public'
  | 'view_internal'
  | 'approved'
  | 'rejected'
  | 'contract_generated';

export interface TrackEventParams {
  proposalId: string;
  source: TrackingSource;
  clientEmail?: string;
}

export interface TrackEventResult {
  success: boolean;
  eventId?: string;
  error?: string;
}

/**
 * Track a proposal event (persists to Supabase via Edge Function)
 */
export async function trackProposalEvent(params: TrackEventParams): Promise<TrackEventResult> {
  try {
    console.log('[trackProposalEvent] Tracking:', params);

    const { data, error } = await coreSupabase.functions.invoke('proposal-track', {
      body: params,
    });

    if (error) {
      console.error('[trackProposalEvent] Error:', error);
      return { success: false, error: error.message };
    }

    if (!data?.success) {
      console.error('[trackProposalEvent] API error:', data?.error);
      return { success: false, error: data?.error || 'Unknown error' };
    }

    console.log('[trackProposalEvent] Success:', data.eventId);
    return { success: true, eventId: data.eventId };
  } catch (err: any) {
    console.error('[trackProposalEvent] Exception:', err);
    return { success: false, error: err.message };
  }
}
