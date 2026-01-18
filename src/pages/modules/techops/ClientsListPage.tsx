// ============================================================================
// CLIENTS LIST PAGE - Using OPEN API (level=1 clients)
// ============================================================================

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  Plus,
  Search,
  RefreshCw,
  Mail,
  Hash,
  Calendar,
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
import { ModuleHeader } from '@/components/navigation/ModuleCard';
import { useOpenApiClients } from '@/hooks/useOpenApiClients';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ClientsListPage() {
  const navigate = useNavigate();
  const { clients, loading, error, refresh } = useOpenApiClients();
  const [searchQuery, setSearchQuery] = useState('');

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

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Clientes"
        description="Diretório de clientes do sistema OPEN (level=1)"
        icon={Building2}
        actions={
          <Button 
            variant="outline" 
            disabled
            title="Cadastro de clientes é feito via Admin > Gestão de Usuários"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Cliente
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
        <Button
          variant="outline"
          size="icon"
          onClick={refresh}
          disabled={loading}
          title="Recarregar lista de clientes"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
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
                </TableRow>
              ))
            ) : filteredClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => {
                    // For now, just show client info - no detail page yet for OPEN clients
                    console.log('Cliente selecionado:', client);
                  }}
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
