import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Search, Plus, Eye, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { useContracts, useDeleteContract } from '@/hooks/useContracts';
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_COLORS,
  CONTRACT_DURATIONS,
  type ContractFilters,
  type ContractStatus,
  type ContractDuration,
} from '@/types/contract';

export default function ContratosListPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<ContractFilters>({});
  const [searchInput, setSearchInput] = useState('');

  const { data: contracts, isLoading } = useContracts(filters);
  const deleteContract = useDeleteContract();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters(prev => ({ ...prev, search: searchInput }));
  };

  const handleStatusFilter = (value: string) => {
    setFilters(prev => ({
      ...prev,
      status: value === '__all__' ? undefined : (value as ContractStatus),
    }));
  };

  const handleDurationFilter = (value: string) => {
    setFilters(prev => ({
      ...prev,
      duration: value === '__all__' ? undefined : (Number(value) as ContractDuration),
    }));
  };

  const handleDelete = async (id: string) => {
    await deleteContract.mutateAsync(id);
  };

  return (
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
        <Button onClick={() => navigate('/modulos/comercial/contratos/novo')}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Contrato
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[250px]">
              <Input
                placeholder="Buscar por empresa, responsável..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="max-w-sm"
              />
              <Button type="submit" variant="secondary" size="icon">
                <Search className="h-4 w-4" />
              </Button>
            </form>

            <Select
              value={filters.status || '__all__'}
              onValueChange={handleStatusFilter}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os status</SelectItem>
                {Object.entries(CONTRACT_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.duration?.toString() || '__all__'}
              onValueChange={handleDurationFilter}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Prazo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os prazos</SelectItem>
                {CONTRACT_DURATIONS.map((duration) => (
                  <SelectItem key={duration} value={duration.toString()}>
                    {duration} meses
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Proposta</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Dia Pgto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Atualizado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : contracts?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <FileText className="h-8 w-8" />
                      <p>Nenhum contrato encontrado</p>
                      <Button
                        variant="link"
                        onClick={() => navigate('/modulos/comercial/contratos/novo')}
                      >
                        Criar primeiro contrato
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                contracts?.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-mono text-xs">
                      {contract.id.slice(0, 12)}...
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/modulos/comercial/propostas/${contract.proposal_id}`}
                        className="text-primary hover:underline"
                      >
                        {contract.proposal_label || `#${contract.proposal_id}`}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">
                      {contract.company_name}
                    </TableCell>
                    <TableCell>{contract.responsible_name}</TableCell>
                    <TableCell>{contract.contract_duration} meses</TableCell>
                    <TableCell>Dia {contract.billing_day}</TableCell>
                    <TableCell>
                      <Badge className={CONTRACT_STATUS_COLORS[contract.status]}>
                        {CONTRACT_STATUS_LABELS[contract.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(contract.updated_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/modulos/comercial/contratos/${contract.id}`)}
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/modulos/comercial/contratos/${contract.id}?edit=1`)}
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. O contrato será removido permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(contract.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
