// ============================================================================
// ACADEMY ENROLLMENT MODAL - Modal for managing enrollment actions
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckCircle,
  XCircle,
  Ban,
  RefreshCw,
  Pencil,
  User,
  Building2,
  Calendar,
  Percent,
  FileText,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import type { AcademyEnrollment } from '@/types/academy';
import {
  ACADEMY_LEVEL_LABELS,
  ACADEMY_STATUS_LABELS,
  ACADEMY_STATUS_COLORS,
  INSTITUTION_TYPES,
  type AcademyLevel,
} from '@/types/academy';
import { getDaysUntilExpiration, getExpirationWarning } from '@/hooks/useAcademy';

// ============================================================================
// TYPES
// ============================================================================

export type ModalAction = 'approve' | 'reject' | 'suspend' | 'renew' | 'edit' | 'view';

interface AcademyEnrollmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrollment: AcademyEnrollment | null;
  action: ModalAction;
  onConfirm: (data: ModalConfirmData) => void;
  isLoading?: boolean;
}

export interface ModalConfirmData {
  action: ModalAction;
  discountPct?: number;
  validUntil?: string;
  reason?: string;
  institutionName?: string;
  institutionType?: string;
  courseArea?: string;
  notes?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AcademyEnrollmentModal({
  open,
  onOpenChange,
  enrollment,
  action,
  onConfirm,
  isLoading,
}: AcademyEnrollmentModalProps) {
  const [discountPct, setDiscountPct] = useState<number>(50);
  const [validUntil, setValidUntil] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [institutionName, setInstitutionName] = useState<string>('');
  const [institutionType, setInstitutionType] = useState<string>('');
  const [courseArea, setCourseArea] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Reset form when modal opens
  useEffect(() => {
    if (open && enrollment) {
      setDiscountPct(enrollment.discount_pct);
      setValidUntil(enrollment.valid_until);
      setInstitutionName(enrollment.institution_name || '');
      setInstitutionType(enrollment.institution_type || '');
      setCourseArea(enrollment.course_area || '');
      setNotes('');
      setReason('');
    }
  }, [open, enrollment]);

  if (!enrollment) return null;

  const daysUntil = getDaysUntilExpiration(enrollment.valid_until);
  const warning = getExpirationWarning(enrollment.valid_until);

  const handleConfirm = () => {
    onConfirm({
      action,
      discountPct,
      validUntil,
      reason,
      institutionName,
      institutionType,
      courseArea,
      notes,
    });
  };

  const getTitle = () => {
    switch (action) {
      case 'approve':
        return 'Aprovar Inscrição';
      case 'reject':
        return 'Rejeitar Inscrição';
      case 'suspend':
        return 'Suspender Inscrição';
      case 'renew':
        return 'Renovar Inscrição';
      case 'edit':
        return 'Editar Inscrição';
      case 'view':
        return 'Detalhes da Inscrição';
      default:
        return 'Inscrição';
    }
  };

  const getIcon = () => {
    switch (action) {
      case 'approve':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'reject':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'suspend':
        return <Ban className="h-5 w-5 text-orange-500" />;
      case 'renew':
        return <RefreshCw className="h-5 w-5 text-primary" />;
      case 'edit':
        return <Pencil className="h-5 w-5 text-primary" />;
      default:
        return <User className="h-5 w-5 text-primary" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIcon()}
            {getTitle()}
          </DialogTitle>
          <DialogDescription>
            {enrollment.full_name} — {enrollment.email}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 py-4 pr-4">
            {/* Enrollment Info Summary */}
            <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Tipo</p>
                  <p className="text-sm font-medium">
                    {ACADEMY_LEVEL_LABELS[enrollment.academy_level as AcademyLevel]}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={ACADEMY_STATUS_COLORS[enrollment.status]}
                >
                  {ACADEMY_STATUS_LABELS[enrollment.status]}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Desconto</p>
                  <p className="text-sm font-medium">{enrollment.discount_pct}%</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Validade</p>
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-medium">
                      {new Date(enrollment.valid_until).toLocaleDateString('pt-BR')}
                    </p>
                    {warning && (
                      <AlertTriangle
                        className={`h-3 w-3 ${
                          warning === 'danger'
                            ? 'text-red-500'
                            : warning === 'warning'
                            ? 'text-orange-500'
                            : 'text-yellow-500'
                        }`}
                      />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {daysUntil > 0 ? `${daysUntil} dias restantes` : 'Expirado'}
                  </p>
                </div>
              </div>
            </div>

            {enrollment.institution_name && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Instituição</p>
                  <p className="text-sm font-medium">{enrollment.institution_name}</p>
                  {enrollment.institution_type && (
                    <p className="text-xs text-muted-foreground">{enrollment.institution_type}</p>
                  )}
                  {enrollment.course_area && (
                    <p className="text-xs text-muted-foreground">Área: {enrollment.course_area}</p>
                  )}
                </div>
              </div>
            )}

            {enrollment.proof_url && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <a
                  href={enrollment.proof_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  Ver comprovante
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            <Separator />

            {/* Action-specific fields */}
            {(action === 'approve' || action === 'renew') && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="discountPct">Desconto (%)</Label>
                  <Input
                    id="discountPct"
                    type="number"
                    min={50}
                    max={100}
                    value={discountPct}
                    onChange={(e) => setDiscountPct(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Entre 50% e 100%</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="validUntil">Válido até</Label>
                  <Input
                    id="validUntil"
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                  />
                </div>
              </div>
            )}

            {(action === 'reject' || action === 'suspend') && (
              <div className="space-y-2">
                <Label htmlFor="reason">Motivo (opcional)</Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Informe o motivo..."
                  rows={3}
                />
              </div>
            )}

            {action === 'edit' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="institutionName">Nome da Instituição</Label>
                  <Input
                    id="institutionName"
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                    placeholder="Ex: Universidade de São Paulo"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="institutionType">Tipo de Instituição</Label>
                  <Select value={institutionType} onValueChange={setInstitutionType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {INSTITUTION_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="courseArea">Área/Curso</Label>
                  <Input
                    id="courseArea"
                    value={courseArea}
                    onChange={(e) => setCourseArea(e.target.value)}
                    placeholder="Ex: Ciência da Computação"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discountPct">Desconto (%)</Label>
                  <Input
                    id="discountPct"
                    type="number"
                    min={50}
                    max={100}
                    value={discountPct}
                    onChange={(e) => setDiscountPct(Number(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Adicionar observações..."
                    rows={3}
                  />
                </div>
              </div>
            )}

            {/* Notes history */}
            {enrollment.notes && action === 'view' && (
              <div className="space-y-2">
                <Label>Histórico de Alterações</Label>
                <div className="p-3 rounded-lg bg-muted/50 text-xs font-mono whitespace-pre-wrap">
                  {enrollment.notes}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {action === 'view' ? 'Fechar' : 'Cancelar'}
          </Button>
          {action !== 'view' && (
            <Button
              onClick={handleConfirm}
              disabled={isLoading}
              variant={action === 'reject' || action === 'suspend' ? 'destructive' : 'default'}
            >
              {isLoading ? 'Processando...' : 'Confirmar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
