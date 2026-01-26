import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  X,
  Eye,
  Pencil,
  Copy,
  FileDown,
  Plus,
  Loader2,
} from 'lucide-react';
import {
  usePartnerProposals,
  useDuplicatePartnerProposal,
  PartnerProposal,
  PartnerProposalStatus,
} from '@/hooks/usePartnerProposals';
import { partnerAuthService } from '@/services/partnersService';
import { formatCurrencyBRL } from '@/lib/calculatorConfig';
import { downloadProposalPdfFromApi } from '@/services/proposalPdfService';
import { ROUTES } from '@/config/routes';
import { openApi } from '@/lib/openApi';
import { apiToLocal } from '@/hooks/useProposals';

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

export default function PropostasParceiro() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check partner session - redirect if not logged in
  useEffect(() => {
    const session = partnerAuthService.getSession();
    if (!session) {
      navigate(ROUTES.parceiro.login, { replace: true });
    }
  }, [navigate]);

  // Fetch partner proposals (filtered by current user)
  const { data: proposals = [], isLoading } = usePartnerProposals(false);
  const duplicateMutation = useDuplicatePartnerProposal();

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PartnerProposalStatus | 'all'>('all');
  const [editingId, setEditingId] = useState<number | null>(null);

  // Filtered proposals
  const filteredProposals = useMemo(() => {
    return proposals.filter((p) => {
      // Filter by status
      if (statusFilter !== 'all' && p.status_proposta !== statusFilter) {
        return false;
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const clientName = (p.cliente_nome || '').toLowerCase();
        const proposalId = (p.proposta_id || '').toLowerCase();

        if (!clientName.includes(query) && !proposalId.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [proposals, statusFilter, searchQuery]);

  const handleView = (proposalId: string) => {
    navigate(`/proposta/${proposalId}`);
  };

  const handleEdit = async (proposal: PartnerProposal) => {
    if (proposal.status_proposta !== 'Rascunho') {
      toast({
        title: 'Edição bloqueada',
        description: 'Apenas rascunhos podem ser editados',
        variant: 'destructive',
      });
      return;
    }

    const apiId = proposal.api_id;
    if (!apiId) {
      toast({
        title: 'Erro ao carregar proposta',
        description: 'ID da proposta não encontrado',
        variant: 'destructive',
      });
      return;
    }

    console.log('[PropostasParceiro] Edit clicked - fetching complete proposal from API', {
      apiId,
      proposalId: proposal.proposta_id,
    });

    // CRITICAL: Always fetch the complete proposal from API before navigating
    // The list data may NOT contain complete dados_proposta, causing hydration failures
    setEditingId(apiId);

    try {
      const fullProposal = await openApi.getProposal(apiId);

      console.log('[PropostasParceiro] Fetched complete proposal from API:', {
        apiId,
        hasDadosProposta: Boolean((fullProposal as any)?.dados_proposta),
        hasItems: Boolean((fullProposal as any)?.items),
        itemsCount: (fullProposal as any)?.items?.length || 0,
      });

      // Convert API response to local format for calculator hydration
      const localProposal = apiToLocal(fullProposal as any);

      console.log('[PropostasParceiro] Converted to local format:', {
        hasClient: Boolean(localProposal.client),
        itemsCount: localProposal.items?.length || 0,
        storageItemsCount: localProposal.storageItems?.length || 0,
        kubernetesEnabled: localProposal.kubernetes?.enabled,
        openSaasEnabled: localProposal.openSaas?.enabled,
      });

      navigate(ROUTES.parceiro.calculator, { state: { editProposal: localProposal } });
    } catch (error: any) {
      console.error('[PropostasParceiro] Error fetching complete proposal:', error);
      toast({
        title: 'Erro ao carregar proposta',
        description: error.message || 'Falha ao buscar dados completos da proposta',
        variant: 'destructive',
      });
    } finally {
      setEditingId(null);
    }
  };

  const handleDuplicate = async (proposalId: string) => {
    try {
      await duplicateMutation.mutateAsync(proposalId);
      toast({ title: 'Proposta duplicada!', description: 'Uma cópia foi criada como rascunho' });
    } catch (error: any) {
      toast({
        title: 'Erro ao duplicar',
        description: error.message || 'Falha ao duplicar proposta',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadPDF = async (proposal: PartnerProposal) => {
    // Use numeric api_id for API calls
    const numericId = proposal.api_id;
    if (!numericId) {
      toast({ title: 'Erro', description: 'ID da proposta não encontrado', variant: 'destructive' });
      return;
    }

    // Use downloadProposalPdfFromApi which prioritizes API download with file_access_token
    const result = await downloadProposalPdfFromApi(numericId);
    if (result.success) {
      toast({ title: 'PDF baixado', description: 'O download do PDF foi iniciado' });
    } else {
      toast({ title: 'Erro', description: result.error || 'Erro ao baixar PDF', variant: 'destructive' });
    }
  };

  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString('pt-BR');
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Propostas Salvas</h1>
          <p className="text-muted-foreground">Gerencie suas propostas comerciais</p>
        </div>
        <Button onClick={() => navigate(ROUTES.parceiro.calculator)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Proposta
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente ou ID..."
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

        {/* Status Filter */}
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
                ? 'Nenhuma proposta salva ainda.'
                : 'Nenhuma proposta encontrada com os filtros selecionados.'}
            </p>
            {proposals.length === 0 ? (
              <Button onClick={() => navigate(ROUTES.parceiro.calculator)}>Criar Nova Proposta</Button>
            ) : (
              <Button variant="outline" onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}>
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
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Cliente</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Data</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Tipo Parceria</th>
                  <th className="text-right py-3 px-4 text-muted-foreground font-medium">Valor Total</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Status</th>
                  <th className="text-center py-3 px-4 text-muted-foreground font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredProposals.map((p) => {
                  const canEdit = p.status_proposta === 'Rascunho';

                  return (
                    <tr key={p.proposta_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-4 px-4">
                        <span className="font-mono text-sm text-primary">{p.proposta_id.slice(0, 8)}...</span>
                      </td>
                      <td className="py-4 px-4 font-medium text-foreground">{p.cliente_nome}</td>
                      <td className="py-4 px-4 text-muted-foreground">{formatDate(p.data_criacao)}</td>
                      <td className="py-4 px-4">
                        <Badge variant="outline">{p.tipo_parceria}</Badge>
                      </td>
                      <td className="py-4 px-4 text-right font-semibold text-primary">
                        {formatCurrencyBRL(p.valor_total)}
                      </td>
                      <td className="py-4 px-4">{getStatusBadge(p.status_proposta)}</td>
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
                            onClick={() => handleEdit(p)}
                            className={canEdit ? 'text-primary hover:text-primary hover:bg-primary/10' : 'text-muted-foreground opacity-50 cursor-not-allowed'}
                            title={canEdit ? 'Editar proposta' : 'Apenas rascunhos podem ser editados'}
                            disabled={!canEdit || editingId === p.api_id}
                          >
                            {editingId === p.api_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDuplicate(p.proposta_id)}
                            className="text-primary hover:text-primary hover:bg-primary/10"
                            title="Duplicar proposta"
                            disabled={duplicateMutation.isPending}
                          >
                            {duplicateMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
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
    </div>
  );
}
