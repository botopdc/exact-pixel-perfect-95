// ============================================================================
// HOOKS: useSupportTicketCore — list, detail, actions
// Consumes Edge Functions via supportTicketCoreService
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
} from '@/services/supportTicketCoreService';
import { authService } from '@/services/authService';
import { getTicketPermissions } from '@/lib/ticketPermissions';

// ── List hook ───────────────────────────────────────────────────────────

export function useSupportTicketList(filters: TicketListFilters = {}) {
  const queryClient = useQueryClient();
  const session = authService.getSession();

  // Inject user context into filters for backend visibility
  const enrichedFilters: TicketListFilters & { user_level?: number; user_id?: string } = {
    ...filters,
    user_level: session?.level,
    user_id: session?.userId,
  };

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['support-tickets-core', filters],
    queryFn: () => supportTicketCoreService.listTickets(enrichedFilters),
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
  const session = authService.getSession();
  const userLevel = session?.level ?? 0;
  const userId = session?.userId;

  const {
    data: ticket,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['support-ticket-core', ticketId],
    queryFn: () => supportTicketCoreService.getTicket(ticketId!),
    enabled: !!ticketId,
    staleTime: 0,
  });

  const permissions = getTicketPermissions(userLevel, ticket, userId);

  // Action mutation
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

  // Message mutation
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
    if (!ticketId || !session) return;
    return actionMutation.mutateAsync({
      ticket_id: ticketId,
      action,
      actor_user_id: session.userId,
      actor_name: session.name,
      actor_level: session.level,
      ...extra,
    });
  }, [ticketId, session, actionMutation]);

  const sendMessage = useCallback((body: string, isInternal: boolean) => {
    if (!ticketId || !session) return;
    return messageMutation.mutateAsync({
      ticket_id: ticketId,
      body,
      is_internal_note: isInternal,
      author_name: session.name,
      author_email: session.email,
      author_user_id: session.userId,
      author_level: session.level,
      author_type: session.level >= 900 ? 'support' : session.level >= 775 ? 'cs' : 'client',
    });
  }, [ticketId, session, messageMutation]);

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
    userLevel,
    userId,
    session,
  };
}

// ── Create hook ─────────────────────────────────────────────────────────

export function useCreateTicket() {
  const queryClient = useQueryClient();
  const session = authService.getSession();

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
    session,
  };
}
