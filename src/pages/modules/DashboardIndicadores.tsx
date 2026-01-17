import React from 'react';
import { TrendingUp, DollarSign, Users, FileStack, HeadphonesIcon, Target, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { ModuleHeader, SectionTitle } from '@/components/navigation/ModuleCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Indicator {
  title: string;
  value: string;
  change: number;
  changeLabel: string;
  icon: React.ElementType;
  category: string;
}

const indicators: Indicator[] = [
  { title: 'MRR Total', value: 'R$ 245.800', change: 8.5, changeLabel: 'vs mês anterior', icon: DollarSign, category: 'Financeiro' },
  { title: 'Novos Clientes', value: '12', change: 20, changeLabel: 'vs mês anterior', icon: Users, category: 'Comercial' },
  { title: 'Taxa de Conversão', value: '68%', change: 5, changeLabel: 'vs mês anterior', icon: Target, category: 'Comercial' },
  { title: 'Churn Rate', value: '2.1%', change: -0.5, changeLabel: 'vs mês anterior', icon: Activity, category: 'Sucesso' },
  { title: 'Propostas Abertas', value: '24', change: 12, changeLabel: 'vs semana anterior', icon: FileStack, category: 'Comercial' },
  { title: 'Ticket Médio', value: 'R$ 8.450', change: 15, changeLabel: 'vs mês anterior', icon: DollarSign, category: 'Comercial' },
  { title: 'SLA Compliance', value: '94%', change: 2, changeLabel: 'vs mês anterior', icon: HeadphonesIcon, category: 'Suporte' },
  { title: 'NPS Score', value: '72', change: 8, changeLabel: 'vs trimestre anterior', icon: TrendingUp, category: 'Sucesso' },
];

export default function DashboardIndicadores() {
  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Indicadores-chave"
        description="Métricas de desempenho do negócio"
        icon={TrendingUp}
      />

      {/* Main Indicators Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {indicators.map((indicator, index) => {
          const Icon = indicator.icon;
          const isPositive = indicator.change > 0;
          const isNegativeGood = indicator.title === 'Churn Rate'; // For churn, negative is good
          const showAsPositive = isNegativeGood ? !isPositive : isPositive;
          
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {indicator.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{indicator.value}</div>
                <div className={cn(
                  "flex items-center text-xs mt-1",
                  showAsPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                )}>
                  {showAsPositive ? (
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 mr-1" />
                  )}
                  {Math.abs(indicator.change)}% {indicator.changeLabel}
                </div>
                <div className="mt-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {indicator.category}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Trend Charts Placeholder */}
      <div>
        <SectionTitle title="Tendências" description="Evolução dos indicadores ao longo do tempo" />
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="p-6">
            <h3 className="font-medium mb-4">MRR Mensal</h3>
            <div className="h-48 flex items-center justify-center bg-muted/30 rounded-lg">
              <span className="text-muted-foreground text-sm">Gráfico de evolução MRR</span>
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="font-medium mb-4">Propostas por Mês</h3>
            <div className="h-48 flex items-center justify-center bg-muted/30 rounded-lg">
              <span className="text-muted-foreground text-sm">Gráfico de propostas</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
