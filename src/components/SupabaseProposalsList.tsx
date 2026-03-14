/**
 * Supabase Proposals List Component
 * 
 * This component displays proposals using Edge Functions with Service Role.
 * The CORE auth token is passed to the Edge Functions for authorization.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Eye, Pencil, Trash2, Search, X,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  FileDown, Loader2, Mail, Link as LinkIcon, BarChart3,
  Filter, ArrowUpDown, CalendarIcon, RotateCcw, FileSignature,
} from 'lucide-react';
import OpenLogo from '@/components/OpenLogo';
import { supabase } from '@/integrations/supabase/client';
import { saveProposal, getProposal as getProposalFromEdge } from '@/services/proposalApi';
import { trackProposalEvent } from '@/services/proposalTrackingService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { authService } from '@/services/authService';
import { ROUTES, getProposalEditRoute } from '@/config/routes';
import { formatCurrency } from '@/lib/calculatorConfig';
import { useApprovalLink } from '@/hooks/useApprovalLink';
import { copyToClipboard } from '@/lib/clipboard';
import { LinkCopyModal } from '@/components/LinkCopyModal';
import {
  useProposalList,
  useDeleteProposal,
} from '@/hooks/useProposalApi';
import type { ProposalRow } from '@/services/proposalApi';
import ProposalAccessModal from '@/components/ProposalAccessModal';

// Status badge helper
function getStatusBadge(status: string | undefined) {
  const normalizedStatus = status || 'Rascunho';
  
  switch (normalizedStatus) {
    case 'Rascunho':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="bg-muted text-muted-foreground border-muted-foreground/30 hover:bg-muted/80 font-medium text-xs px-2">Rascunho</Badge>
          </TooltipTrigger>
          <TooltipContent>Proposta ainda não enviada</TooltipContent>
        </Tooltip>
      );
    case 'Enviado':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="bg-sky-500/20 text-sky-600 border-sky-500/30 hover:bg-sky-500/30 font-medium text-xs px-2">Enviado</Badge>
          </TooltipTrigger>
          <TooltipContent>Enviado para o cliente</TooltipContent>
        </Tooltip>
      );
    case 'Aprovado':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="bg-green-500/20 text-green-600 border-green-500/30 hover:bg-green-500/30 font-medium text-xs px-2">Aprovado</Badge>
          </TooltipTrigger>
          <TooltipContent>Proposta aprovada pelo cliente</TooltipContent>
        </Tooltip>
      );
    case 'Recusado':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="bg-red-500/20 text-red-600 border-red-500/30 hover:bg-red-500/30 font-medium text-xs px-2">Recusado</Badge>
          </TooltipTrigger>
          <TooltipContent>Proposta recusada pelo cliente</TooltipContent>
        </Tooltip>
      );
    case 'Expirado':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30 hover:bg-orange-500/30 font-medium text-xs px-2">Expirado</Badge>
          </TooltipTrigger>
          <TooltipContent>Proposta expirada</TooltipContent>
        </Tooltip>
      );
    case 'Cancelado':
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="bg-gray-500/20 text-gray-600 border-gray-500/30 hover:bg-gray-500/30 font-medium text-xs px-2">Cancelado</Badge>
          </TooltipTrigger>
          <TooltipContent>Proposta cancelada</TooltipContent>
        </Tooltip>
      );
    default:
      return (
        <Badge className="bg-muted text-muted-foreground border-muted-foreground/30 font-medium text-xs px-2">{normalizedStatus}</Badge>
      );
  }
}

// Sort options
const SORT_OPTIONS = [
  { value: 'created_at:desc', label: 'Data: mais recentes' },
  { value: 'created_at:asc', label: 'Data: mais antigas' },
  { value: 'name:asc', label: 'Cliente: A → Z' },
  { value: 'name:desc', label: 'Cliente: Z → A' },
  { value: 'company:asc', label: 'Empresa: A → Z' },
  { value: 'company:desc', label: 'Empresa: Z → A' },
  { value: 'total:desc', label: 'Valor: maior → menor' },
  { value: 'total:asc', label: 'Valor: menor → maior' },
  { value: 'status:asc', label: 'Status: A → Z' },
  { value: 'status:desc', label: 'Status: Z → A' },
];

const SupabaseProposalsList: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Auth check
  const session = authService.getSession();
  const userLevel = session?.level || 0;
  const isAdmin = userLevel === 1000;
  const isArchitect = userLevel === 690;
  const canCreateProposal = userLevel === 700 || userLevel === 750 || userLevel === 1000;
  const canCopyLink = !isArchitect;
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [clientName, setClientName] = useState('');
  const [debouncedClientName, setDebouncedClientName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [debouncedCompanyName, setDebouncedCompanyName] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Sort state
  const [sortValue, setSortValue] = useState('created_at:desc');
  
  // Advanced filters visibility
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  // Parse sort value
  const [sortField, sortDirection] = sortValue.split(':');
  
  // Debounce search fields
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedClientName(clientName);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [clientName]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCompanyName(companyName);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [companyName]);
  
  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, perPage, dateFrom, dateTo, sortValue]);

  // Check if any filter is active
  const hasActiveFilters = searchQuery || statusFilter !== 'all' || clientName || companyName || dateFrom || dateTo || sortValue !== 'created_at:desc';

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setClientName('');
    setDebouncedClientName('');
    setCompanyName('');
    setDebouncedCompanyName('');
    setDateFrom('');
    setDateTo('');
    setSortValue('created_at:desc');
    setCurrentPage(1);
  }, []);
  
  // Fetch proposals via Edge Function
  const { data, isLoading, error: queryError, refetch } = useProposalList(currentPage, {
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: debouncedSearch || undefined,
    clientName: debouncedClientName || undefined,
    companyName: debouncedCompanyName || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sortField,
    sortDirection,
    limit: perPage,
  });
  
  // Show error toast if query failed
  useEffect(() => {
    if (queryError) {
      console.error('[SupabaseProposalsList] Query error:', queryError);
      toast({
        title: 'Erro ao carregar propostas',
        description: queryError.message || 'Falha na comunicação com o servidor',
        variant: 'destructive',
      });
    }
  }, [queryError, toast]);
  
  // Handle API-level errors
  useEffect(() => {
    if (data && !data.success && data.error) {
      console.error('[SupabaseProposalsList] API error:', data.error);
      toast({
        title: 'Erro na API',
        description: data.error,
        variant: 'destructive',
      });
    }
  }, [data, toast]);
  
  const proposals = data?.proposals || [];
  const totalPages = data?.total ? Math.ceil(data.total / perPage) : 1;
  const pagination = {
    currentPage: data?.page || 1,
    lastPage: totalPages,
    total: data?.total || 0,
  };
  
  // Check if CORE token exists
  const hasCoreToken = !!(
    localStorage.getItem('open_access_token') ||
    localStorage.getItem('open_api_token') ||
    localStorage.getItem('open_token') || 
    localStorage.getItem('auth_token') || 
    localStorage.getItem('token')
  );
  
  const deleteProposalMutation = useDeleteProposal();
  const { getApprovalLink, isLoading: isLoadingApprovalLink } = useApprovalLink();
  
  // State for actions
  const [deleteProposalId, setDeleteProposalId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const [copyingLinkId, setCopyingLinkId] = useState<string | null>(null);
  
  // State for Safari fallback modal
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkModalUrl, setLinkModalUrl] = useState('');
  const [accessModalProposalId, setAccessModalProposalId] = useState<string | null>(null);
  
  const handleView = (proposalId: string) => {
    navigate(ROUTES.modulos.comercial.proposalView(proposalId));
  };
  
  const handleEdit = (proposal: ProposalRow) => {
    if (proposal.status === 'Aprovado') {
      toast({ title: 'Edição bloqueada', description: 'Propostas aprovadas não podem ser editadas', variant: 'destructive' });
      return;
    }
    if (proposal.status === 'Recusado') {
      toast({ title: 'Edição bloqueada', description: 'Propostas recusadas não podem ser editadas', variant: 'destructive' });
      return;
    }

    const proposalId = proposal.id;
    console.log('[EDIT NAV] supabase proposalId', proposalId);
    setEditingId(proposalId);
    const editPath = getProposalEditRoute(proposalId, false);
    navigate(editPath, { state: { supabaseId: proposalId } });
  };

  // Handle send email
  const handleSendEmail = async (proposal: ProposalRow) => {
    if (!proposal.id) {
      toast({ title: 'Erro', description: 'ID da proposta não encontrado', variant: 'destructive' });
      return;
    }
    if (!proposal.email) {
      toast({ title: 'Erro', description: 'E-mail do cliente não encontrado', variant: 'destructive' });
      return;
    }

    setSendingEmailId(proposal.id);

    try {
      const proposalLink = await getApprovalLink(proposal.id);
      
      const validityDate = new Date();
      validityDate.setDate(validityDate.getDate() + 30);
      const formattedValidity = validityDate.toLocaleDateString('pt-BR');

      const { data, error } = await supabase.functions.invoke('send-proposal-email', {
        body: {
          clientName: proposal.name,
          clientEmail: proposal.email,
          proposalId: proposal.display_id || proposal.id.substring(0, 8),
          proposalLink,
          totalValue: formatCurrency(proposal.total),
          validityDate: formattedValidity,
        },
      });

      if (error) {
        toast({ title: 'Erro ao enviar e-mail', description: error.message || 'Falha na comunicação com o servidor', variant: 'destructive' });
        return;
      }

      if (!data?.success) {
        toast({ title: 'Erro ao enviar e-mail', description: data?.error || 'Falha no envio do e-mail', variant: 'destructive' });
        return;
      }

      trackProposalEvent({ proposalId: proposal.id, source: 'email_sent', clientEmail: proposal.email });

      if (proposal.status === 'Rascunho') {
        const saveResult = await saveProposal({ proposal: { id: proposal.id, status: 'Enviado' }, servers: [], addons: [] });
        if (saveResult.success) refetch();
      }

      toast({
        title: proposal.status === 'Aprovado' ? 'E-mail reenviado' : 'E-mail enviado',
        description: `Proposta enviada para ${proposal.email}`,
      });
    } catch (err: any) {
      toast({ title: 'Erro ao enviar e-mail', description: err.message || 'Erro inesperado', variant: 'destructive' });
    } finally {
      setSendingEmailId(null);
    }
  };

  // Handle PDF download
  const handleDownloadPDF = async (proposal: ProposalRow) => {
    if (!proposal.id) {
      toast({ title: 'Erro', description: 'ID da proposta não encontrado', variant: 'destructive' });
      return;
    }

    setPdfLoadingId(proposal.id);

    try {
      const res = await getProposalFromEdge(proposal.id);

      if (!res?.success) {
        toast({ title: 'Erro', description: res?.error || 'Falha ao buscar proposta', variant: 'destructive' });
        return;
      }

      const pdfPath = res.proposal?.pdf_path;
      if (!pdfPath) {
        toast({ title: 'PDF ainda não gerado', description: 'Abra a proposta e clique em PDF na calculadora.' });
        return;
      }

      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('proposal-files')
        .createSignedUrl(pdfPath, 60 * 10);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error(signedUrlError?.message || 'Falha ao gerar link de download do PDF');
      }

      const filename = `OPEN_proposta_${res.proposal.display_id || res.proposal.id}.pdf`;
      const a = document.createElement('a');
      a.href = signedUrlData.signedUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      trackProposalEvent({ proposalId: proposal.id, source: 'pdf_download' });
      toast({ title: 'Download iniciado', description: 'O PDF salvo foi aberto para download.' });
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Falha ao baixar PDF', variant: 'destructive' });
    } finally {
      setPdfLoadingId(null);
    }
  };

  // Handle copy approval link
  const handleCopyApprovalLink = async (proposal: ProposalRow) => {
    if (!proposal.id) {
      toast({ title: 'Erro', description: 'ID da proposta não encontrado', variant: 'destructive' });
      return;
    }
    
    setCopyingLinkId(proposal.id);
    
    try {
      const approvalLink = await getApprovalLink(proposal.id);
      const copySuccess = await copyToClipboard(approvalLink);
      
      trackProposalEvent({ proposalId: proposal.id, source: 'link_copied' });
      
      if (proposal.status === 'Rascunho') {
        await saveProposal({ proposal: { id: proposal.id, status: 'Enviado' }, servers: [], addons: [] });
        refetch();
      }
      
      if (copySuccess) {
        toast({ title: 'Link copiado!', description: 'O link de aprovação foi copiado para a área de transferência' });
      } else {
        setLinkModalUrl(approvalLink);
        setLinkModalOpen(true);
        toast({ title: 'Copie o link manualmente', description: 'O Safari bloqueou a cópia automática.' });
      }
    } catch (error: any) {
      toast({ title: 'Erro ao gerar link', description: error.message || 'Não foi possível gerar o link', variant: 'destructive' });
    } finally {
      setCopyingLinkId(null);
    }
  };
  
  const handleDelete = async () => {
    if (!deleteProposalId || !isAdmin) return;
    
    setIsDeleting(true);
    try {
      await deleteProposalMutation.mutateAsync(deleteProposalId);
      setDeleteProposalId(null);
    } catch (error: any) {
      toast({ title: 'Erro ao excluir', description: error.message || 'Falha ao excluir proposta', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  // Count active filters for badge
  const activeFilterCount = [
    searchQuery,
    statusFilter !== 'all' ? statusFilter : '',
    clientName,
    companyName,
    dateFrom,
    dateTo,
  ].filter(Boolean).length;
  
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <OpenLogo />
              <div>
                <h1 className="text-2xl font-bold text-foreground">Propostas (Supabase)</h1>
                <p className="text-sm text-muted-foreground">Gerenciamento de propostas comerciais</p>
              </div>
            </div>
            
            {canCreateProposal && (
              <Button onClick={() => navigate(ROUTES.modulos.comercial.proposalNew)} className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Proposta
              </Button>
            )}
          </div>
          
          {/* Search + Sort Row */}
          <div className="flex flex-col md:flex-row gap-3 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por ID, nome, empresa, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <Select value={sortValue} onValueChange={setSortValue}>
              <SelectTrigger className="w-[220px]">
                <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Ordenar por..." />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="gap-2 relative">
                  <Filter className="h-4 w-4" />
                  Filtros
                  {activeFilterCount > 0 && (
                    <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-primary text-primary-foreground">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>

            <Select value={String(perPage)} onValueChange={(v) => setPerPage(Number(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="15">15</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Advanced Filters */}
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleContent>
              <div className="bg-muted/30 border border-border rounded-lg p-4 mb-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Client Name */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome do cliente</label>
                    <Input
                      placeholder="Filtrar por cliente..."
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                    />
                  </div>
                  
                  {/* Company Name */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome da empresa</label>
                    <Input
                      placeholder="Filtrar por empresa..."
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="Rascunho">Rascunho</SelectItem>
                        <SelectItem value="Enviado">Enviado</SelectItem>
                        <SelectItem value="Aprovado">Aprovado</SelectItem>
                        <SelectItem value="Recusado">Recusado</SelectItem>
                        <SelectItem value="Expirado">Expirado</SelectItem>
                        <SelectItem value="Cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Placeholder for alignment */}
                  <div className="hidden lg:block" />

                  {/* Date From */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Data inicial</label>
                    <div className="relative">
                      <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  
                  {/* Date To */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Data final</label>
                    <div className="relative">
                      <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                </div>

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <div className="flex justify-end pt-1">
                    <Button variant="ghost" size="sm" onClick={handleClearFilters} className="gap-2 text-muted-foreground hover:text-foreground">
                      <RotateCcw className="h-3.5 w-3.5" />
                      Limpar filtros
                    </Button>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
          
          {/* Table */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !hasCoreToken && proposals.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-6 max-w-md mx-auto">
                <p className="text-orange-600 font-medium">Token CORE não encontrado</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Faça login no sistema para visualizar as propostas.
                </p>
              </div>
            </div>
          ) : proposals.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhuma proposta encontrada</p>
              <p className="text-sm text-muted-foreground mt-1">
                {debouncedSearch ? `Nenhum resultado para "${debouncedSearch}"` : 'Crie sua primeira proposta clicando em "Nova Proposta"'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Cliente</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Empresa</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Canal</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Valor</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Data</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.map((proposal) => (
                    <tr key={proposal.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono text-sm text-primary">
                          {proposal.display_id || proposal.id.substring(0, 8)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">{proposal.name}</td>
                      <td className="py-3 px-4 text-sm">{proposal.company}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs">
                          {proposal.channel_type}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right text-sm font-medium">
                        {formatCurrency(proposal.total)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {getStatusBadge(proposal.status)}
                      </td>
                      <td className="py-3 px-4 text-center text-sm text-muted-foreground">
                        {formatDate(proposal.created_at)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleView(proposal.id)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Visualizar</TooltipContent>
                          </Tooltip>
                          
                          {/* Editar: só se NÃO for Aprovado/Recusado */}
                          {proposal.status !== 'Aprovado' && proposal.status !== 'Recusado' ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEdit(proposal)}
                                  disabled={editingId === proposal.id}
                                >
                                  {editingId === proposal.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Pencil className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Editar</TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 opacity-40 cursor-not-allowed"
                                  disabled
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {proposal.status === 'Aprovado' ? 'Propostas aprovadas não podem ser editadas' : 'Propostas recusadas não podem ser editadas'}
                              </TooltipContent>
                            </Tooltip>
                          )}
                          
                          {/* Enviar para aprovação (link) - Hidden for architects */}
                          {canCopyLink && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleCopyApprovalLink(proposal)}
                                  disabled={copyingLinkId === proposal.id}
                                >
                                  {copyingLinkId === proposal.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <LinkIcon className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Enviar para aprovação (gerar link)</TooltipContent>
                            </Tooltip>
                          )}
                          
                          {/* Enviar e-mail: sempre permitido, tooltip diferente se aprovado */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleSendEmail(proposal)}
                                disabled={sendingEmailId === proposal.id}
                              >
                                {sendingEmailId === proposal.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Mail className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {proposal.status === 'Aprovado' ? 'Reenviar proposta aprovada' : 'Enviar por e-mail'}
                            </TooltipContent>
                          </Tooltip>
                          
                          {/* Download PDF - Always visible */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleDownloadPDF(proposal)}
                                disabled={pdfLoadingId === proposal.id}
                              >
                                {pdfLoadingId === proposal.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <FileDown className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Baixar PDF</TooltipContent>
                          </Tooltip>

                          {/* Histórico de acessos */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setAccessModalProposalId(proposal.id)}
                              >
                                <BarChart3 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Histórico / Ver acessos</TooltipContent>
                          </Tooltip>
                          
                          {isAdmin && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteProposalId(proposal.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Excluir</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Pagination */}
          {pagination.lastPage > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-muted-foreground">
                Mostrando {proposals.length} de {pagination.total} propostas
              </p>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <span className="text-sm px-2">
                  {currentPage} / {pagination.lastPage}
                </span>
                
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage >= pagination.lastPage}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(pagination.lastPage)}
                  disabled={currentPage >= pagination.lastPage}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
        
        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteProposalId} onOpenChange={(open) => !open && setDeleteProposalId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir proposta?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. A proposta será permanentemente excluída.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
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

        {/* Proposal Access History Modal */}
        <ProposalAccessModal
          proposalId={accessModalProposalId}
          open={!!accessModalProposalId}
          onOpenChange={(open) => !open && setAccessModalProposalId(null)}
        />
      </div>
    </TooltipProvider>
  );
};

export default SupabaseProposalsList;
