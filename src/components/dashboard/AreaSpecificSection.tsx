/**
 * Area Specific Section Component
 * Displays the variable section (chart/list) based on user's area
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp, 
  AlertTriangle, 
  ArrowRight,
  Activity,
  Users,
  Clock,
  Briefcase,
} from 'lucide-react';
import type { UserArea } from '@/lib/userArea';
import type { DashboardKPIsData } from '@/hooks/useDashboardKPIs';

interface AreaSpecificSectionProps {
  area: UserArea;
  data: DashboardKPIsData;
  loading: boolean;
}

export function AreaSpecificSection({ area, data, loading }: AreaSpecificSectionProps) {
  const renderContent = () => {
    switch (area) {
      case 'comercial':
        return (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Tendências Comercial
                  </CardTitle>
                  <CardDescription>
                    Performance de vendas e propostas
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/modulos/comercial/propostas">
                    Ver Propostas
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : (
                <div className="flex items-center justify-center h-24 rounded-lg bg-muted/50 border border-dashed">
                  <p className="text-muted-foreground text-sm">
                    Gráfico de propostas/MRR por mês — aguardando integração
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'customer_success':
        return (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Saúde da Base
                  </CardTitle>
                  <CardDescription>
                    Clientes que requerem atenção
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/modulos/atendimentos/cs">
                    Ver Todos
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 rounded-lg bg-muted/50 border border-dashed">
                  <p className="text-muted-foreground text-sm">
                    Top 10 clientes em risco — aguardando integração
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'suporte_tecnico':
        return (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Operação Hoje
                  </CardTitle>
                  <CardDescription>
                    Status do NOC e incidentes recentes
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/modulos/atendimentos/suporte-tecnico">
                    Ir para NOC
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-center h-24 rounded-lg bg-muted/50 border border-dashed">
                    <p className="text-muted-foreground text-sm">
                      Incidentes recentes + plantão ativo — aguardando integração
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'financeiro':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Fluxo Financeiro
              </CardTitle>
              <CardDescription>
                Faturamento e recebimentos dos últimos 6 meses
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <div className="flex items-center justify-center h-32 rounded-lg bg-muted/50 border border-dashed">
                  <p className="text-muted-foreground text-sm">
                    Gráfico de fluxo financeiro — aguardando integração
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'lideranca':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Resumo Executivo
              </CardTitle>
              <CardDescription>
                Alertas e itens que requerem atenção imediata
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : data.lideranca.topRiscos.length > 0 ? (
                <div className="space-y-3">
                  {data.lideranca.topRiscos.map((risco, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Badge variant="destructive">{risco.tipo}</Badge>
                        <span className="text-sm">{risco.descricao}</span>
                      </div>
                      <Button variant="ghost" size="sm">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-24 rounded-lg bg-muted/50 border border-dashed">
                  <p className="text-muted-foreground text-sm">
                    Nenhum alerta crítico no momento
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'rh':
        return (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-primary" />
                    Recrutamento
                  </CardTitle>
                  <CardDescription>
                    Vagas e processos seletivos ativos
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/modulos/gente/vagas">
                    Ver Vagas
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-24 rounded-lg bg-muted/50 border border-dashed">
                  <p className="text-muted-foreground text-sm">
                    Status das vagas — aguardando integração
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return <div className="mt-6">{renderContent()}</div>;
}
