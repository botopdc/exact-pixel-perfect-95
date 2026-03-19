// ============================================================================
// HOOK: useNotifications — polling-based notification system
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/hooks/useSession';
import { isInternalUser } from '@/lib/ticketPermissions';
import {
  fetchNotifications,
  fetchUnreadCount,
  markAsRead,
  markAllAsRead,
  type SupportNotification,
} from '@/services/notificationService';

export function useNotifications() {
  const queryClient = useQueryClient();
  const { userId, level } = useSession();
  const enabled = !!userId && isInternalUser(level);

  const { data: notifications = [] } = useQuery({
    queryKey: ['support-notifications', userId],
    queryFn: () => fetchNotifications(userId!),
    enabled,
    refetchInterval: 60_000, // poll every 60s
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['support-notifications-count', userId],
    queryFn: () => fetchUnreadCount(userId!),
    enabled,
    refetchInterval: 30_000, // poll every 30s
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });

  const readMutation = useMutation({
    mutationFn: (id: string) => markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['support-notifications-count'] });
    },
  });

  const readAllMutation = useMutation({
    mutationFn: () => markAllAsRead(userId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['support-notifications-count'] });
    },
  });

  return {
    notifications: notifications as SupportNotification[],
    unreadCount,
    markRead: readMutation.mutate,
    markAllRead: readAllMutation.mutate,
    enabled,
  };
}
