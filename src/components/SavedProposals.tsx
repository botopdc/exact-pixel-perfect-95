import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Plus, FileDown, Eye, Link as LinkIcon, Mail, Loader2, Pencil, BarChart3, Search, X, Trash2 } from 'lucide-react';
import OpenLogo from './OpenLogo';
import { useProposals, useUpdateProposalStatus, useDeleteProposal, SavedProposal, ProposalStatus, apiToLocal } from '@/hooks/useProposals';
import { openApi } from '@/lib/openApi';
import { useTrackEvent } from '@/hooks/useProposalEvents';
import { generateOpenPDF } from '@/lib/pdfGenerator';
import { formatCurrency, formatCurrencyBRL, getValidityDate, formatDateBR } from '@/lib/calculatorConfig';
import ProposalAccessModal from './ProposalAccessModal';
import { Badge } from '@/components/ui/badge';
import { authService } from '@/services/authService';
import { ROUTES, getCalculatorRoute } from '@/config/routes';
import { useApprovalLink } from '@/hooks/useApprovalLink';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Status display helper - shows badge with color and tooltip for STANDARDIZED status
function getStatusBadge(status: ProposalStatus | undefined) {
  // Default to DRAFT if no status
  const normalizedStatus = status || 'DRAFT';
  
  switch (normalizedStatus) {
    case 'DRAFT':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="bg-muted text-muted-foreground border-muted-foreground/30 hover:bg-muted/80 font-medium text-xs px-2">Rascunho</Badge>
          </TooltipTrigger>
          <TooltipContent>Rascunho - Proposta ainda não enviada</TooltipContent>
        </Tooltip>
      );
    case 'SENT':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="bg-sky-500/20 text-sky-600 border-sky-500/30 hover:bg-sky-500/30 font-medium text-xs px-2">Enviado</Badge>
          </TooltipTrigger>
          <TooltipContent>Enviado para o cliente</TooltipContent>
        </Tooltip>
      );
    case 'APPROVED':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="bg-green-500/20 text-green-600 border-green-500/30 hover:bg-green-500/30 font-medium text-xs px-2">Aprovado</Badge>
          </TooltipTrigger>
          <TooltipContent>Proposta aprovada pelo cliente</TooltipContent>
        </Tooltip>
      );
    case 'REJECTED':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="bg-red-500/20 text-red-600 border-red-500/30 hover:bg-red-500/30 font-medium text-xs px-2">Recusado</Badge>
          </TooltipTrigger>
          <TooltipContent>Proposta recusada pelo cliente</TooltipContent>
        </Tooltip>
      );
    case 'EXPIRED':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30 hover:bg-orange-500/30 font-medium text-xs px-2">Expirado</Badge>
          </TooltipTrigger>
          <TooltipContent>Proposta expirada - validade vencida</TooltipContent>
        </Tooltip>
      );
    default:
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="bg-muted text-muted-foreground border-muted-foreground/30 hover:bg-muted/80 font-medium text-xs px-2">Rascunho</Badge>
          </TooltipTrigger>
          <TooltipContent>Rascunho - Proposta ainda não enviada</TooltipContent>
        </Tooltip>
      );
  }
}

// Get ID color class based on status
function getIdColorClass(status: ProposalStatus | undefined): string {
  switch (status) {
    case 'APPROVED':
      return 'text-green-600';
    case 'REJECTED':
      return 'text-red-600';
    case 'EXPIRED':
      return 'text-orange-600';
    default:
      return 'text-primary';
  }
}

const SavedProposals: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Auth check for admin and executive permissions
  const session = authService.getSession();
  const userLevel = session?.level || 0;
  const isAdmin = userLevel === 1000;
  const canCreateProposal = userLevel === 700 || userLevel === 750 || userLevel === 1000;
  
  // Local storage hooks
  const { data: proposals = [], isLoading } = useProposals();
  const updateStatusMutation = useUpdateProposalStatus();
  const deleteProposalMutation = useDeleteProposal();
  const trackEvent = useTrackEvent();
  const { getApprovalLink, isLoading: isLoadingApprovalLink } = useApprovalLink();

  // State for actions
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [copyingLinkId, setCopyingLinkId] = useState<string | null>(null);
  const [accessModalProposalId, setAccessModalProposalId] = useState<string | null>(null);
  const [deleteProposalId, setDeleteProposalId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>('all');

  // Filtered proposals
  const filteredProposals = useMemo(() => {
    return proposals.filter((p) => {
      // Filter by status
      if (statusFilter !== 'all') {
        const proposalStatus = p.status || 'DRAFT'; // Default to DRAFT
        if (proposalStatus !== statusFilter) return false;
      }
      
      // Filter by search query (client name or company)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const clientName = (p.client?.name || '').toLowerCase();
        const companyName = (p.client?.company || '').toLowerCase();
        const proposalId = (p.proposal?.id || '').toLowerCase();
        
        if (!clientName.includes(query) && !companyName.includes(query) && !proposalId.includes(query)) {
          return false;
        }
      }
      
      return true;
    });
  }, [proposals, statusFilter, searchQuery]);

  const handleDownloadPDF = (proposal: SavedProposal) => {
    if (!proposal.result) {
      toast({ title: 'Erro', description: 'Dados da proposta incompletos', variant: 'destructive' });
      return;
    }
    
    const proposalId = proposal.proposal?.id || '';
    
    // Track PDF download
    if (proposalId) {
      trackEvent.mutate({ proposalId, type: 'pdf_download', channel: 'ui' });
    }
    
    generateOpenPDF({
      client: proposal.client,
      proposal: proposal.proposal,
      result: proposal.result,
      selectedTerm: proposal.selectedTerm,
      datacenter: proposal.datacenter || 'SP1',
    });
    toast({ title: 'PDF gerado', description: 'O download do PDF foi iniciado' });
  };

  const handleCopyAcceptanceLink = async (proposal: SavedProposal) => {
    const displayProposalId = proposal.proposal?.id || '';
    const apiId = proposal.id ? String(proposal.id) : displayProposalId;
    
    setCopyingLinkId(displayProposalId);
    
    try {
      // Fetch approval token and generate link with it
      console.log('[SavedProposals] Getting approval link for:', apiId);
      const approvalLink = await getApprovalLink(apiId);
      
      // Copy to clipboard
      await navigator.clipboard.writeText(approvalLink);
      
      // Track link copy
      if (displayProposalId) {
        trackEvent.mutate({ proposalId: displayProposalId, type: 'link_copy', channel: 'ui' });
        
        // Update status to SENT if still DRAFT
        if (!proposal.status || proposal.status === 'DRAFT') {
          console.log('[SavedProposals] Updating status to SENT:', { displayProposalId, apiId });
          await updateStatusMutation.mutateAsync({ id: apiId, status: 'SENT' });
        }
      }
      
      toast({ title: 'Link copiado!', description: 'O link de aprovação com token foi copiado para a área de transferência' });
    } catch (error: any) {
      console.error('[SavedProposals] Error getting approval link:', error);
      toast({ 
        title: 'Erro ao gerar link', 
        description: error.message || 'Não foi possível gerar o link de aprovação',
        variant: 'destructive' 
      });
    } finally {
      setCopyingLinkId(null);
    }
  };

  const handleView = (proposalId: string) => {
    navigate(`/proposta/${proposalId}`);
  };

  // State for loading edit
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleEdit = async (proposal: SavedProposal) => {
    // Block editing of approved or rejected proposals
    if (proposal.status === 'APPROVED') {
      toast({ 
        title: 'Edição bloqueada', 
        description: 'Propostas aprovadas não podem ser editadas', 
        variant: 'destructive' 
      });
      return;
    }
    if (proposal.status === 'REJECTED') {
      toast({ 
        title: 'Edição bloqueada', 
        description: 'Propostas recusadas não podem ser editadas', 
        variant: 'destructive' 
      });
      return;
    }
    
    const apiId = proposal.id;
    const displayProposalId = proposal.proposal?.id || '';
    
    // Track edit open
    if (displayProposalId) {
      trackEvent.mutate({ proposalId: displayProposalId, type: 'edit_open', channel: 'ui' });
    }
    
    // Navigate to calculator with edit mode - use centralized route config
    const userLevel = session?.level || 0;
    const calculatorPath = getCalculatorRoute(userLevel, false); // false = not a partner context
    
    console.log('[SavedProposals] Edit clicked - fetching complete proposal from API', { 
      apiId,
      displayId: displayProposalId,
    });
    
    // CRITICAL: Always fetch the complete proposal from API before navigating
    // The list data does NOT contain dados_proposta, causing hydration failures for Storage/K8s/OpenSaaS
    if (!apiId) {
      toast({
        title: 'Erro ao carregar proposta',
        description: 'ID da proposta não encontrado',
        variant: 'destructive',
      });
      return;
    }
    
    setEditingId(String(apiId));
    
    try {
      const fullProposal = await openApi.getProposal(apiId);
      
      console.log('[SavedProposals] Fetched complete proposal from API:', {
        apiId,
        hasDadosProposta: Boolean((fullProposal as any)?.dados_proposta),
        hasItems: Boolean((fullProposal as any)?.items),
        itemsCount: (fullProposal as any)?.items?.length || 0,
      });
      
      // Convert API response to local format for calculator hydration
      const localProposal = apiToLocal(fullProposal as any);
      
      console.log('[SavedProposals] Converted to local format:', {
        hasClient: Boolean(localProposal.client),
        itemsCount: localProposal.items?.length || 0,
        storageItemsCount: localProposal.storageItems?.length || 0,
        kubernetesEnabled: localProposal.kubernetes?.enabled,
        openSaasEnabled: localProposal.openSaas?.enabled,
      });
      
      navigate(calculatorPath, { state: { editProposal: localProposal } });
    } catch (error: any) {
      console.error('[SavedProposals] Error fetching complete proposal:', error);
      toast({
        title: 'Erro ao carregar proposta',
        description: error.message || 'Falha ao buscar dados completos da proposta',
        variant: 'destructive',
      });
    } finally {
      setEditingId(null);
    }
  };

  const handleViewAccess = (proposalId: string) => {
    setAccessModalProposalId(proposalId);
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

  const handleSendEmail = async (proposal: SavedProposal) => {
    if (!proposal.client?.email?.trim()) {
      toast({ title: 'Erro', description: 'Esta proposta não possui e-mail do cliente', variant: 'destructive' });
      return;
    }

    const displayProposalId = proposal.proposal?.id || '';
    const apiId = proposal.id ? String(proposal.id) : displayProposalId;
    const validityDateStr = proposal.proposal?.createdAt && proposal.proposal?.validityDays 
      ? getValidityDate(proposal.proposal.createdAt, proposal.proposal.validityDays).toLocaleDateString('pt-BR')
      : '-';
    
    setSendingEmailId(displayProposalId);

    try {
      // CRITICAL: First fetch approval token and build tokenized link
      console.log('[SavedProposals] Fetching approval link for email send:', apiId);
      let proposalLink: string;
      
      try {
        proposalLink = await getApprovalLink(apiId);
        console.log('[SavedProposals] Got tokenized approval link for email');
      } catch (linkError: any) {
        console.error('[SavedProposals] Failed to get approval link:', linkError);
        toast({ 
          title: 'Erro ao gerar link', 
          description: linkError.message || 'Não foi possível gerar link de aprovação com token',
          variant: 'destructive' 
        });
        setSendingEmailId(null);
        return; // Block email send if we can't get token
      }
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/send-proposal-email`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientName: proposal.client.name || proposal.client.company || 'Cliente',
            clientEmail: proposal.client.email,
            proposalId: displayProposalId,
            proposalLink, // Now uses tokenized link
            totalValue: `R$ ${formatCurrency(proposal.result?.grandTotal || 0)}`,
            validityDate: validityDateStr,
          }),
        }
      );
      
      const resultData = await response.json();
      
      if (!response.ok || !resultData.success) {
        throw new Error(resultData.error || 'Falha ao enviar email');
      }
      
      // Track email send
      trackEvent.mutate({ proposalId: displayProposalId, type: 'email_send', channel: 'ui' });
      
      // Update status to SENT if still DRAFT
      if (!proposal.status || proposal.status === 'DRAFT') {
        console.log('[SavedProposals] Updating status to SENT after email:', { displayProposalId, apiId });
        await updateStatusMutation.mutateAsync({ id: apiId, status: 'SENT' });
      }
      
      toast({ title: 'Email enviado!', description: `Proposta enviada para ${proposal.client.email}` });
    } catch (error: any) {
      toast({ 
        title: 'Erro ao enviar email', 
        description: error.message || 'Falha ao enviar email',
        variant: 'destructive' 
      });
    } finally {
      setSendingEmailId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <OpenLogo />
            <div className="h-10 w-40 bg-muted/50 animate-pulse rounded" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto space-y-4">
            <div className="h-8 w-64 mx-auto bg-muted/50 animate-pulse rounded" />
            <div className="h-64 w-full bg-muted/50 animate-pulse rounded" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <OpenLogo />
          {canCreateProposal && (
            <Button 
              variant="open" 
              onClick={() => {
                const calculatorPath = getCalculatorRoute(userLevel, false);
                navigate(calculatorPath);
              }}
            >
              <Plus className="w-4 h-4" />
              Nova Proposta
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Page Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Propostas Salvas</h1>
            <p className="text-muted-foreground">Gerencie e visualize suas propostas comerciais</p>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
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
                variant={statusFilter === 'all' ? 'open' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                Todos
              </Button>
              <Button
                variant={statusFilter === 'DRAFT' ? 'open' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('DRAFT')}
                className={statusFilter === 'DRAFT' ? '' : 'text-muted-foreground'}
              >
                Rascunho
              </Button>
              <Button
                variant={statusFilter === 'SENT' ? 'open' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('SENT')}
                className={statusFilter === 'SENT' ? '' : 'text-sky-500 border-sky-500/30 hover:bg-sky-500/10'}
              >
                Enviado
              </Button>
              <Button
                variant={statusFilter === 'APPROVED' ? 'open' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('APPROVED')}
                className={statusFilter === 'APPROVED' ? '' : 'text-green-500 border-green-500/30 hover:bg-green-500/10'}
              >
                Aprovado
              </Button>
              <Button
                variant={statusFilter === 'REJECTED' ? 'open' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('REJECTED')}
                className={statusFilter === 'REJECTED' ? '' : 'text-red-500 border-red-500/30 hover:bg-red-500/10'}
              >
                Recusado
              </Button>
              <Button
                variant={statusFilter === 'EXPIRED' ? 'open' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('EXPIRED')}
                className={statusFilter === 'EXPIRED' ? '' : 'text-orange-500 border-orange-500/30 hover:bg-orange-500/10'}
              >
                Expirado
              </Button>
            </div>
          </div>

          {/* Proposals Table */}
          <div className="open-card overflow-hidden">
            {filteredProposals.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-muted-foreground text-lg mb-4">
                  {proposals.length === 0 
                    ? 'Nenhuma proposta salva ainda.' 
                    : 'Nenhuma proposta encontrada com os filtros selecionados.'}
                </p>
                {proposals.length === 0 ? (
                  <Button variant="open" onClick={() => navigate('/')}>Criar Nova Proposta</Button>
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
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Cliente</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">ID Proposta</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Status</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Data Criação</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Validade</th>
                      <th className="text-right py-3 px-4 text-muted-foreground font-medium">Valor Total</th>
                      <th className="text-center py-3 px-4 text-muted-foreground font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProposals.map((p) => {
                      const clientName = p.client?.name || p.client?.company || 'Sem nome';
                      const proposalId = p.proposal?.id || '-';
                      const createdAt = p.proposal?.createdAt ? formatDateBR(p.proposal.createdAt) : '-';
                      const validityDate = p.proposal?.createdAt && p.proposal?.validityDays 
                        ? getValidityDate(p.proposal.createdAt, p.proposal.validityDays).toLocaleDateString('pt-BR')
                        : '-';
                      const total = p.total || 0;
                      const hasEmail = !!p.client?.email?.trim();

                      return (
                        <tr key={proposalId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="py-4 px-4 font-medium text-foreground">{clientName}</td>
                          <td className="py-4 px-4">
                            <span className={`font-mono text-sm font-semibold ${getIdColorClass(p.status)}`}>{proposalId}</span>
                          </td>
                          <td className="py-4 px-4">
                            <TooltipProvider>
                              {getStatusBadge(p.status)}
                            </TooltipProvider>
                          </td>
                          <td className="py-4 px-4 text-muted-foreground">{createdAt}</td>
                          <td className="py-4 px-4 text-muted-foreground">{validityDate}</td>
                          <td className="py-4 px-4 text-right font-semibold text-primary">{formatCurrencyBRL(total)}</td>
                          <td className="py-4 px-4">
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => handleView(proposalId)} className="text-primary hover:text-primary hover:bg-primary/10" title="Visualizar proposta">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleEdit(p)} 
                                className={(p.status === 'APPROVED' || p.status === 'REJECTED') ? "text-muted-foreground cursor-not-allowed opacity-50" : "text-primary hover:text-primary hover:bg-primary/10"} 
                                title={(p.status === 'APPROVED' || p.status === 'REJECTED') ? "Proposta finalizada não pode ser editada" : "Editar proposta"}
                                disabled={p.status === 'APPROVED' || p.status === 'REJECTED' || editingId === String(p.id)}
                              >
                                {editingId === String(p.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleViewAccess(proposalId)} className="text-primary hover:text-primary hover:bg-primary/10" title="Ver acessos">
                                <BarChart3 className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleCopyAcceptanceLink(p)} className="text-primary hover:text-primary hover:bg-primary/10" title="Copiar link de aprovação" disabled={copyingLinkId === proposalId}>
                                {copyingLinkId === proposalId ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleSendEmail(p)} className="text-primary hover:text-primary hover:bg-primary/10" title={hasEmail ? "Enviar por email" : "Sem email cadastrado"} disabled={!hasEmail || sendingEmailId === proposalId}>
                                {sendingEmailId === proposalId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDownloadPDF(p)} className="text-primary hover:text-primary hover:bg-primary/10" title="Baixar PDF">
                                <FileDown className="w-4 h-4" />
                              </Button>
                              {/* Delete button - Admin only */}
                              {isAdmin && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => setDeleteProposalId(proposalId)}
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

          {filteredProposals.length > 0 && (
            <div className="text-center mt-6 text-muted-foreground">
              {filteredProposals.length} de {proposals.length} {proposals.length === 1 ? 'proposta' : 'propostas'}
            </div>
          )}
        </div>
      </main>

      {/* Access Modal */}
      <ProposalAccessModal
        proposalId={accessModalProposalId}
        open={!!accessModalProposalId}
        onOpenChange={(open) => !open && setAccessModalProposalId(null)}
      />

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
};

export default SavedProposals;