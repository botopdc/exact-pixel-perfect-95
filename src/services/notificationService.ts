// ============================================================================
// NOTIFICATION SERVICE — minimal notifications for support tickets
// ============================================================================

import { supabase } from '@/integrations/supabase/client';

export interface SupportNotification {
  id: string;
  user_id: string;
  ticket_id: string | null;
  ticket_public_code: string | null;
  event_name: string;
  title: string;
  body: string | null;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Fetch unread notifications for internal user via Edge Function
 */
export async function fetchNotifications(userId: string, limit = 30): Promise<SupportNotification[]> {
  const { data, error } = await supabase
    .from('support_notifications' as any)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[notifications] fetch error:', error);
    return [];
  }
  return (data || []) as unknown as SupportNotification[];
}

export async function fetchUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('support_notifications' as any)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('[notifications] count error:', error);
    return 0;
  }
  return count || 0;
}

export async function markAsRead(notificationId: string): Promise<void> {
  await supabase
    .from('support_notifications' as any)
    .update({ is_read: true } as any)
    .eq('id', notificationId);
}

export async function markAllAsRead(userId: string): Promise<void> {
  await supabase
    .from('support_notifications' as any)
    .update({ is_read: true } as any)
    .eq('user_id', userId)
    .eq('is_read', false);
}

/**
 * Create a notification (called from Edge Functions or service layer)
 * This is a helper for frontend-side notification creation when needed
 */
export async function createNotification(params: {
  user_id: string;
  user_level?: number;
  ticket_id?: string;
  ticket_public_code?: string;
  event_name: string;
  title: string;
  body?: string;
}): Promise<void> {
  await supabase
    .from('support_notifications' as any)
    .insert({
      user_id: params.user_id,
      user_level: params.user_level,
      ticket_id: params.ticket_id,
      ticket_public_code: params.ticket_public_code,
      event_name: params.event_name,
      title: params.title,
      body: params.body,
    } as any);
}
