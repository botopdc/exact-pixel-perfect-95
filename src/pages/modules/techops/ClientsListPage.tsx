// ============================================================================
// CLIENTS LIST PAGE - Using OPEN API (level=1 clients)
// ============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Search,
  RefreshCw,
  Mail,
  Hash,
  Calendar,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ModuleHeader } from '@/components/navigation/ModuleCard';
import { useOpenApiClients } from '@/hooks/useOpenApiClients';
import { ApiUser } from '@/lib/openApi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ClientsListPage() {
  const navigate = useNavigate();
  const { clients, loading, error, refresh } = useOpenApiClients();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<ApiUser | null>(null);

  // Client-side filtering by name and email
  const filteredClients = clients.filter((client) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      client.name?.toLowerCase().includes(query) ||
      client.email?.toLowerCase().includes(query) ||
      client.id?.toString().includes(query)
    );
  });

  // Format date helper
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return '-';
    }
  };

  // Handle opening incident with pre-selected client
  const handleOpenIncident = (client: ApiUser) => {
    navigate(`/modulos/atendimentos/suporte-tecnico/incidentes/novo?client_user_id=${client.id}`);
  };

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Clientes"
        description="Lista de clientes (usuários Nível 1) disponíveis para abertura de incidentes"
        icon={Building2}
        actions={
          <Button 
            variant="outline" 
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail ou ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Badge variant="secondary" className="h-10 px-4 flex items-center gap-2 text-sm">
          <Building2 className="h-4 w-4" />
          Somente Clientes (Nível 1)
        </Badge>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex items-center justify-between">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={refresh}>
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">
                <div className="flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  ID
                </div>
              </TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  E-mail
                </div>
              </TableHead>
              <TableHead>Entity ID</TableHead>
              <TableHead>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Criado em
                </div>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[140px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              // Loading skeleton
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                </TableRow>
              ))
            ) : filteredClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {searchQuery 
                    ? 'Nenhum cliente encontrado para a busca' 
                    : 'Nenhum cliente cadastrado'
                  }
                </TableCell>
              </TableRow>
            ) : (
              filteredClients.map((client) => (
                <TableRow 
                  key={client.id} 
                  className="hover:bg-accent/50"
                >
                  <TableCell className="font-mono text-xs">
                    {client.id}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{client.name || '-'}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {client.email || '-'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {client.entity_id ? (
                      <Badge variant="outline" className="font-mono text-xs">
                        {client.entity_id}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(client.created_at)}
                  </TableCell>
                  <TableCell>
                    {!client.deleted_at ? (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        Inativo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedClient(client)}
                        title="Ver detalhes"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleOpenIncident(client)}
                        title="Abrir incidente para este cliente"
                      >
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        Incidente
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Client Details Dialog */}
      <Dialog open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do Cliente</DialogTitle>
          </DialogHeader>
          {selectedClient && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">ID</p>
                  <p className="font-mono">{selectedClient.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nível</p>
                  <Badge variant="outline">1 — Cliente</Badge>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="font-medium">{selectedClient.name || '-'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">E-mail</p>
                  <p>{selectedClient.email || '-'}</p>
                </div>
                {selectedClient.entity_id && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Entity ID</p>
                    <Badge variant="outline" className="font-mono">
                      {selectedClient.entity_id}
                    </Badge>
                  </div>
                )}
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Criado em</p>
                  <p>{formatDate(selectedClient.created_at)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Status</p>
                  {!selectedClient.deleted_at ? (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      Ativo
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Inativo</Badge>
                  )}
                </div>
              </div>
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => {
                  setSelectedClient(null);
                  handleOpenIncident(selectedClient);
                }}>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Abrir Incidente
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Footer info */}
      {!loading && !error && (
        <div className="text-xs text-muted-foreground text-right">
          {filteredClients.length} cliente{filteredClients.length !== 1 ? 's' : ''} 
          {searchQuery && ` (filtrado de ${clients.length})`}
          {' '}• Dados da OPEN API
        </div>
      )}
    </div>
  );
}
