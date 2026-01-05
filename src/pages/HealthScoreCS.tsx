import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HealthScoreCard } from '@/components/health/HealthScoreCard';
import { HealthScoreBadge } from '@/components/health/HealthScoreBadge';
import { ClientHealthScore } from '@/types/healthScore';
import { 
  getAllClientHealthScores, 
  getClientsAtRisk, 
  getClientsNeedingAttention,
  getHealthyClients,
  updateAllHealthScores 
} from '@/services/healthScoreService';
import { Search, RefreshCw, AlertTriangle, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export default function HealthScoreCS() {
  const [clients, setClients] = useState<ClientHealthScore[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientHealthScore | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = () => {
    const allClients = getAllClientHealthScores();
    setClients(allClients.sort((a, b) => a.health_score_atual - b.health_score_atual));
  };

  const handleRefresh = () => {
    setLoading(true);
    const updated = updateAllHealthScores();
    setClients(updated.sort((a, b) => a.health_score_atual - b.health_score_atual));
    toast.success('Health Scores atualizados');
    setLoading(false);
  };

  const riskClients = getClientsAtRisk();
  const attentionClients = getClientsNeedingAttention();
  const healthyClients = getHealthyClients();

  const filteredClients = clients.filter(c =>
    c.cliente_nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Health Score - Visão CS</h1>
          <p className="text-muted-foreground">Monitore a saúde dos clientes e priorize ações</p>
        </div>
        <Button onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar Scores
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Em Risco</p>
                <p className="text-3xl font-bold text-red-600">{riskClients.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Atenção</p>
                <p className="text-3xl font-bold text-yellow-600">{attentionClients.length}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Saudáveis</p>
                <p className="text-3xl font-bold text-green-600">{healthyClients.length}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Expansão</p>
                <p className="text-3xl font-bold">{healthyClients.filter(c => c.health_score_atual >= 90).length}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs by Status */}
      <Tabs defaultValue="risco">
        <TabsList>
          <TabsTrigger value="risco" className="text-red-600">
            Risco ({riskClients.length})
          </TabsTrigger>
          <TabsTrigger value="atencao" className="text-yellow-600">
            Atenção ({attentionClients.length})
          </TabsTrigger>
          <TabsTrigger value="saudavel" className="text-green-600">
            Saudáveis ({healthyClients.length})
          </TabsTrigger>
          <TabsTrigger value="todos">
            Todos ({clients.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="risco" className="mt-4">
          {riskClients.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhum cliente em risco
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {riskClients.map(client => (
                <HealthScoreCard 
                  key={client.cliente_id} 
                  client={client} 
                  onClick={() => setSelectedClient(client)}
                  expanded={selectedClient?.cliente_id === client.cliente_id}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="atencao" className="mt-4">
          {attentionClients.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhum cliente em atenção
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {attentionClients.map(client => (
                <HealthScoreCard 
                  key={client.cliente_id} 
                  client={client}
                  onClick={() => setSelectedClient(client)}
                  expanded={selectedClient?.cliente_id === client.cliente_id}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="saudavel" className="mt-4">
          {healthyClients.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhum cliente saudável
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {healthyClients.map(client => (
                <HealthScoreCard 
                  key={client.cliente_id} 
                  client={client}
                  onClick={() => setSelectedClient(client)}
                  expanded={selectedClient?.cliente_id === client.cliente_id}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="todos" className="mt-4">
          {filteredClients.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhum cliente encontrado
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClients.map(client => (
                <HealthScoreCard 
                  key={client.cliente_id} 
                  client={client}
                  onClick={() => setSelectedClient(client)}
                  expanded={selectedClient?.cliente_id === client.cliente_id}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
