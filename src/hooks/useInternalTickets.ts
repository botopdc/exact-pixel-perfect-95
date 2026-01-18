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
  TicketQueue,
  SUPPORT_LEVELS,
  CS_LEVELS,
  ADMIN_LEVELS,
  getAllowedQueues,
  canManageTickets,
} from '@/types/internalTicket';
import { authService } from '@/services/authService';

export type ViewMode = 'my_tickets' | 'queue_support' | 'queue_cs' | 'all';

interface UseInternalTicketsOptions {
  viewMode?: ViewMode;
  queues?: TicketQueue[];
}

export function useInternalTickets(options: UseInternalTicketsOptions = {}) {
  const { viewMode = 'my_tickets', queues } = options;
  
  const [tickets, setTickets] = useState<InternalTicket[]>([]);
  const [stats, setStats] = useState<InternalTicketStats>({
    abertos: 0,
    em_andamento: 0,
    aguardando: 0,
    escalados: 0,
    resolvidos_30d: 0,
    dentro_sla: 0,
    fora_sla: 0,
    nao_atribuidos: 0,
  });
  const [loading, setLoading] = useState(true);

  const session = authService.getSession();
  const userId = session?.userId ? parseInt(session.userId, 10) : undefined;
  const userLevel = session?.level ?? 0;
  
  // Determinar permissões
  const isSupport = SUPPORT_LEVELS.includes(userLevel);
  const isCS = CS_LEVELS.includes(userLevel);
  const isAdmin = ADMIN_LEVELS.includes(userLevel);
  const canManage = canManageTickets(userLevel);
  const allowedQueues = getAllowedQueues(userLevel);

  // Verifica se pode ver todos os chamados (level >= 750)
  const canViewAll = userLevel >= 750;

  const refresh = useCallback(() => {
    setLoading(true);
    try {
      let allTickets: InternalTicket[];
      let statsQueues: TicketQueue[] | undefined;
      let statsUserId: number | undefined;
      
      if (queues && queues.length > 0) {
        // Filtro por filas específicas
        allTickets = internalTicketService.listByQueues(queues);
        statsQueues = queues;
      } else if (viewMode === 'my_tickets' && userId) {
        // Meus Chamados - apenas chamados do usuário
        allTickets = internalTicketService.listMy(userId);
        statsUserId = userId;
      } else if (viewMode === 'queue_support' && canViewAll) {
        // Fila do Suporte - N1, N2, INFRA (level >= 750 pode ver)
        const supportQueues: TicketQueue[] = ['N1', 'N2', 'INFRA'];
        allTickets = internalTicketService.listByQueues(supportQueues);
        statsQueues = supportQueues;
      } else if (viewMode === 'queue_cs' && canViewAll) {
        // Fila do CS (level >= 750 pode ver)
        const csQueues: TicketQueue[] = ['CS'];
        allTickets = internalTicketService.listByQueues(csQueues);
        statsQueues = csQueues;
      } else if (viewMode === 'all' && canViewAll) {
        // Level >= 750 vê tudo
        allTickets = internalTicketService.list();
      } else if (userId) {
        // Fallback: visibilidade baseada no nível
        allTickets = internalTicketService.listVisible(userId, userLevel);
      } else {
        allTickets = [];
      }
      
      // Ordenar por data de criação (mais recentes primeiro)
      allTickets.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      setTickets(allTickets);
      
      // Stats
      setStats(internalTicketService.getStats(statsUserId, statsQueues));
    } catch (error) {
      console.error('Erro ao carregar chamados internos:', error);
    } finally {
      setLoading(false);
    }
  }, [viewMode, queues, userId, userLevel, canViewAll]);

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
    (ticketId: string, assigneeId: number, assigneeName: string, assigneeEmail: string) => {
      if (!session || !userId) return undefined;

      const ticket = internalTicketService.assign(
        ticketId,
        assigneeId,
        assigneeName,
        assigneeEmail,
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
        session.email,
        session.name,
        userId
      );

      refresh();
      return ticket;
    },
    [session, userId, refresh]
  );

  const transferQueue = useCallback(
    (ticketId: string, newQueue: TicketQueue) => {
      if (!session || !userId) return undefined;

      const ticket = internalTicketService.transferQueue(
        ticketId,
        newQueue,
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
    (ticketId: string, content: string, isInternalNote: boolean = false) => {
      if (!session || !userId) return undefined;

      const ticket = internalTicketService.addComment(
        ticketId,
        content,
        session.name,
        userId,
        isInternalNote
      );

      refresh();
      return ticket;
    },
    [session, userId, refresh]
  );

  const getTicket = useCallback((id: string) => {
    return internalTicketService.getById(id);
  }, []);

  const canViewTicket = useCallback((ticket: InternalTicket) => {
    if (!userId) return false;
    return internalTicketService.canView(ticket, userId, userLevel);
  }, [userId, userLevel]);

  return {
    tickets,
    stats,
    loading,
    refresh,
    createTicket,
    updateStatus,
    assignTicket,
    assumeTicket,
    transferQueue,
    escalateToN2,
    addComment,
    getTicket,
    canViewTicket,
    // Permissões
    isSupport,
    isCS,
    isAdmin,
    canManage,
    allowedQueues,
    userLevel,
    userId,
  };
}
