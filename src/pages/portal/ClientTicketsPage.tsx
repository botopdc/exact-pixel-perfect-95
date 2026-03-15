// ============================================================================
// CLIENT PORTAL — Ticket list page for external clients (level 1)
// Route: /portal/tickets
// ============================================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Headphones, Plus, RefreshCw, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TicketTable, TicketCardMobile } from '@/components/tickets-core/TicketTable';
import { TicketCreateModal } from '@/components/tickets-core/TicketCreateModal';
import { useSupportTicketList } from '@/hooks/useSupportTicketCore';
import { authService } from '@/services/authService';
import { isClientUser, CLIENT_TICKET_DETAIL_ROUTE } from '@/lib/ticketPermissions';
import { useIsMobile } from '@/hooks/use-mobile';
import { Input } from '@/components/ui/input';

export default function ClientTicketsPage() {
  const session = authService.getSession();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Guard: only level 1 clients
  if (!session || !isClientUser(session.level)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <p className="text-lg font-medium">Acesso restrito</p>
          <p className="text-sm text-muted-foreground">Esta área é exclusiva para clientes.</p>
          <Button onClick={() => navigate('/login')}>Fazer login</Button>
        </div>
      </div>
    );
  }

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const { tickets, isLoading, refetch } = useSupportTicketList({
    only_mine: true,
    search: search || undefined,
  });

  const handleCreated = (ticketId: string) => {
    navigate(CLIENT_TICKET_DETAIL_ROUTE(ticketId));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <Headphones className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Meus Chamados</h1>
              <p className="text-sm text-muted-foreground">Acompanhe seus tickets de suporte</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Abrir Chamado
            </Button>
          </div>
        </div>

        {/* Search */}
        <Input
          placeholder="Buscar por código ou título..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />

        {/* Tickets list */}
        {isMobile ? (
          <div className="space-y-2">
            {tickets.map(t => (
              <TicketCardMobile key={t.id} ticket={t} routePrefix="/portal/tickets" />
            ))}
            {!isLoading && tickets.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">Você ainda não possui chamados</p>
            )}
          </div>
        ) : (
          <TicketTable tickets={tickets} isLoading={isLoading} showQueue={false} routePrefix="/portal/tickets" />
        )}

        <TicketCreateModal open={createOpen} onOpenChange={setCreateOpen} onCreated={handleCreated} />
      </div>
    </div>
  );
}
