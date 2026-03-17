import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Search, Eye, Trash2, Loader2,
  FileSignature, CalendarIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';

import { useContracts, useDeleteContract, useConvertedProposalIds } from '@/hooks/useContracts';
import { useProposalList } from '@/hooks/useProposalApi';
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_COLORS,
  type ContractFilters,
  type ContractStatus,
} from '@/types/contract';
import { formatCurrency } from '@/lib/calculatorConfig';
import { ROUTES } from '@/config/routes';

export default function ContratosListPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('eligible');
  const [contractFilters, setContractFilters] = useState<ContractFilters>({});
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Debounce search input (400ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Apply debounced search to filters
  useEffect(() => {
    setContractFilters(prev => ({ ...prev, search: debouncedSearch || undefined }));
  }, [debouncedSearch]);

  // Fetch approved proposals for "eligible" tab
  const { data: proposalsData, isLoading: isLoadingProposals } = useProposalList(1, {
    status: 'Aprovado',
    limit: 200,
  });

  const approvedProposals = proposalsData?.proposals || [];
  const approvedIds = useMemo(() => approvedProposals.map((p: any) => p.id), [approvedProposals]);
  const { data: convertedIds } = useConvertedProposalIds(approvedIds);

  const eligibleProposals = useMemo(
    () => approvedProposals.filter((p: any) => !convertedIds?.has(p.id)),
    [approvedProposals, convertedIds]
  );

  // Fetch contracts for "contracts" tab
  const { data: contracts, isLoading: isLoadingContracts } = useContracts(contractFilters);
  const deleteContract = useDeleteContract();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setContractFilters(prev => ({ ...prev, search: searchInput }));
  };

  const handleStatusFilter = (value: string) => {
    setContractFilters(prev => ({
      ...prev,
      status: value === '__all__' ? undefined : (value as ContractStatus),
    }));
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Contratos
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie contratos vinculados a propostas aprovadas
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="eligible" className="gap-2">
              <FileSignature className="h-4 w-4" />
              Elegíveis para contrato
              {eligibleProposals.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {eligibleProposals.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="contracts" className="gap-2">
              <FileText className="h-4 w-4" />
              Contratos gerados
              {contracts && contracts.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                  {contracts.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ===== TAB 1: Eligible proposals ===== */}
          <TabsContent value="eligible" className="mt-4">
            {isLoadingProposals ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : eligibleProposals.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileSignature className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Nenhuma proposta elegível</p>
                <p className="text-sm mt-1">Todas as propostas aprovadas já foram convertidas em contrato.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">ID</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Cliente</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Empresa</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Email</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">DC</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Prazo</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Aprovado em</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eligibleProposals.map((p: any) => (
                      <tr key={p.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4 font-mono text-sm text-primary">
                          {p.display_id || p.id.substring(0, 8)}
                        </td>
                        <td className="py-3 px-4 text-sm">{p.name}</td>
                        <td className="py-3 px-4 text-sm">{p.company}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{p.email}</td>
                        <td className="py-3 px-4 text-right text-sm font-medium">
                          {formatCurrency(p.total)}
                        </td>
                        <td className="py-3 px-4 text-center text-sm">{p.datacenter}</td>
                        <td className="py-3 px-4 text-center text-sm">{p.contract_duration}m</td>
                        <td className="py-3 px-4 text-center text-sm text-muted-foreground">
                          {p.approved_at
                            ? format(new Date(p.approved_at), 'dd/MM/yy', { locale: ptBR })
                            : format(new Date(p.updated_at), 'dd/MM/yy', { locale: ptBR })}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                onClick={() => navigate(`${ROUTES.modulos.comercial.contractNew}?proposalId=${p.id}`)}
                              >
                                <FileSignature className="h-4 w-4 mr-1" />
                                Gerar contrato
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Gerar contrato a partir desta proposta</TooltipContent>
                          </Tooltip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ===== TAB 2: Contracts ===== */}
          <TabsContent value="contracts" className="mt-4 space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[250px]">
                <Input
                  placeholder="Buscar por cliente, empresa, email..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="max-w-sm"
                />
                <Button type="submit" variant="secondary" size="icon">
                  <Search className="h-4 w-4" />
                </Button>
              </form>
              <Select value={contractFilters.status || '__all__'} onValueChange={handleStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os status</SelectItem>
                  {Object.entries(CONTRACT_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoadingContracts ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !contracts || contracts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Nenhum contrato encontrado</p>
                <p className="text-sm mt-1">Gere contratos a partir de propostas aprovadas na aba "Elegíveis".</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Nº</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Proposta</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Cliente</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Empresa</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Valor</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">DC</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Prazo</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Criado em</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contracts.map((c) => (
                      <tr key={c.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-4 font-mono text-sm text-primary">
                          {c.contract_number || c.id.substring(0, 8)}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                          {c.proposal_uuid || c.proposal_id.substring(0, 8)}
                        </td>
                        <td className="py-3 px-4 text-sm">{c.client_name}</td>
                        <td className="py-3 px-4 text-sm">{c.company}</td>
                        <td className="py-3 px-4 text-right text-sm font-medium">
                          {formatCurrency(c.total)}
                        </td>
                        <td className="py-3 px-4 text-center text-sm">{c.datacenter || '—'}</td>
                        <td className="py-3 px-4 text-center text-sm">
                          {c.contract_duration ? `${c.contract_duration}m` : '—'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge className={CONTRACT_STATUS_COLORS[c.status as ContractStatus] || ''}>
                            {CONTRACT_STATUS_LABELS[c.status as ContractStatus] || c.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center text-sm text-muted-foreground">
                          {format(new Date(c.created_at), 'dd/MM/yy', { locale: ptBR })}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost" size="icon" className="h-8 w-8"
                                  onClick={() => navigate(ROUTES.modulos.comercial.contractView(c.id))}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ver detalhes</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost" size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteId(c.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Excluir</TooltipContent>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteId) {
                    deleteContract.mutate(deleteId);
                    setDeleteId(null);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
