// ============================================================================
// ANALYSTS PAGE - Gestão de Analistas de Suporte (Level 900+)
// Shows support analysts with performance indicators
// ============================================================================

import { useState, useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Users,
  AlertTriangle,
  Clock,
  TrendingUp,
  RefreshCw,
  Search,
  ArrowUpDown,
  User,
  CheckCircle2,
  Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { canAccessSupportModule, canManageSLAs } from '@/types/supportTicket';
import { useSession } from '@/hooks/useSession';
import { getAuthTokenSync } from '@/lib/authToken';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Interface for analyst data from API
interface AnalystStats {
  user_id: number;
  user_name: string;
  user_email: string;
  open_assigned: number;
  in_progress: number;
  waiting_client: number;
  resolved_count: number;
  avg_first_response_minutes: number;
  avg_resolution_minutes: number;
  sla_compliance_pct: number;
  is_online: boolean;
}

// Helper to format minutes as hours/minutes
function formatMinutes(minutes: number): string {
  if (!minutes || minutes <= 0) return '-';
  if (minutes < 60) return `${Math.round(minutes)}min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

// Fetch analysts from API
async function fetchAnalysts(period: '7d' | '30d'): Promise<AnalystStats[]> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
  
  const dateFrom = format(subDays(new Date(), period === '7d' ? 7 : 30), 'yyyy-MM-dd');
  const dateTo = format(new Date(), 'yyyy-MM-dd');
  
  const response = await axios.get(`${API_BASE_URL}/support/analysts`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    params: {
      date_from: dateFrom,
      date_to: dateTo,
    },
  });
  
  return response.data.data || response.data || [];
}

type SortField = 'user_name' | 'open_assigned' | 'avg_first_response_minutes' | 'avg_resolution_minutes' | 'sla_compliance_pct';
type SortDirection = 'asc' | 'desc';

export default function AnalistasSuportePage() {
  const session = authService.getSession();
  const userLevel = session?.level ?? 0;

  // Check access - need at least support level
  if (!canAccessSupportModule(userLevel)) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acesso Negado</h2>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar este módulo.
          </p>
        </Card>
      </div>
    );
  }

  const [searchQuery, setSearchQuery] = useState('');
  const [period, setPeriod] = useState<'7d' | '30d'>('7d');
  const [sortField, setSortField] = useState<SortField>('open_assigned');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Fetch analysts data
  const {
    data: analysts = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['support-analysts', period],
    queryFn: () => fetchAnalysts(period),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Filter and sort analysts
  const filteredAnalysts = useMemo(() => {
    let result = [...analysts];
    
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(a => 
        a.user_name.toLowerCase().includes(query) ||
        a.user_email.toLowerCase().includes(query)
      );
    }
    
    // Sort
    result.sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      return sortDirection === 'asc' 
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
    
    return result;
  }, [analysts, searchQuery, sortField, sortDirection]);

  // Calculate summary stats
  const summary = useMemo(() => {
    const online = analysts.filter(a => a.is_online).length;
    const totalOpen = analysts.reduce((sum, a) => sum + a.open_assigned, 0);
    const avgFirstResponse = analysts.length > 0
      ? analysts.reduce((sum, a) => sum + (a.avg_first_response_minutes || 0), 0) / analysts.length
      : 0;
    const avgSLA = analysts.length > 0
      ? analysts.reduce((sum, a) => sum + (a.sla_compliance_pct || 0), 0) / analysts.length
      : 0;
    return { online, totalOpen, avgFirstResponse, avgSLA };
  }, [analysts]);

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-primary' : 'text-muted-foreground'}`} />
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Analistas de Suporte</h1>
            <p className="text-muted-foreground">Indicadores da equipe</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as '7d' | '30d')}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <User className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.online}</p>
                <p className="text-xs text-muted-foreground">Online Agora</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/20">
                <Clock className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.totalOpen}</p>
                <p className="text-xs text-muted-foreground">Chamados na Fila</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Timer className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatMinutes(summary.avgFirstResponse)}</p>
                <p className="text-xs text-muted-foreground">Tempo Médio 1ª Resp.</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.avgSLA.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">SLA Médio</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="border-border/50">
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar analista por nome ou email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Analysts Table */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">
            Equipe ({filteredAnalysts.length} analista{filteredAnalysts.length !== 1 ? 's' : ''})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
              <h3 className="text-lg font-medium">Erro ao carregar dados</h3>
              <p className="text-muted-foreground mt-1">
                Não foi possível obter os indicadores. Tente novamente.
              </p>
            </div>
          ) : filteredAnalysts.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhum analista encontrado</h3>
              <p className="text-muted-foreground mt-1">
                Não há analistas que correspondem à busca.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader field="user_name">Analista</SortableHeader>
                    <TableHead className="text-center">Status</TableHead>
                    <SortableHeader field="open_assigned">Atribuídos</SortableHeader>
                    <SortableHeader field="avg_first_response_minutes">1ª Resposta</SortableHeader>
                    <SortableHeader field="avg_resolution_minutes">Resolução</SortableHeader>
                    <SortableHeader field="sla_compliance_pct">SLA</SortableHeader>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAnalysts.map((analyst) => (
                    <TableRow key={analyst.user_id} className="hover:bg-muted/50">
                      <TableCell>
                        <div>
                          <p className="font-medium">{analyst.user_name}</p>
                          <p className="text-xs text-muted-foreground">{analyst.user_email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={analyst.is_online ? 'default' : 'outline'}
                          className={analyst.is_online ? 'bg-green-500 hover:bg-green-600' : ''}
                        >
                          {analyst.is_online ? 'Online' : 'Offline'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{analyst.open_assigned}</span>
                          {analyst.in_progress > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {analyst.in_progress} em prog.
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={analyst.avg_first_response_minutes > 120 ? 'text-orange-500' : ''}>
                          {formatMinutes(analyst.avg_first_response_minutes)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {formatMinutes(analyst.avg_resolution_minutes)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span 
                            className={
                              analyst.sla_compliance_pct >= 90 
                                ? 'text-green-500 font-medium' 
                                : analyst.sla_compliance_pct >= 70 
                                  ? 'text-yellow-500' 
                                  : 'text-red-500'
                            }
                          >
                            {analyst.sla_compliance_pct?.toFixed(0) || 0}%
                          </span>
                        </div>
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
  );
}
