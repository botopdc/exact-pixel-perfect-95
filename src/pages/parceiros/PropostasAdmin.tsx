import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Search,
  X,
  Eye,
  FileDown,
  Loader2,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import {
  useAllPartnerProposals,
  useDeletePartnerProposal,
  PartnerProposal,
  PartnerProposalStatus,
} from '@/hooks/usePartnerProposals';
import { PartnerType } from '@/types/partner';
import { authService } from '@/services/authService';
import { formatCurrencyBRL } from '@/lib/calculatorConfig';
import { downloadProposalPdf } from '@/services/proposalPdfService';

// Status badge helper
function getStatusBadge(status: PartnerProposalStatus) {
  switch (status) {
    case 'Aceita':
      return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Aceita</Badge>;
    case 'Enviada':
      return <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30">Enviada</Badge>;
    case 'Cancelada':
      return <Badge className="bg-red-500/20 text-red-600 border-red-500/30">Cancelada</Badge>;
    case 'Rascunho':
    default:
      return <Badge variant="outline" className="text-muted-foreground">Rascunho</Badge>;
  }
}

export default function PropostasAdmin() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check admin access
  const session = authService.getSession();
  const isAdmin = session?.level === 1000;
  
  // Protect route: only admins can access
  useEffect(() => {
    if (!session || session.role !== 'admin') {
      // Redirect non-admins to partner proposals page
      navigate('/parceiro/propostas', { replace: true });
    }
  }, [navigate, session]);

  // Fetch all partner proposals (admin view)
  const { data: proposals = [], isLoading } = useAllPartnerProposals();
  const deleteProposalMutation = useDeletePartnerProposal();

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PartnerProposalStatus | 'all'>('all');
  const [partnerTypeFilter, setPartnerTypeFilter] = useState<PartnerType | 'all'>('all');
  const [partnerNameFilter, setPartnerNameFilter] = useState<string>('all');
  
  // Delete state
  const [deleteProposalId, setDeleteProposalId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get unique partner names for filter - filter out empty/null values to avoid Radix Select crash
  const partnerNames = useMemo(() => {
    const names = new Set(
      proposals
        .map(p => p.parceiro_nome)
        .filter((name): name is string => !!name && name.trim() !== '')
    );
    return Array.from(names).sort();
  }, [proposals]);

  // Filtered proposals
  const filteredProposals = useMemo(() => {
    return proposals.filter((p) => {
      // Filter by status
      if (statusFilter !== 'all' && p.status_proposta !== statusFilter) {
        return false;
      }

      // Filter by partner type
      if (partnerTypeFilter !== 'all' && p.tipo_parceria !== partnerTypeFilter) {
        return false;
      }

      // Filter by partner name
      if (partnerNameFilter !== 'all' && p.parceiro_nome !== partnerNameFilter) {
        return false;
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const clientName = (p.cliente_nome || '').toLowerCase();
        const proposalId = (p.proposta_id || '').toLowerCase();
        const partnerName = (p.parceiro_nome || '').toLowerCase();

        if (!clientName.includes(query) && !proposalId.includes(query) && !partnerName.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [proposals, statusFilter, partnerTypeFilter, partnerNameFilter, searchQuery]);

  const handleView = (proposalId: string) => {
    navigate(`/proposta/${proposalId}`);
  };

  const handleDownloadPDF = async (proposal: PartnerProposal) => {
    const proposalId = proposal.api_id ? String(proposal.api_id) : '';
    if (!proposalId) {
      toast({ title: 'Erro', description: 'ID da proposta não encontrado', variant: 'destructive' });
      return;
    }

    const result = await downloadProposalPdf(proposalId);
    if (result.success) {
      toast({ title: 'PDF gerado', description: 'O download do PDF foi iniciado' });
    } else {
      toast({ title: 'Erro', description: result.error || 'Erro ao gerar PDF', variant: 'destructive' });
    }
  };

  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString('pt-BR');
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPartnerTypeFilter('all');
    setPartnerNameFilter('all');
  };

  // Delete proposal handler (Admin only)
  const handleDelete = async () => {
    if (!deleteProposalId || !isAdmin) return;
    
    setIsDeleting(true);
    try {
      await deleteProposalMutation.mutateAsync(deleteProposalId);
      toast({ title: 'Proposta excluída', description: 'A proposta foi excluída com sucesso' });
      setDeleteProposalId(null);
    } catch (error: any) {
      toast({ 
        title: 'Erro ao excluir', 
        description: error.message || 'Falha ao excluir proposta',
        variant: 'destructive' 
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || partnerTypeFilter !== 'all' || partnerNameFilter !== 'all';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Propostas de Parceiros</h1>
        <p className="text-muted-foreground">Visualize todas as propostas criadas por parceiros</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4">
        {/* Search and Selects Row */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, parceiro ou ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 bg-card border-border"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchQuery('')}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Partner Name Filter */}
          <Select value={partnerNameFilter} onValueChange={(v) => setPartnerNameFilter(v as string)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Parceiro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Parceiros</SelectItem>
              {partnerNames
                .filter(name => name && name.trim() !== '')
                .map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
            </SelectContent>
          </Select>

          {/* Partner Type Filter */}
          <Select value={partnerTypeFilter} onValueChange={(v) => setPartnerTypeFilter(v as PartnerType | 'all')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Tipo Parceria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Tipos</SelectItem>
              <SelectItem value="ISV">ISV</SelectItem>
              <SelectItem value="VAR">VAR</SelectItem>
              <SelectItem value="FINDER">FINDER</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="gap-2">
              <X className="w-4 h-4" />
              Limpar Filtros
            </Button>
          )}
        </div>

        {/* Status Filter Buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
          >
            Todos
          </Button>
          <Button
            variant={statusFilter === 'Rascunho' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('Rascunho')}
          >
            Rascunho
          </Button>
          <Button
            variant={statusFilter === 'Enviada' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('Enviada')}
            className={statusFilter !== 'Enviada' ? 'text-blue-500 border-blue-500/30 hover:bg-blue-500/10' : ''}
          >
            Enviada
          </Button>
          <Button
            variant={statusFilter === 'Aceita' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('Aceita')}
            className={statusFilter !== 'Aceita' ? 'text-green-500 border-green-500/30 hover:bg-green-500/10' : ''}
          >
            Aceita
          </Button>
          <Button
            variant={statusFilter === 'Cancelada' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('Cancelada')}
            className={statusFilter !== 'Cancelada' ? 'text-red-500 border-red-500/30 hover:bg-red-500/10' : ''}
          >
            Cancelada
          </Button>
        </div>
      </div>

      {/* Proposals Table */}
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        {filteredProposals.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-muted-foreground text-lg mb-4">
              {proposals.length === 0
                ? 'Nenhuma proposta de parceiros encontrada.'
                : 'Nenhuma proposta encontrada com os filtros selecionados.'}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters}>
                Limpar Filtros
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Nº Proposta</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Parceiro</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Tipo</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Cliente</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium">Valor Total</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Data</th>
                  <th className="text-center py-3 px-4 text-muted-foreground font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredProposals.map((p) => {
                  const hasNoUser = !p.usuario_id;
                  return (
                    <tr key={p.proposta_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-4 px-4">
                        <span className="font-mono text-sm text-primary">{p.proposta_id.slice(0, 8)}...</span>
                      </td>
                      <td className="py-4 px-4 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          {p.parceiro_nome}
                          {hasNoUser && (
                            <span title="Sem usuário vinculado" className="text-amber-500">
                              <AlertTriangle className="w-4 h-4" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Badge variant="outline">{p.tipo_parceria}</Badge>
                      </td>
                      <td className="py-4 px-4 text-foreground">{p.cliente_nome}</td>
                      <td className="py-4 px-4 text-right font-semibold text-primary">
                        {formatCurrencyBRL(p.valor_total)}
                      </td>
                      <td className="py-4 px-4">{getStatusBadge(p.status_proposta)}</td>
                      <td className="py-4 px-4 text-muted-foreground">{formatDate(p.data_criacao)}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleView(p.proposta_id)}
                            className="text-primary hover:text-primary hover:bg-primary/10"
                            title="Visualizar proposta"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownloadPDF(p)}
                            className="text-primary hover:text-primary hover:bg-primary/10"
                            title="Baixar PDF"
                          >
                            <FileDown className="w-4 h-4" />
                          </Button>
                          {/* Delete button - Admin only */}
                          {isAdmin && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => setDeleteProposalId(p.proposta_id)}
                              className="text-red-500 hover:text-red-600 hover:bg-red-500/10" 
                              title="Excluir proposta"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Count */}
      {filteredProposals.length > 0 && (
        <div className="text-center text-muted-foreground">
          {filteredProposals.length} de {proposals.length} {proposals.length === 1 ? 'proposta' : 'propostas'}
        </div>
      )}

      {/* Delete Confirmation Dialog - Admin only */}
      <AlertDialog open={!!deleteProposalId} onOpenChange={(open) => !open && setDeleteProposalId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir proposta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Deseja excluir a proposta <strong>{deleteProposalId}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
