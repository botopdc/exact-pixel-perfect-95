// ============================================================================
// ACADEMY KPI CARDS - Compact KPI cards for Academy dashboard
// ============================================================================

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Ban,
} from 'lucide-react';
import type { AcademyKPIs } from '@/types/academy';

interface AcademyKPICardsProps {
  kpis: AcademyKPIs | undefined;
  isLoading: boolean;
  onFilterClick?: (filter: string) => void;
}

interface KPICardProps {
  title: string;
  value: number | undefined;
  description: string;
  icon: React.ReactNode;
  color: string;
  isLoading: boolean;
  onClick?: () => void;
}

function KPICard({ title, value, description, icon, color, isLoading, onClick }: KPICardProps) {
  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${onClick ? 'hover:border-primary/50' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
          {isLoading ? (
            <Skeleton className="h-8 w-12" />
          ) : (
            <span className="text-2xl font-bold">{value ?? 0}</span>
          )}
        </div>
        <div className="mt-2">
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function AcademyKPICards({ kpis, isLoading, onFilterClick }: AcademyKPICardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <KPICard
        title="Pendentes"
        value={kpis?.pending}
        description="Aguardando aprovação"
        icon={<Clock className="h-4 w-4 text-yellow-600" />}
        color="bg-yellow-500/10"
        isLoading={isLoading}
        onClick={() => onFilterClick?.('pending')}
      />
      <KPICard
        title="Ativos"
        value={kpis?.active}
        description="Com benefício ativo"
        icon={<CheckCircle className="h-4 w-4 text-green-600" />}
        color="bg-green-500/10"
        isLoading={isLoading}
        onClick={() => onFilterClick?.('active')}
      />
      <KPICard
        title="Expiram em 30 dias"
        value={kpis?.expiring_30_days}
        description="Atenção à renovação"
        icon={<AlertTriangle className="h-4 w-4 text-orange-600" />}
        color="bg-orange-500/10"
        isLoading={isLoading}
        onClick={() => onFilterClick?.('expiring')}
      />
      <KPICard
        title="Expirados"
        value={kpis?.expired}
        description="Benefício encerrado"
        icon={<XCircle className="h-4 w-4 text-gray-500" />}
        color="bg-gray-500/10"
        isLoading={isLoading}
        onClick={() => onFilterClick?.('expired')}
      />
      <KPICard
        title="Suspensos"
        value={kpis?.suspended}
        description="Temporariamente inativos"
        icon={<Ban className="h-4 w-4 text-red-600" />}
        color="bg-red-500/10"
        isLoading={isLoading}
        onClick={() => onFilterClick?.('suspended')}
      />
    </div>
  );
}
