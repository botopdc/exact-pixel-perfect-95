import { useState } from 'react';
import { ticketsService, listarTickets, listarTicketsSuporte, listarTicketsCS, buscarTicket } from '@/services/ticketsService';
import { Ticket, TicketTransicaoCS } from '@/types/ticket';

export function useTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = () => {
    setTickets(listarTickets());
  };

  const refreshSuporte = () => {
    setTickets(listarTicketsSuporte());
  };

  const refreshCS = () => {
    setTickets(listarTicketsCS());
  };

  const getTicket = (id: string) => {
    return buscarTicket(id);
  };

  const criarTicket = (dados: Parameters<typeof ticketsService.criarTicket>[0]) => {
    const ticket = ticketsService.criarTicket(dados);
    refresh();
    return ticket;
  };

  const atualizarStatus = (id: string, status: Ticket['status'], autor: string) => {
    const ticket = ticketsService.atualizarStatus(id, status, autor);
    refresh();
    return ticket;
  };

  const adicionarComentario = (id: string, conteudo: string, autor: string) => {
    const ticket = ticketsService.adicionarComentario(id, conteudo, autor);
    refresh();
    return ticket;
  };

  const encaminharParaCS = (id: string, transicao: Omit<TicketTransicaoCS, 'data_transicao'>, autor: string) => {
    const ticket = ticketsService.encaminharParaCS(id, transicao, autor);
    refresh();
    return ticket;
  };

  const atualizarTipoDemanda = (id: string, tipo: Ticket['tipo_demanda'], autor: string) => {
    const ticket = ticketsService.atualizarTipoDemanda(id, tipo, autor);
    refresh();
    return ticket;
  };

  const encerrarTicket = (id: string, autor: string) => {
    const ticket = ticketsService.encerrarTicket(id, autor);
    refresh();
    return ticket;
  };

  return {
    tickets,
    loading,
    refresh,
    refreshSuporte,
    refreshCS,
    getTicket,
    criarTicket,
    atualizarStatus,
    adicionarComentario,
    encaminharParaCS,
    atualizarTipoDemanda,
    encerrarTicket,
  };
}
