import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Plus, FileDown, Eye, Link as LinkIcon, Mail, Loader2, Pencil, BarChart3, Search, X, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import OpenLogo from './OpenLogo';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProposals, useUpdateProposalStatus, useDeleteProposal, SavedProposal, ProposalStatus, apiToLocal, statusToApiFormat } from '@/hooks/useProposals';
import { openApi } from '@/lib/openApi';
import { useTrackEvent } from '@/hooks/useProposalEvents';
import { downloadProposalPdf } from '@/services/proposalPdfService';
import { formatCurrency, formatCurrencyBRL, getValidityDate, formatDateBR } from '@/lib/calculatorConfig';
import ProposalAccessModal from './ProposalAccessModal';
import { Badge } from '@/components/ui/badge';
import { authService } from '@/services/authService';
import { ROUTES, getCalculatorRoute, getProposalEditRoute } from '@/config/routes';
import { useApprovalLink } from '@/hooks/useApprovalLink';
import { copyToClipboard } from '@/lib/clipboard';
import { LinkCopyModal } from '@/components/LinkCopyModal';
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
  const isManager = userLevel === 750;
  const isArchitect = userLevel === 690; // Architect has read-only access
  const canSeeExecutive = userLevel >= 750; // Manager (750) and Admin (1000) can see executive column
  const canCreateProposal = userLevel === 700 || userLevel === 750 || userLevel === 1000;
  // Architect can only: View, View Access, Download PDF
  const canEditProposal = !isArchitect;
  const canCopyLink = !isArchitect;
  const canSendEmail = !isArchitect;
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>('all');
  
  // Debounce search input for server-side filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to page 1 on search change
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, perPage]);
  
  // Convert internal status to API format for server-side filtering
  const getApiStatusFilter = useCallback((status: ProposalStatus | 'all'): string | undefined => {
    if (status === 'all') return undefined;
    // Convert DRAFT to empty string for API
    if (status === 'DRAFT') return '';
    return statusToApiFormat(status);
  }, []);
  
  // Fetch proposals with pagination and filters
  const { data, isLoading } = useProposals(currentPage, {
    status: getApiStatusFilter(statusFilter),
    search: debouncedSearch || undefined,
    perPage,
  });
  
  // Extract proposals and pagination from response (handle both formats for type safety)
  const paginatedData = data && 'proposals' in data ? data : null;
  const proposals = paginatedData?.proposals || [];
  const pagination = paginatedData?.pagination || { currentPage: 1, lastPage: 1, total: 0 };
  
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

  // Helper to get executive name from proposal with multiple fallbacks
  const getExecutiveName = (proposal: SavedProposal): string => {
    // 1. Try populated creator object (from __with=creator API expansion)
    if (proposal.creator?.name) return proposal.creator.name;
    
    // 2. Try dados_proposta snapshot (saved when proposal was created)
    if (proposal.dados_proposta?.created_by_name) return proposal.dados_proposta.created_by_name;
    
    // 3. Final fallback
    return '—';
  };

  // With server-side filtering, we use proposals directly (already filtered by API)
  const filteredProposals = proposals;

  const handleDownloadPDF = async (proposal: SavedProposal) => {
    // CRITICAL: Always use numeric ID (proposal.id), never display ID (proposal.proposal?.id = "OPEN-xxxx")
    const numericId = proposal.id;
    const displayId = proposal.proposal?.id || '';
    
    if (!numericId) {
      console.error('[SavedProposals] No numeric ID available for PDF download:', { displayId });
      toast({ title: 'Erro', description: 'ID numérico da proposta não encontrado', variant: 'destructive' });
      return;
    }
    
    console.log('[SavedProposals] Download PDF using numeric ID:', numericId, '(display:', displayId, ')');
    
    // Track PDF download using display ID for analytics
    if (displayId) {
      trackEvent.mutate({ proposalId: displayId, type: 'pdf_download', channel: 'ui' });
    }
    
    // Use unified PDF service with NUMERIC ID - always fetches from backend
    const result = await downloadProposalPdf(numericId);
    
    if (result.success) {
      toast({ title: 'PDF gerado', description: 'O download do PDF foi iniciado' });
    } else {
      toast({ title: 'Erro', description: result.error || 'Erro ao gerar PDF', variant: 'destructive' });
    }
  };

  // State for Safari fallback modal
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkModalUrl, setLinkModalUrl] = useState('');

  const handleCopyAcceptanceLink = async (proposal: SavedProposal) => {
    const displayProposalId = proposal.proposal?.id || '';
    const apiId = proposal.id ? String(proposal.id) : displayProposalId;
    
    setCopyingLinkId(displayProposalId);
    
    try {
      // Fetch approval token and generate link with it
      console.log('[SavedProposals] Getting approval link for:', apiId);
      const approvalLink = await getApprovalLink(apiId);
      
      // Try to copy to clipboard (with Safari fallback)
      const copySuccess = await copyToClipboard(approvalLink);
      
      // Track link copy
      if (displayProposalId) {
        trackEvent.mutate({ proposalId: displayProposalId, type: 'link_copy', channel: 'ui' });
        
        // Update status to SENT if still DRAFT
        if (!proposal.status || proposal.status === 'DRAFT') {
          console.log('[SavedProposals] Updating status to SENT:', { displayProposalId, apiId });
          await updateStatusMutation.mutateAsync({ id: apiId, status: 'SENT' });
        }
      }
      
      if (copySuccess) {
        toast({ title: 'Link copiado!', description: 'O link de aprovação com token foi copiado para a área de transferência' });
      } else {
        // Safari blocked copy - show modal with selectable link
        setLinkModalUrl(approvalLink);
        setLinkModalOpen(true);
        toast({ 
          title: 'Copie o link manualmente', 
          description: 'O Safari bloqueou a cópia automática. Use o modal para copiar o link.',
        });
      }
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
    // Block editing for architects (level 690)
    if (isArchitect) {
      toast({ 
        title: 'Acesso restrito', 
        description: 'Arquitetos não podem editar propostas', 
        variant: 'destructive' 
      });
      return;
    }
    
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
    
    // Navigate to modular calculator with edit mode
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
      
      // Always navigate to the modular calculator route with proposal data
      const editPath = getProposalEditRoute(apiId, false);
      navigate(editPath, { state: { editProposal: localProposal } });
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
                // Always use modular route for new proposals
                navigate(ROUTES.modulos.comercial.proposalNew);
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
                  <Button variant="open" onClick={() => navigate(ROUTES.modulos.comercial.proposalNew)}>Criar Nova Proposta</Button>
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
                      {canSeeExecutive && (
                        <th className="text-left py-3 px-4 text-muted-foreground font-medium">Executivo</th>
                      )}
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
                          {canSeeExecutive && (
                            <td className="py-4 px-4 text-muted-foreground">{getExecutiveName(p)}</td>
                          )}
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
                              {/* View - Always visible */}
                              <Button variant="ghost" size="icon" onClick={() => handleView(proposalId)} className="text-primary hover:text-primary hover:bg-primary/10" title="Visualizar proposta">
                                <Eye className="w-4 h-4" />
                              </Button>
                              {/* Edit - Hidden for architects (level 690) */}
                              {canEditProposal && (
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
                              )}
                              {/* View Access - Always visible */}
                              <Button variant="ghost" size="icon" onClick={() => handleViewAccess(proposalId)} className="text-primary hover:text-primary hover:bg-primary/10" title="Ver acessos">
                                <BarChart3 className="w-4 h-4" />
                              </Button>
                              {/* Copy Link - Hidden for architects (level 690) */}
                              {canCopyLink && (
                                <Button variant="ghost" size="icon" onClick={() => handleCopyAcceptanceLink(p)} className="text-primary hover:text-primary hover:bg-primary/10" title="Copiar link de aprovação" disabled={copyingLinkId === proposalId}>
                                  {copyingLinkId === proposalId ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                                </Button>
                              )}
                              {/* Send Email - Hidden for architects (level 690) */}
                              {canSendEmail && (
                                <Button variant="ghost" size="icon" onClick={() => handleSendEmail(p)} className="text-primary hover:text-primary hover:bg-primary/10" title={hasEmail ? "Enviar por email" : "Sem email cadastrado"} disabled={!hasEmail || sendingEmailId === proposalId}>
                                  {sendingEmailId === proposalId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                                </Button>
                              )}
                              {/* Download PDF - Always visible */}
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

          {/* Pagination Controls */}
          {pagination.total > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
              {/* Items per page selector */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Exibir</span>
                <Select 
                  value={String(perPage)} 
                  onValueChange={(value) => setPerPage(Number(value))}
                >
                  <SelectTrigger className="w-[70px] h-8 bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="15">15</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span>por página</span>
              </div>
              
              {/* Page info and navigation */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Página {pagination.currentPage} de {pagination.lastPage} ({pagination.total} {pagination.total === 1 ? 'proposta' : 'propostas'})
                </span>
                
                <div className="flex items-center gap-1">
                  {/* First page */}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(1)}
                    disabled={pagination.currentPage <= 1 || isLoading}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  
                  {/* Previous page */}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={pagination.currentPage <= 1 || isLoading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  {/* Next page */}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(p => Math.min(pagination.lastPage, p + 1))}
                    disabled={pagination.currentPage >= pagination.lastPage || isLoading}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  
                  {/* Last page */}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(pagination.lastPage)}
                    disabled={pagination.currentPage >= pagination.lastPage || isLoading}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
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

      {/* Link Copy Modal for Safari fallback */}
      <LinkCopyModal
        open={linkModalOpen}
        onOpenChange={setLinkModalOpen}
        link={linkModalUrl}
      />
    </div>
  );
};

export default SavedProposals;