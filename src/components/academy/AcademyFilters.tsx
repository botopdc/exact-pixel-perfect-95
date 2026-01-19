// ============================================================================
// ACADEMY FILTERS - Filter bar for Academy enrollments
// ============================================================================

import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, RotateCcw } from 'lucide-react';
import type { AcademyEnrollmentStatus, AcademyLevel } from '@/types/academy';
import {
  ACADEMY_LEVEL_LABELS,
  ACADEMY_STATUS_LABELS,
} from '@/types/academy';

interface AcademyFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: AcademyEnrollmentStatus | 'all';
  onStatusChange: (value: AcademyEnrollmentStatus | 'all') => void;
  level: AcademyLevel | 'all';
  onLevelChange: (value: AcademyLevel | 'all') => void;
  expiringDays: number | 'all';
  onExpiringDaysChange: (value: number | 'all') => void;
  institution: string;
  onInstitutionChange: (value: string) => void;
  institutions: string[];
  onReset: () => void;
  onRefreshExpired?: () => void;
  isRefreshing?: boolean;
}

export function AcademyFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  level,
  onLevelChange,
  expiringDays,
  onExpiringDaysChange,
  institution,
  onInstitutionChange,
  institutions,
  onReset,
  onRefreshExpired,
  isRefreshing,
}: AcademyFiltersProps) {
  const hasActiveFilters =
    search ||
    status !== 'all' ||
    level !== 'all' ||
    expiringDays !== 'all' ||
    institution;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
          {search && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => onSearchChange('')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Status filter */}
        <Select
          value={status}
          onValueChange={(v) => onStatusChange(v as AcademyEnrollmentStatus | 'all')}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {(Object.entries(ACADEMY_STATUS_LABELS) as [AcademyEnrollmentStatus, string][]).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>

        {/* Level filter */}
        <Select
          value={level === 'all' ? 'all' : String(level)}
          onValueChange={(v) => onLevelChange(v === 'all' ? 'all' : (Number(v) as AcademyLevel))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {(Object.entries(ACADEMY_LEVEL_LABELS) as [string, string][]).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Expiring filter */}
        <Select
          value={expiringDays === 'all' ? 'all' : String(expiringDays)}
          onValueChange={(v) => onExpiringDaysChange(v === 'all' ? 'all' : Number(v))}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Validade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Qualquer validade</SelectItem>
            <SelectItem value="7">Expira em 7 dias</SelectItem>
            <SelectItem value="15">Expira em 15 dias</SelectItem>
            <SelectItem value="30">Expira em 30 dias</SelectItem>
            <SelectItem value="60">Expira em 60 dias</SelectItem>
          </SelectContent>
        </Select>

        {/* Institution filter */}
        {institutions.length > 0 && (
          <Select value={institution || 'all'} onValueChange={(v) => onInstitutionChange(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Instituição" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as instituições</SelectItem>
              {institutions.map((inst) => (
                <SelectItem key={inst} value={inst}>
                  {inst}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Reset filters */}
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={onReset}>
            <X className="h-4 w-4 mr-1" />
            Limpar filtros
          </Button>
        )}

        {/* Update expired */}
        {onRefreshExpired && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefreshExpired}
            disabled={isRefreshing}
          >
            <RotateCcw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar expirados
          </Button>
        )}
      </div>
    </div>
  );
}
