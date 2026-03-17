// ============================================================================
// HOOKS: useSupportTicketCore — Supabase-first with role-based permissions
// Source of truth: useAuth() → profile + roles
// Fallback: authService (legacy) only when no Supabase session
// ============================================================================

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  supportTicketCoreService,
  TicketListFilters,
  CreateTicketPayload,
  TicketActionPayload,
  AddMessagePayload,
  CoreTicket,
  CoreTicketDetail,
  SupportQueueRecord,
  QueueMember,
} from '@/services/supportTicketCoreService';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@/services/authService';
import { getTicketPermissionsFromRoles, getTicketPermissions } from '@/lib/ticketPermissions';

// ── Unified session context ─────────────────────────────────────────────

function useSessionContext() {
  const { profile, roles, session } = useAuth();

  // If Supabase session exists, use it
  if (session && profile) {
    return {
      userId: profile.id,
      name: profile.name,
      email: profile.email,
      level: profile.level,
      legacyUserId: profile.legacy_user_id ? String(profile.legacy_user_id) : undefined,
      profile,
      roles,
      source: 'supabase' as const,
    };
  }

  // Fallback to legacy
  const legacySession = authService.getSession();
  if (legacySession) {
    return {
      userId: legacySession.userId,
      name: legacySession.name,
      email: legacySession.email,
      level: legacySession.level,
      legacyUserId: legacySession.userId,
      profile: null,
      roles: null,
      source: 'legacy' as const,
    };
  }

  return {
    userId: undefined as string | undefined,
    name: undefined as string | undefined,
    email: undefined as string | undefined,
    level: 0,
    legacyUserId: undefined as string | undefined,
    profile: null,
    roles: null,
    source: 'none' as const,
  };
}

// ── List hook ───────────────────────────────────────────────────────────

export function useSupportTicketList(filters: TicketListFilters = {}) {
  const queryClient = useQueryClient();
  const ctx = useSessionContext();

  const enrichedFilters: TicketListFilters = {
    ...filters,
    user_level: ctx.level,
    user_id: ctx.legacyUserId || ctx.userId,
    user_email: ctx.email,
  };

  if (import.meta.env.DEV) {
    console.log('[useSupportTicketList] context', {
      source: ctx.source,
      userId: ctx.userId,
      level: ctx.level,
      email: ctx.email,
      filters,
    });
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['support-tickets-core', filters],
    queryFn: async () => {
      const result = await supportTicketCoreService.listTickets(enrichedFilters);
      if (import.meta.env.DEV) {
        console.log('[useSupportTicketList] result:', {
          ticketCount: result.tickets.length,
          meta: result.meta,
        });
      }
      return result;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  return {
    tickets: data?.tickets ?? [],
    meta: data?.meta,
    isLoading,
    error,
    refetch,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ['support-tickets-core'] }),
  };
}

// ── Detail hook ─────────────────────────────────────────────────────────

export function useSupportTicketDetail(ticketId: string | undefined) {
  const queryClient = useQueryClient();
  const ctx = useSessionContext();

  const { data: ticket, isLoading, error, refetch } = useQuery({
    queryKey: ['support-ticket-core', ticketId],
    queryFn: () => supportTicketCoreService.getTicket(ticketId!, ctx.level, ctx.legacyUserId || ctx.userId),
    enabled: !!ticketId,
    staleTime: 0,
  });

  // Role-based permissions (primary) with level fallback
  const permissions = ctx.source === 'supabase'
    ? getTicketPermissionsFromRoles(ctx.profile, ctx.roles, ticket, ctx.userId)
    : getTicketPermissions(ctx.level, ticket, ctx.userId);

  const actionMutation = useMutation({
    mutationFn: (payload: TicketActionPayload) => supportTicketCoreService.updateTicket(payload),
    onSuccess: () => {
      toast.success('Ação executada com sucesso');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['support-tickets-core'] });
    },
    onError: (err: Error) => {
      toast.error(`Erro: ${err.message}`);
    },
  });

  const messageMutation = useMutation({
    mutationFn: (payload: AddMessagePayload) => supportTicketCoreService.addMessage(payload),
    onSuccess: () => {
      toast.success('Mensagem enviada');
      refetch();
    },
    onError: (err: Error) => {
      toast.error(`Erro: ${err.message}`);
    },
  });

  const performAction = useCallback((action: TicketActionPayload['action'], extra: Partial<TicketActionPayload> = {}) => {
    if (!ticketId || !ctx.userId) return;
    return actionMutation.mutateAsync({
      ticket_id: ticketId,
      action,
      actor_user_id: ctx.legacyUserId || ctx.userId,
      actor_name: ctx.name,
      actor_level: ctx.level,
      ...extra,
    });
  }, [ticketId, ctx, actionMutation]);

  const sendMessage = useCallback((body: string, isInternal: boolean) => {
    if (!ticketId || !ctx.userId) return;
    const authorType = ctx.level >= 900 ? 'support' : ctx.level >= 775 ? 'cs' : 'client';
    return messageMutation.mutateAsync({
      ticket_id: ticketId,
      body,
      is_internal_note: isInternal,
      author_name: ctx.name || 'Usuário',
      author_email: ctx.email,
      author_user_id: ctx.legacyUserId || ctx.userId,
      author_level: ctx.level,
      author_type: authorType as any,
    });
  }, [ticketId, ctx, messageMutation]);

  return {
    ticket,
    isLoading,
    error,
    refetch,
    permissions,
    performAction,
    sendMessage,
    isActing: actionMutation.isPending,
    isSending: messageMutation.isPending,
    userLevel: ctx.level,
    userId: ctx.userId,
    session: ctx,
  };
}

// ── Create hook ─────────────────────────────────────────────────────────

export function useCreateTicket() {
  const queryClient = useQueryClient();
  const ctx = useSessionContext();

  const mutation = useMutation({
    mutationFn: (payload: CreateTicketPayload) => supportTicketCoreService.createTicket(payload),
    onSuccess: (ticket) => {
      toast.success(`Chamado ${ticket.public_code} criado com sucesso`);
      queryClient.invalidateQueries({ queryKey: ['support-tickets-core'] });
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar chamado: ${err.message}`);
    },
  });

  return {
    createTicket: mutation.mutateAsync,
    isCreating: mutation.isPending,
    session: ctx,
  };
}

// ── Queue hooks ─────────────────────────────────────────────────────────

export function useQueues() {
  return useQuery({
    queryKey: ['support-queues'],
    queryFn: () => supportTicketCoreService.listQueues(),
    staleTime: 60_000,
  });
}

export function useQueueMembers(queueId?: string) {
  return useQuery({
    queryKey: ['support-queue-members', queueId],
    queryFn: () => supportTicketCoreService.listQueueMembers(queueId),
    enabled: !!queueId,
    staleTime: 30_000,
  });
}

export function useQueueMemberMutations() {
  const queryClient = useQueryClient();

  const refreshAnalystViews = () => {
    queryClient.invalidateQueries({ queryKey: ['support-queue-members'] });
    queryClient.invalidateQueries({ queryKey: ['analyst-capacity-full'] });
    queryClient.invalidateQueries({ queryKey: ['support-dashboard-stats'] });
  };

  const addMember = useMutation({
    mutationFn: supportTicketCoreService.addQueueMember,
    onSuccess: () => {
      toast.success('Membro adicionado à fila');
      refreshAnalystViews();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMember = useMutation({
    mutationFn: supportTicketCoreService.removeQueueMember,
    onSuccess: () => {
      toast.success('Membro removido');
      refreshAnalystViews();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMember = useMutation({
    mutationFn: supportTicketCoreService.toggleQueueMember,
    onSuccess: () => {
      refreshAnalystViews();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { addMember, removeMember, toggleMember };
}
