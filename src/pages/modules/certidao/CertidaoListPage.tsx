// ============================================================================
// CERTIDÃO DE NASCIMENTO - LIST PAGE
// Search and browse customers/assets
// ============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, Server, RefreshCw, Plus, MapPin, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import { useCertCustomers, useCertSearch } from '@/hooks/useBirthCertificate';
import { authService } from '@/services/authService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function CertidaoListPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: customers, isLoading, refetch, isRefetching } = useCertCustomers();
  const { data: searchResults, isLoading: isSearching } = useCertSearch(searchQuery);
  
  // Access control
  const session = authService.getSession();
  const userLevel = session?.user?.level || 0;
  
  if (userLevel < 900) {
    return (
      <div className="container mx-auto p-6">
        <Card className="bg-destructive/10 border-destructive">
          <CardContent className="p-6 text-center">
            <p className="text-destructive">Acesso restrito ao time de Suporte (nível 900+)</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleOpenCustomer = (customerId: string) => {
    navigate(`/modulos/atendimentos/certidoes/${customerId}`);
  };

  const handleOpenAsset = (assetId: string) => {
    navigate(`/modulos/atendimentos/certidoes/asset/${assetId}`);
  };

  const showSearchResults = searchQuery.length >= 2;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Certidão de Nascimento
          </h1>
          <p className="text-muted-foreground mt-1">
            Consulte dados de infraestrutura de clientes e ativos
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button onClick={() => navigate('/modulos/atendimentos/certidoes/novo-cliente')}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Cliente
          </Button>
        </div>
      </div>

      {/* Search Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Pesquisa Rápida</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por empresa, CNPJ, email, código do ativo ou IP..."
              className="pl-10"
              value={searchQuery}
              onChange={handleSearch}
            />
          </div>

          {/* Search Results */}
          {showSearchResults && (
            <div className="mt-4 space-y-2">
              {isSearching ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : searchResults && searchResults.length > 0 ? (
                <div className="divide-y divide-border rounded-lg border">
                  {searchResults.map((result) => (
                    <div
                      key={`${result.type}-${result.id}`}
                      className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => 
                        result.type === 'customer' 
                          ? handleOpenCustomer(result.id) 
                          : handleOpenAsset(result.id)
                      }
                    >
                      <div className="flex items-center gap-3">
                        {result.type === 'customer' ? (
                          <Building2 className="h-5 w-5 text-blue-500" />
                        ) : (
                          <Server className="h-5 w-5 text-green-500" />
                        )}
                        <div>
                          <p className="font-medium">{result.title}</p>
                          <p className="text-sm text-muted-foreground">{result.subtitle}</p>
                        </div>
                      </div>
                      <Badge variant="outline">
                        {result.type === 'customer' ? 'Cliente' : 'Ativo'}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum resultado encontrado para "{searchQuery}"
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customers Table */}
      {!showSearchResults && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Clientes Cadastrados
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead className="text-center">Ativos</TableHead>
                  <TableHead>Última Atualização</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : customers && customers.length > 0 ? (
                  customers.map((customer) => (
                    <TableRow key={customer.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {customer.nome_fantasia || customer.razao_social}
                          </p>
                          {customer.nome_fantasia && (
                            <p className="text-xs text-muted-foreground">
                              {customer.razao_social}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {customer.cnpj || '-'}
                      </TableCell>
                      <TableCell>
                        {customer.cidade || customer.uf ? (
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3" />
                            {[customer.cidade, customer.uf].filter(Boolean).join('/')}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {customer.asset_count || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(customer.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenCustomer(customer.id)}
                        >
                          Abrir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum cliente cadastrado. Clique em "Novo Cliente" para começar.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
