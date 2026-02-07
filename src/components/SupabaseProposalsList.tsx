/**
 * Supabase Proposals List Component
 * 
 * This component displays proposals from Supabase (the source of truth).
 * It replaces the API-based proposal list for the new proposal system.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Eye, Pencil, Trash2, Search, X,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  FileDown, Loader2,
} from 'lucide-react';
import OpenLogo from '@/components/OpenLogo';
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
import {
  useSupabaseProposals,
  useDeleteSupabaseProposal,
  useSupabaseProposal,
} from '@/hooks/useSupabaseProposals';
import { supabaseToCalculatorState } from '@/services/proposalFormatConverters';
import { getProposal as getProposalFromSupabase } from '@/services/supabaseProposalService';
import type { CalculatorProposalRow } from '@/types/calculatorProposal';

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
  const canCreateProposal = userLevel === 700 || userLevel === 750 || userLevel === 1000;
  
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
  
  // Fetch proposals
  const { data, isLoading, refetch } = useSupabaseProposals(currentPage, {
    status: statusFilter !== 'all' ? statusFilter : undefined,
    search: debouncedSearch || undefined,
    limit: perPage,
  });
  
  const proposals = data?.proposals || [];
  const pagination = {
    currentPage: data?.page || 1,
    lastPage: data?.totalPages || 1,
    total: data?.total || 0,
  };
  
  const deleteProposalMutation = useDeleteSupabaseProposal();
  
  // State for actions
  const [deleteProposalId, setDeleteProposalId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const handleView = (proposalId: string) => {
    navigate(ROUTES.modulos.comercial.proposalView(proposalId));
  };
  
  const handleEdit = async (proposal: CalculatorProposalRow) => {
    if (proposal.status === 'Aprovado') {
      toast({ title: 'Edição bloqueada', description: 'Propostas aprovadas não podem ser editadas', variant: 'destructive' });
      return;
    }
    if (proposal.status === 'Recusado') {
      toast({ title: 'Edição bloqueada', description: 'Propostas recusadas não podem ser editadas', variant: 'destructive' });
      return;
    }
    
    setEditingId(proposal.id);
    
    try {
      // Fetch complete proposal from Supabase
      const fullProposal = await getProposalFromSupabase(proposal.id);
      
      if (!fullProposal) {
        toast({ title: 'Erro', description: 'Proposta não encontrada', variant: 'destructive' });
        return;
      }
      
      // Convert to calculator state
      const calculatorState = supabaseToCalculatorState(fullProposal);
      
      // Navigate to calculator with state
      const editPath = getProposalEditRoute(proposal.id, false);
      navigate(editPath, { state: { editProposal: calculatorState, supabaseId: proposal.id } });
    } catch (error: any) {
      console.error('[SupabaseProposalsList] Error loading proposal:', error);
      toast({
        title: 'Erro ao carregar proposta',
        description: error.message || 'Falha ao buscar dados da proposta',
        variant: 'destructive',
      });
    } finally {
      setEditingId(null);
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
          ) : proposals.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhuma proposta encontrada</p>
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
      </div>
    </TooltipProvider>
  );
};

export default SupabaseProposalsList;
