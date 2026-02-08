/**
 * Supabase Proposals List Component
 * 
 * This component displays proposals using Edge Functions with Service Role.
 * The CORE auth token is passed to the Edge Functions for authorization.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Eye, Pencil, Trash2, Search, X,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  FileDown, Loader2, Mail, Link as LinkIcon,
} from 'lucide-react';
import OpenLogo from '@/components/OpenLogo';
import { supabase } from '@/integrations/supabase/client';
import { createSignedPdfUrl } from '@/services/supabaseStorageService';
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

const SupabaseProposalsList: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Auth check
  const session = authService.getSession();
  const userLevel = session?.level || 0;
  const isAdmin = userLevel === 1000;
  const isArchitect = userLevel === 690;
  const canCreateProposal = userLevel === 700 || userLevel === 750 || userLevel === 1000;
  const canCopyLink = !isArchitect; // All internal users except architects
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, perPage]);
  
  // Fetch proposals via Edge Function (uses Service Role, no RLS issues)
  const { data, isLoading, error: queryError, refetch } = useProposalList(currentPage, {
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: debouncedSearch || undefined,
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
  
  // Handle API-level errors (when success=false)
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

    // REQUIRED DEBUG: ensure we always pass the Supabase UUID
    const proposalId = proposal.id;
    console.log('[EDIT NAV] supabase proposalId', proposalId);

    setEditingId(proposalId);

    // Navigate to edit - calculator will fetch via Edge Function
    const editPath = getProposalEditRoute(proposalId, false);
    navigate(editPath, { state: { supabaseId: proposalId } });
  };

  // Handle send email
  const handleSendEmail = async (proposal: ProposalRow) => {
    // Validate required fields
    if (!proposal.id) {
      toast({ title: 'Erro', description: 'ID da proposta não encontrado', variant: 'destructive' });
      return;
    }
    if (!proposal.email) {
      toast({ title: 'Erro', description: 'E-mail do cliente não encontrado', variant: 'destructive' });
      return;
    }

    setSendingEmailId(proposal.id);
    console.log('[EMAIL SEND] Starting for proposal:', proposal.id);

    try {
      // Build proposal link using display_id or UUID
      const proposalIdForLink = proposal.display_id || proposal.id.substring(0, 8);
      // Use a simple token for now (can be enhanced with approval link service later)
      const proposalLink = `https://core.opendata.center/proposta/aprovar?proposalId=${encodeURIComponent(proposal.id)}&token=${encodeURIComponent(proposal.id)}`;
      
      // Format validity date (30 days from now if not available)
      const validityDate = new Date();
      validityDate.setDate(validityDate.getDate() + 30);
      const formattedValidity = validityDate.toLocaleDateString('pt-BR');

      // Call Edge Function
      const { data, error } = await supabase.functions.invoke('send-proposal-email', {
        body: {
          clientName: proposal.name,
          clientEmail: proposal.email,
          proposalId: proposalIdForLink,
          proposalLink,
          totalValue: formatCurrency(proposal.total),
          validityDate: formattedValidity,
        },
      });

      if (error) {
        console.error('[EMAIL SEND] Edge Function error:', error);
        toast({
          title: 'Erro ao enviar e-mail',
          description: error.message || 'Falha na comunicação com o servidor',
          variant: 'destructive',
        });
        return;
      }

      if (!data?.success) {
        console.error('[EMAIL SEND] API error:', data?.error);
        toast({
          title: 'Erro ao enviar e-mail',
          description: data?.error || 'Falha no envio do e-mail',
          variant: 'destructive',
        });
        return;
      }

      console.log('[EMAIL SEND] Success:', data);

      // Track email sent event
      trackProposalEvent({
        proposalId: proposal.id,
        source: 'email_sent',
        clientEmail: proposal.email,
      });

      // If status is Rascunho, update to Enviado
      if (proposal.status === 'Rascunho') {
        console.log('[EMAIL SEND] Updating status from Rascunho to Enviado');
        const saveResult = await saveProposal({
          proposal: {
            id: proposal.id,
            status: 'Enviado',
          },
          servers: [],
          addons: [],
        });

        if (saveResult.success) {
          console.log('[EMAIL SEND] Status updated successfully');
          refetch(); // Refresh the list
        } else {
          console.warn('[EMAIL SEND] Failed to update status:', saveResult.error);
        }
      }

      toast({
        title: proposal.status === 'Aprovado' ? 'E-mail reenviado' : 'E-mail enviado',
        description: `Proposta enviada para ${proposal.email}`,
      });
    } catch (err: any) {
      console.error('[EMAIL SEND] Exception:', err);
      toast({
        title: 'Erro ao enviar e-mail',
        description: err.message || 'Erro inesperado',
        variant: 'destructive',
      });
    } finally {
      setSendingEmailId(null);
    }
  };

  // Handle PDF download (Supabase: download ONLY from Storage using pdf_path)
  // NO local generation — only uses persisted PDF
  const handleDownloadPDF = async (proposal: ProposalRow) => {
    if (!proposal.id) {
      toast({ title: 'Erro', description: 'ID da proposta não encontrado', variant: 'destructive' });
      return;
    }

    setPdfLoadingId(proposal.id);
    console.log('[PDF DOWNLOAD] Starting for proposal (Storage only):', proposal.id);

    try {
      // Prefer pdf_path from list (when available)
      let pdfPath = proposal.pdf_path || null;
      let displayId = proposal.display_id || proposal.id.substring(0, 8);

      // If list row doesn't include it (or is null), fetch full proposal
      if (!pdfPath) {
        const res = await getProposalFromEdge(proposal.id);

        if (!res?.success) {
          toast({
            title: 'Erro',
            description: res?.error || 'Falha ao buscar proposta',
            variant: 'destructive',
          });
          return;
        }

        pdfPath = res.proposal?.pdf_path || null;
        displayId = res.proposal?.display_id || displayId;
      }

      if (!pdfPath) {
        console.warn('[PDF DOWNLOAD] pdf_path is null/empty. Redirecting to calculator.');
        toast({
          title: 'PDF ainda não gerado',
          description: 'Abrindo a calculadora — salve a proposta para gerar o PDF.',
        });
        navigate(getProposalEditRoute(proposal.id, false));
        return;
      }

      console.log('[PDF DOWNLOAD] Fetching signed URL for path:', pdfPath);

      const signedUrl = await createSignedPdfUrl(pdfPath, 60 * 60 * 24); // 24h

      // Trigger download
      const filename = `OPEN_proposta_${displayId}.pdf`;
      const a = document.createElement('a');
      a.href = signedUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      trackProposalEvent({
        proposalId: proposal.id,
        source: 'pdf_download',
      });

      toast({ title: 'Download iniciado', description: 'O PDF salvo foi aberto para download.' });
    } catch (error: any) {
      console.error('[PDF DOWNLOAD] Exception:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Falha ao baixar PDF',
        variant: 'destructive',
      });
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
    console.log('[COPY LINK] Getting approval link for:', proposal.id);
    
    try {
      const approvalLink = await getApprovalLink(proposal.id);
      const copySuccess = await copyToClipboard(approvalLink);
      
      // Track link copied event
      trackProposalEvent({
        proposalId: proposal.id,
        source: 'link_copied',
      });
      
      // Update status to Enviado if still Rascunho
      if (proposal.status === 'Rascunho') {
        console.log('[COPY LINK] Updating status from Rascunho to Enviado');
        await saveProposal({
          proposal: { id: proposal.id, status: 'Enviado' },
          servers: [],
          addons: [],
        });
        refetch();
      }
      
      if (copySuccess) {
        toast({ title: 'Link copiado!', description: 'O link de aprovação foi copiado para a área de transferência' });
      } else {
        // Safari fallback - show modal
        setLinkModalUrl(approvalLink);
        setLinkModalOpen(true);
        toast({ title: 'Copie o link manualmente', description: 'O Safari bloqueou a cópia automática.' });
      }
    } catch (error: any) {
      console.error('[COPY LINK] Exception:', error);
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
      toast({
        title: 'Erro ao excluir',
        description: error.message || 'Falha ao excluir proposta',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };
  
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
          
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, empresa, email..."
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
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
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
      </div>
    </TooltipProvider>
  );
};

export default SupabaseProposalsList;
