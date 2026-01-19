// ============================================================================
// ACADEMY ENROLLMENTS TABLE - Table component for listing enrollments
// ============================================================================

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  MoreHorizontal,
  Eye,
  CheckCircle,
  XCircle,
  Ban,
  RefreshCw,
  Pencil,
  AlertTriangle,
} from 'lucide-react';
import type { AcademyEnrollment, AcademyLevel } from '@/types/academy';
import {
  ACADEMY_LEVEL_LABELS,
  ACADEMY_STATUS_LABELS,
  ACADEMY_STATUS_COLORS,
} from '@/types/academy';
import { getDaysUntilExpiration, getExpirationWarning } from '@/hooks/useAcademy';
import type { ModalAction } from './AcademyEnrollmentModal';

interface AcademyEnrollmentsTableProps {
  enrollments: AcademyEnrollment[];
  isLoading: boolean;
  onAction: (enrollment: AcademyEnrollment, action: ModalAction) => void;
}

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-12" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-8 w-8" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function AcademyEnrollmentsTable({
  enrollments,
  isLoading,
  onAction,
}: AcademyEnrollmentsTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Instituição</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-center">Desconto</TableHead>
            <TableHead>Validade</TableHead>
            <TableHead className="text-center">Dias p/ expirar</TableHead>
            <TableHead className="w-[50px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableSkeleton />
          ) : enrollments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                Nenhuma inscrição encontrada
              </TableCell>
            </TableRow>
          ) : (
            enrollments.map((enrollment) => {
              const daysUntil = getDaysUntilExpiration(enrollment.valid_until);
              const warning = getExpirationWarning(enrollment.valid_until);
              const isExpired = daysUntil < 0;

              return (
                <TableRow key={enrollment.id}>
                  <TableCell className="font-medium">{enrollment.full_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {enrollment.email}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {ACADEMY_LEVEL_LABELS[enrollment.academy_level as AcademyLevel]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {enrollment.institution_name || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={ACADEMY_STATUS_COLORS[enrollment.status]}
                    >
                      {ACADEMY_STATUS_LABELS[enrollment.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {enrollment.discount_pct}%
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(enrollment.valid_until).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-center">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={`inline-flex items-center gap-1 ${
                              isExpired
                                ? 'text-gray-500'
                                : warning === 'danger'
                                ? 'text-red-500 font-medium'
                                : warning === 'warning'
                                ? 'text-orange-500'
                                : warning === 'caution'
                                ? 'text-yellow-600'
                                : ''
                            }`}
                          >
                            {isExpired ? 'Expirado' : daysUntil}
                            {warning && !isExpired && (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {isExpired
                            ? 'Benefício expirado'
                            : warning === 'danger'
                            ? 'Expira em menos de 7 dias!'
                            : warning === 'warning'
                            ? 'Expira em menos de 15 dias'
                            : warning === 'caution'
                            ? 'Expira em menos de 30 dias'
                            : `${daysUntil} dias restantes`}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onAction(enrollment, 'view')}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onAction(enrollment, 'edit')}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {enrollment.status === 'pending' && (
                          <>
                            <DropdownMenuItem
                              onClick={() => onAction(enrollment, 'approve')}
                              className="text-green-600"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Aprovar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onAction(enrollment, 'reject')}
                              className="text-red-600"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Rejeitar
                            </DropdownMenuItem>
                          </>
                        )}
                        {enrollment.status === 'active' && (
                          <>
                            <DropdownMenuItem
                              onClick={() => onAction(enrollment, 'renew')}
                              className="text-primary"
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Renovar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onAction(enrollment, 'suspend')}
                              className="text-orange-600"
                            >
                              <Ban className="h-4 w-4 mr-2" />
                              Suspender
                            </DropdownMenuItem>
                          </>
                        )}
                        {(enrollment.status === 'expired' || enrollment.status === 'suspended') && (
                          <DropdownMenuItem
                            onClick={() => onAction(enrollment, 'renew')}
                            className="text-primary"
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Reativar/Renovar
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
