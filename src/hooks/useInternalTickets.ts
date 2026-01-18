// ============================================================================
// USE INTERNAL TICKETS HOOK
// ============================================================================

import { useState, useCallback, useEffect } from 'react';
import {
  internalTicketService,
  CreateTicketParams,
  InternalTicketStats,
} from '@/services/internalTicketService';
import {
  InternalTicket,
  InternalTicketStatus,
  SUPPORT_LEVELS,
} from '@/types/internalTicket';
import { authService } from '@/services/authService';

interface UseInternalTicketsOptions {
  filterByCurrentUser?: boolean;
  filterQueue?: 'N1' | 'N2';
  showAllForSupport?: boolean;
}

export function useInternalTickets(options: UseInternalTicketsOptions = {}) {
  const { filterByCurrentUser = false, filterQueue, showAllForSupport = false } = options;
  
  const [tickets, setTickets] = useState<InternalTicket[]>([]);
  const [stats, setStats] = useState<InternalTicketStats>({
    abertos: 0,
    em_andamento: 0,
    aguardando: 0,
    escalados: 0,
    resolvidos_30d: 0,
    dentro_sla: 0,
    fora_sla: 0,
  });
  const [loading, setLoading] = useState(true);

  const session = authService.getSession();
  const userId = session?.userId ? parseInt(session.userId, 10) : undefined;
  const userLevel = session?.level ?? 0;
  const isSupport = SUPPORT_LEVELS.includes(userLevel);

  const refresh = useCallback(() => {
    setLoading(true);
    try {
      let allTickets: InternalTicket[];
      
      if (filterQueue) {
        allTickets = internalTicketService.listByQueue(filterQueue);
      } else if (filterByCurrentUser && userId && !showAllForSupport) {
        allTickets = internalTicketService.listByUser(userId);
      } else {
        allTickets = internalTicketService.list();
      }
      
      // Ordenar por data de criação (mais recentes primeiro)
      allTickets.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setTickets(allTickets);
      
      // Stats considerando filtro do usuário
      const statsUserId = filterByCurrentUser && !showAllForSupport ? userId : undefined;
      setStats(internalTicketService.getStats(statsUserId));
    } catch (error) {
      console.error('Erro ao carregar chamados internos:', error);
    } finally {
      setLoading(false);
    }
  }, [filterByCurrentUser, filterQueue, showAllForSupport, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createTicket = useCallback(
    (params: Omit<CreateTicketParams, 'created_by_id' | 'created_by_name' | 'created_by_email' | 'created_by_level'>) => {
      if (!session) {
        throw new Error('Usuário não autenticado');
      }

      const ticket = internalTicketService.create({
        ...params,
        created_by_id: userId || 0,
        created_by_name: session.name,
        created_by_email: session.email,
        created_by_level: session.level,
      });

      refresh();
      return ticket;
    },
    [session, userId, refresh]
  );

  const updateStatus = useCallback(
    (ticketId: string, newStatus: InternalTicketStatus) => {
      if (!session || !userId) return undefined;

      const ticket = internalTicketService.updateStatus(
        ticketId,
        newStatus,
        session.name,
        userId
      );

      refresh();
      return ticket;
    },
    [session, userId, refresh]
  );

  const assignTicket = useCallback(
    (ticketId: string, assigneeId: number, assigneeName: string) => {
      if (!session || !userId) return undefined;

      const ticket = internalTicketService.assign(
        ticketId,
        assigneeId,
        assigneeName,
        session.name,
        userId
      );

      refresh();
      return ticket;
    },
    [session, userId, refresh]
  );

  const assumeTicket = useCallback(
    (ticketId: string) => {
      if (!session || !userId) return undefined;

      const ticket = internalTicketService.assign(
        ticketId,
        userId,
        session.name,
        session.name,
        userId
      );

      refresh();
      return ticket;
    },
    [session, userId, refresh]
  );

  const escalateToN2 = useCallback(
    (ticketId: string) => {
      if (!session || !userId) return undefined;

      const ticket = internalTicketService.escalateToN2(
        ticketId,
        session.name,
        userId
      );

      refresh();
      return ticket;
    },
    [session, userId, refresh]
  );

  const addComment = useCallback(
    (ticketId: string, content: string) => {
      if (!session || !userId) return undefined;

      const ticket = internalTicketService.addComment(
        ticketId,
        content,
        session.name,
        userId
      );

      refresh();
      return ticket;
    },
    [session, userId, refresh]
  );

  const getTicket = useCallback((id: string) => {
    return internalTicketService.getById(id);
  }, []);

  return {
    tickets,
    stats,
    loading,
    refresh,
    createTicket,
    updateStatus,
    assignTicket,
    assumeTicket,
    escalateToN2,
    addComment,
    getTicket,
    isSupport,
    userLevel,
    userId,
  };
}
