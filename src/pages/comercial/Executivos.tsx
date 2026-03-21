import React, { useState, useEffect } from 'react';
import { openApi, ApiUser } from '@/lib/openApi';
import { useSession } from '@/hooks/useSession';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  Search,
  RefreshCw,
  UserCheck,
  Mail,
  Loader2,
  ShieldAlert,
  TrendingUp,
  Target,
} from 'lucide-react';

export default function Executivos() {
  const { toast } = useToast();
  const [executivos, setExecutivos] = useState<ApiUser[]>([]);
  const [filteredExecutivos, setFilteredExecutivos] = useState<ApiUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auth check — Supabase-first via useSession
  const { isAdmin, level } = useSession();

  // Load executivos from API
  const loadExecutivos = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await openApi.getUsers({ 
        level: 700, // Comercial / Executivos
        __perPage: 100 
      });
      setExecutivos(response.data);
      applyFilters(response.data, searchTerm);
    } catch (err: any) {
      console.error('[Executivos] Erro ao carregar executivos:', err);
      setError(err?.response?.data?.message || 'Erro ao carregar executivos. Tente novamente.');
      toast({
        title: 'Erro ao carregar executivos',
        description: err?.response?.data?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadExecutivos();
    }
  }, [isAdmin]);

  // Apply filters
  const applyFilters = (data: ApiUser[], search: string) => {
    let filtered = [...data];

    if (search) {
      const term = search.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.name.toLowerCase().includes(term) ||
          e.email.toLowerCase().includes(term)
      );
    }

    setFilteredExecutivos(filtered);
  };

  useEffect(() => {
    applyFilters(executivos, searchTerm);
  }, [searchTerm, executivos]);

  // Access control
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="bg-card border-border max-w-md w-full">
          <CardContent className="p-8 text-center">
            <ShieldAlert className="h-16 w-16 mx-auto mb-4 text-destructive opacity-70" />
            <h2 className="text-xl font-bold text-foreground mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">
              Esta página é restrita a administradores.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Stats
  const stats = {
    total: executivos.length,
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <UserCheck className="h-6 w-6 text-primary" />
              Executivos
            </h1>
            <p className="text-muted-foreground">
              Visão geral da equipe comercial
            </p>
          </div>
          <Button variant="outline" onClick={loadExecutivos} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Atualizar
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Executivos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-500">—</p>
                  <p className="text-xs text-muted-foreground">Propostas Abertas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Target className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-500">—</p>
                  <p className="text-xs text-muted-foreground">Meta Mensal</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <UserCheck className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-500">—</p>
                  <p className="text-xs text-muted-foreground">Taxa Conversão</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-input border-border"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Executivos Table */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Lista de Executivos ({filteredExecutivos.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <ShieldAlert className="h-12 w-12 mx-auto mb-4 text-destructive opacity-50" />
                <p className="text-muted-foreground mb-4">{error}</p>
                <Button variant="outline" onClick={loadExecutivos}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar novamente
                </Button>
              </div>
            ) : filteredExecutivos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum executivo encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Nível</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExecutivos.map((executivo) => (
                      <TableRow key={executivo.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                              <UserCheck className="h-4 w-4 text-primary" />
                            </div>
                            <span className="font-medium">{executivo.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-4 w-4" />
                            <span>{executivo.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">
                            Comercial
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
