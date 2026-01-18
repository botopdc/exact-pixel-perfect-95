// ============================================================================
// USE ANALISTAS HOOK - Gestão do time de suporte
// ============================================================================

import { useState, useCallback, useEffect, useMemo } from 'react';
import { openApi, ApiUser } from '@/lib/openApi';
import { internalTicketService } from '@/services/internalTicketService';
import { InternalTicket } from '@/types/internalTicket';

// ============================================================================
// TYPES
// ============================================================================

export interface AnalistaStats {
  atribuidos: number;
  em_atendimento: number;
  dentro_sla: number;
  fora_sla: number;
  ultima_atividade: string | null;
}

export interface AnalistaData extends ApiUser {
  stats: AnalistaStats;
}

export interface AnalistasKPIs {
  analistas_ativos: number;
  chamados_fila: number;
  em_atendimento: number;
  sla_risco: number;
}

export type LevelFilter = 'all' | '900' | '950';
export type SortField = 'name' | 'atribuidos' | 'fora_sla' | 'ultima_atividade';

// ============================================================================
// HOOK
// ============================================================================

export function useAnalistas() {
  const [analistas, setAnalistas] = useState<AnalistaData[]>([]);
  const [tickets, setTickets] = useState<InternalTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Carregar analistas da API e chamados do localStorage
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Buscar usuários level 900 e 950 em paralelo
      const [suporteRes, gerenteRes] = await Promise.all([
        openApi.getUsers({ level: 900, __perPage: 200, __order: 'name:ASC' }),
        openApi.getUsers({ level: 950, __perPage: 200, __order: 'name:ASC' }),
      ]);

      const allUsers = [...suporteRes.data, ...gerenteRes.data];

      // Carregar todos os chamados
      const allTickets = internalTicketService.list();
      setTickets(allTickets);

      // Calcular stats por analista
      const analistasWithStats: AnalistaData[] = allUsers.map((user) => {
        const userTickets = allTickets.filter(
          (t) => t.assignee_id === user.id
        );

        const atribuidos = userTickets.filter(
          (t) => !['resolvido', 'encerrado'].includes(t.status)
        ).length;

        const em_atendimento = userTickets.filter(
          (t) => t.status === 'em_atendimento'
        ).length;

        const dentro_sla = userTickets.filter(
          (t) =>
            !['resolvido', 'encerrado'].includes(t.status) &&
            !t.sla_breached
        ).length;

        const fora_sla = userTickets.filter(
          (t) =>
            !['resolvido', 'encerrado'].includes(t.status) &&
            t.sla_breached
        ).length;

        // Última atividade = updated_at mais recente
        const ultimaAtividade = userTickets
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          [0]?.updated_at || null;

        return {
          ...user,
          stats: {
            atribuidos,
            em_atendimento,
            dentro_sla,
            fora_sla,
            ultima_atividade: ultimaAtividade,
          },
        };
      });

      setAnalistas(analistasWithStats);
    } catch (err: any) {
      console.error('[useAnalistas] Erro ao carregar dados:', err);
      setError(err?.response?.data?.message || 'Erro ao carregar analistas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // KPIs globais
  const kpis = useMemo<AnalistasKPIs>(() => {
    const openTickets = tickets.filter(
      (t) => !['resolvido', 'encerrado'].includes(t.status)
    );

    const chamados_fila = openTickets.filter(
      (t) => t.status === 'aberto' || t.status === 'aguardando_solicitante'
    ).length;

    const em_atendimento = openTickets.filter(
      (t) => t.status === 'em_atendimento'
    ).length;

    // SLA em risco: fora do SLA OU menos de 20% do tempo restante
    const sla_risco = openTickets.filter((t) => {
      if (t.sla_breached) return true;
      if (!t.sla_deadline) return false;
      
      const now = new Date().getTime();
      const deadline = new Date(t.sla_deadline).getTime();
      const created = new Date(t.created_at).getTime();
      const total = deadline - created;
      const remaining = deadline - now;
      
      return remaining > 0 && remaining / total < 0.2;
    }).length;

    return {
      analistas_ativos: analistas.length,
      chamados_fila,
      em_atendimento,
      sla_risco,
    };
  }, [analistas, tickets]);

  // Filtrar e ordenar analistas
  const filteredAnalistas = useMemo(() => {
    let result = [...analistas];

    // Filtro por busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(term) ||
          a.email.toLowerCase().includes(term)
      );
    }

    // Filtro por level
    if (levelFilter !== 'all') {
      const level = parseInt(levelFilter, 10);
      result = result.filter((a) => a.level === level);
    }

    // Ordenação
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'atribuidos':
          comparison = a.stats.atribuidos - b.stats.atribuidos;
          break;
        case 'fora_sla':
          comparison = a.stats.fora_sla - b.stats.fora_sla;
          break;
        case 'ultima_atividade':
          const dateA = a.stats.ultima_atividade
            ? new Date(a.stats.ultima_atividade).getTime()
            : 0;
          const dateB = b.stats.ultima_atividade
            ? new Date(b.stats.ultima_atividade).getTime()
            : 0;
          comparison = dateB - dateA; // Mais recente primeiro por padrão
          break;
      }

      return sortAsc ? comparison : -comparison;
    });

    return result;
  }, [analistas, searchTerm, levelFilter, sortField, sortAsc]);

  // Obter chamados de um analista específico
  const getAnalistaTickets = useCallback(
    (analistaId: number) => {
      return tickets.filter((t) => t.assignee_id === analistaId);
    },
    [tickets]
  );

  // Calcular tempo médio de primeira resposta (baseado no primeiro comentário do assignee)
  const getTempoMedioResposta = useCallback(
    (analistaId: number) => {
      const userTickets = tickets.filter(
        (t) => t.assignee_id === analistaId && t.history.length > 0
      );

      // Calcular baseado no primeiro comentário após criação
      const ticketsWithResponse = userTickets.filter((t) => {
        const firstComment = t.history.find(
          (h) => h.type === 'comentario' && h.authorId === analistaId
        );
        return !!firstComment;
      });

      if (ticketsWithResponse.length === 0) return null;

      const totalMinutes = ticketsWithResponse.reduce((sum, t) => {
        const created = new Date(t.created_at).getTime();
        const firstComment = t.history.find(
          (h) => h.type === 'comentario' && h.authorId === analistaId
        );
        if (!firstComment) return sum;
        const firstResponse = new Date(firstComment.date).getTime();
        return sum + (firstResponse - created) / (1000 * 60);
      }, 0);

      const avgMinutes = totalMinutes / ticketsWithResponse.length;

      if (avgMinutes < 60) {
        return `${Math.round(avgMinutes)} min`;
      }
      return `${(avgMinutes / 60).toFixed(1)} h`;
    },
    [tickets]
  );

  const toggleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortAsc((asc) => !asc);
        return prev;
      }
      setSortAsc(true);
      return field;
    });
  }, []);

  return {
    // Dados
    analistas: filteredAnalistas,
    allAnalistas: analistas,
    kpis,
    loading,
    error,
    
    // Filtros
    searchTerm,
    setSearchTerm,
    levelFilter,
    setLevelFilter,
    sortField,
    sortAsc,
    toggleSort,
    
    // Ações
    refresh: loadData,
    getAnalistaTickets,
    getTempoMedioResposta,
  };
}
