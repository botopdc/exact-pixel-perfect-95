// ============================================================================
// USE SUPPORT TICKETS HOOK
// State management for support tickets with Laravel API
// ============================================================================

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  SupportTicket,
  SupportTicketFilters,
  SupportTicketUpdatePayload,
  SupportTicketMessagePayload,
  SupportTicketStatus,
  SupportTeam,
  SLAPolicy,
  SLAPolicyPayload,
  TicketReportFilters,
  TicketReportData,
  canAccessSupportModule,
  canManageSLAs,
} from '@/types/supportTicket';
import {
  supportTicketService,
  SupportTicketStats,
} from '@/services/supportTicketService';
import { authService } from '@/services/authService';

// Tab definitions for queue view
export type QueueTab = 'p0' | 'aguardando' | 'em_andamento' | 'todos';

const TAB_FILTERS: Record<QueueTab, Partial<SupportTicketFilters>> = {
  p0: { priority: 'P0', status: ['aberto', 'em_andamento'] },
  aguardando: { status: 'aguardando_cliente' },
  em_andamento: { status: 'em_andamento' },
  todos: { status: ['aberto', 'em_andamento', 'aguardando_cliente', 'aguardando_terceiro'] },
};

interface UseSupportTicketsOptions {
  tab?: QueueTab;
  filters?: SupportTicketFilters;
  page?: number;
  perPage?: number;
  enabled?: boolean;
}

export function useSupportTickets(options: UseSupportTicketsOptions = {}) {
  const { tab = 'todos', filters = {}, page = 1, perPage = 50, enabled = true } = options;
  const queryClient = useQueryClient();
  
  // Get current user
  const session = authService.getSession();
  const userId = session?.userId ? parseInt(session.userId, 10) : undefined;
  const userLevel = session?.level ?? 0;
  
  // Permission checks
  const hasAccess = canAccessSupportModule(userLevel);
  const canManageSLA = canManageSLAs(userLevel);

  // Merge tab filters with custom filters
  const mergedFilters: SupportTicketFilters = {
    ...TAB_FILTERS[tab],
    ...filters,
  };

  // Query key for caching
  const queryKey = ['support-tickets', tab, mergedFilters, page, perPage];

  // Fetch tickets
  const {
    data: ticketsResponse,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => supportTicketService.listTickets(mergedFilters, page, perPage),
    enabled: enabled && hasAccess,
    staleTime: 0, // Always fresh
    refetchOnWindowFocus: true,
  });

  const tickets = ticketsResponse?.data ?? [];
  const meta = ticketsResponse?.meta;

  // Calculate stats
  const stats: SupportTicketStats = supportTicketService.calculateStats(tickets);

  // ============================================================================
  // MUTATIONS
  // ============================================================================

  // Update ticket
  const updateMutation = useMutation({
    mutationFn: ({ ticketNumber, payload }: { ticketNumber: string; payload: SupportTicketUpdatePayload }) =>
      supportTicketService.updateTicket(ticketNumber, payload),
    onSuccess: (updatedTicket) => {
      toast.success(`Chamado ${updatedTicket.ticket_number} atualizado`);
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['support-ticket', updatedTicket.ticket_number] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar chamado: ${error.message}`);
    },
  });

  // Add message
  const addMessageMutation = useMutation({
    mutationFn: ({ ticketNumber, payload }: { ticketNumber: string; payload: SupportTicketMessagePayload }) =>
      supportTicketService.addMessage(ticketNumber, payload),
    onSuccess: (_, variables) => {
      toast.success('Mensagem adicionada');
      queryClient.invalidateQueries({ queryKey: ['support-ticket', variables.ticketNumber] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao adicionar mensagem: ${error.message}`);
    },
  });

  // Quick actions
  const assignToMe = useCallback(
    async (ticketNumber: string) => {
      if (!userId) {
        toast.error('Usuário não autenticado');
        return;
      }
      await updateMutation.mutateAsync({
        ticketNumber,
        payload: { assigned_to_user_id: userId },
      });
    },
    [userId, updateMutation]
  );

  const changeStatus = useCallback(
    async (ticketNumber: string, status: SupportTicketStatus) => {
      await updateMutation.mutateAsync({
        ticketNumber,
        payload: { status },
      });
    },
    [updateMutation]
  );

  const escalateToTeam = useCallback(
    async (ticketNumber: string, team: SupportTeam) => {
      await updateMutation.mutateAsync({
        ticketNumber,
        payload: { assigned_team: team, assigned_to_user_id: null },
      });
    },
    [updateMutation]
  );

  const addInternalNote = useCallback(
    async (ticketNumber: string, message: string) => {
      await addMessageMutation.mutateAsync({
        ticketNumber,
        payload: { message, is_internal_note: true },
      });
    },
    [addMessageMutation]
  );

  return {
    // Data
    tickets,
    stats,
    meta,
    
    // Loading states
    isLoading,
    error,
    isUpdating: updateMutation.isPending,
    isAddingMessage: addMessageMutation.isPending,
    
    // Actions
    refetch,
    updateTicket: (ticketNumber: string, payload: SupportTicketUpdatePayload) =>
      updateMutation.mutateAsync({ ticketNumber, payload }),
    addMessage: (ticketNumber: string, payload: SupportTicketMessagePayload) =>
      addMessageMutation.mutateAsync({ ticketNumber, payload }),
    
    // Quick actions
    assignToMe,
    changeStatus,
    escalateToTeam,
    addInternalNote,
    
    // Permissions
    hasAccess,
    canManageSLA,
    userLevel,
    userId,
  };
}

// ============================================================================
// SINGLE TICKET HOOK
// ============================================================================

export function useSupportTicket(ticketNumber: string | undefined) {
  const queryClient = useQueryClient();
  const session = authService.getSession();
  const userLevel = session?.level ?? 0;
  const userId = session?.userId ? parseInt(session.userId, 10) : undefined;

  const {
    data: ticket,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['support-ticket', ticketNumber],
    queryFn: () => supportTicketService.getTicket(ticketNumber!),
    enabled: !!ticketNumber && canAccessSupportModule(userLevel),
    staleTime: 0,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (payload: SupportTicketUpdatePayload) =>
      supportTicketService.updateTicket(ticketNumber!, payload),
    onSuccess: (updatedTicket) => {
      toast.success('Chamado atualizado');
      queryClient.setQueryData(['support-ticket', ticketNumber], updatedTicket);
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  // Add message mutation
  const addMessageMutation = useMutation({
    mutationFn: (payload: SupportTicketMessagePayload) =>
      supportTicketService.addMessage(ticketNumber!, payload),
    onSuccess: () => {
      toast.success('Mensagem enviada');
      refetch();
    },
    onError: (error: Error) => {
      toast.error(`Erro ao enviar mensagem: ${error.message}`);
    },
  });

  return {
    ticket,
    isLoading,
    error,
    refetch,
    
    // Actions
    updateTicket: (payload: SupportTicketUpdatePayload) => updateMutation.mutateAsync(payload),
    addMessage: (payload: SupportTicketMessagePayload) => addMessageMutation.mutateAsync(payload),
    
    // Loading states
    isUpdating: updateMutation.isPending,
    isAddingMessage: addMessageMutation.isPending,
    
    // Context
    userLevel,
    userId,
  };
}

// ============================================================================
// SLA POLICIES HOOK (Admin only)
// ============================================================================

export function useSLAPolicies() {
  const queryClient = useQueryClient();
  const session = authService.getSession();
  const userLevel = session?.level ?? 0;
  const canManage = canManageSLAs(userLevel);

  const {
    data: policies = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['sla-policies'],
    queryFn: supportTicketService.listSLAPolicies,
    enabled: canManage,
    staleTime: 0,
  });

  const createMutation = useMutation({
    mutationFn: supportTicketService.createSLAPolicy,
    onSuccess: () => {
      toast.success('Política SLA criada');
      queryClient.invalidateQueries({ queryKey: ['sla-policies'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar política: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: SLAPolicyPayload }) =>
      supportTicketService.updateSLAPolicy(id, payload),
    onSuccess: () => {
      toast.success('Política SLA atualizada');
      queryClient.invalidateQueries({ queryKey: ['sla-policies'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar política: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: supportTicketService.deleteSLAPolicy,
    onSuccess: () => {
      toast.success('Política SLA excluída');
      queryClient.invalidateQueries({ queryKey: ['sla-policies'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir política: ${error.message}`);
    },
  });

  return {
    policies,
    isLoading,
    error,
    canManage,
    refetch,
    
    createPolicy: (payload: SLAPolicyPayload) => createMutation.mutateAsync(payload),
    updatePolicy: (id: number, payload: SLAPolicyPayload) => updateMutation.mutateAsync({ id, payload }),
    deletePolicy: (id: number) => deleteMutation.mutateAsync(id),
    
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// ============================================================================
// REPORTS HOOK (Admin only)
// ============================================================================

export function useTicketReports(filters: TicketReportFilters | null) {
  const session = authService.getSession();
  const userLevel = session?.level ?? 0;
  const canView = canManageSLAs(userLevel); // Same permission as SLAs

  const {
    data: reports = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['ticket-reports', filters],
    queryFn: () => supportTicketService.getTicketReports(filters!),
    enabled: canView && !!filters,
    staleTime: 0,
  });

  return {
    reports,
    isLoading,
    error,
    canView,
    refetch,
  };
}
