import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HealthScoreBadge } from '@/components/health/HealthScoreBadge';
import { HealthScoreTrend } from '@/components/health/HealthScoreTrend';
import { ClientHealthScore, getHealthStatus } from '@/types/healthScore';
import { 
  getAllClientHealthScores, 
  getClientsAtRisk,
  getHealthScoreDistribution,
  getAverageHealthScore,
  updateAllHealthScores 
} from '@/services/healthScoreService';
import { 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Users,
  AlertTriangle,
  Target
} from 'lucide-react';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

export default function HealthScoreExecutivo() {
  const [clients, setClients] = useState<ClientHealthScore[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = () => {
    const allClients = getAllClientHealthScores();
    setClients(allClients);
  };

  const handleRefresh = () => {
    setLoading(true);
    const updated = updateAllHealthScores();
    setClients(updated);
    toast.success('Health Scores atualizados');
    setLoading(false);
  };

  const distribution = getHealthScoreDistribution();
  const averageScore = getAverageHealthScore();
  const riskClients = getClientsAtRisk();
  const totalClients = clients.length;

  const pieData = [
    { name: 'Saudável', value: distribution.saudavel, color: '#22c55e' },
    { name: 'Atenção', value: distribution.atencao, color: '#eab308' },
    { name: 'Risco', value: distribution.risco, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const topRiskClients = riskClients.slice(0, 5);

  // Calculate trend (comparing first and last history entries across all clients)
  const calculateTrend = () => {
    let improving = 0;
    let declining = 0;
    
    clients.forEach(client => {
      if (client.historico_scores.length >= 2) {
        const first = client.historico_scores[0].score;
        const last = client.historico_scores[client.historico_scores.length - 1].score;
        if (last > first) improving++;
        else if (last < first) declining++;
      }
    });
    
    return { improving, declining, stable: clients.length - improving - declining };
  };

  const trend = calculateTrend();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Health Score - Visão Executiva</h1>
          <p className="text-muted-foreground">Panorama geral da saúde da base de clientes</p>
        </div>
        <Button onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Score Médio</p>
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-bold">{averageScore}</p>
                  <HealthScoreBadge 
                    score={averageScore} 
                    status={getHealthStatus(averageScore)} 
                    size="sm"
                    showLabel={false}
                  />
                </div>
              </div>
              <Target className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Clientes</p>
                <p className="text-3xl font-bold">{totalClients}</p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Em Risco</p>
                <p className="text-3xl font-bold text-red-600">{distribution.risco}</p>
                <p className="text-xs text-muted-foreground">
                  {totalClients > 0 ? Math.round((distribution.risco / totalClients) * 100) : 0}% da base
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tendência</p>
                <div className="flex items-center gap-2">
                  <span className="text-green-600 text-sm">↑{trend.improving}</span>
                  <span className="text-red-600 text-sm">↓{trend.declining}</span>
                </div>
              </div>
              {trend.improving >= trend.declining ? (
                <TrendingUp className="h-8 w-8 text-green-500" />
              ) : (
                <TrendingDown className="h-8 w-8 text-red-500" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Sem dados disponíveis
              </div>
            ) : (
              <div className="h-[250px]">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="flex justify-center gap-4 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm">Saudável ({distribution.saudavel})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-sm">Atenção ({distribution.atencao})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm">Risco ({distribution.risco})</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Risk Clients */}
        <Card>
          <CardHeader>
            <CardTitle>Top Clientes em Risco</CardTitle>
          </CardHeader>
          <CardContent>
            {topRiskClients.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Nenhum cliente em risco
              </div>
            ) : (
              <div className="space-y-4">
                {topRiskClients.map((client, index) => (
                  <div key={client.cliente_id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-red-600">#{index + 1}</span>
                      <div>
                        <p className="font-medium">{client.cliente_nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {client.tickets_periodo} tickets • {client.servicos_impactados.length} serviços
                        </p>
                      </div>
                    </div>
                    <HealthScoreBadge 
                      score={client.health_score_atual} 
                      status={client.status_atual}
                      showLabel={false}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Score Distribution Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Scores por Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Sem dados disponíveis
            </div>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer>
                <BarChart data={clients.slice(0, 15)} layout="vertical">
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis type="category" dataKey="cliente_nome" width={150} />
                  <Tooltip />
                  <Bar 
                    dataKey="health_score_atual" 
                    fill="#3b82f6"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
