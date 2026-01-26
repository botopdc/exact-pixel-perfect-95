// ============================================================================
// SLA POLICIES PAGE - Admin only
// ============================================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useSLAPolicies } from '@/hooks/useSupportTickets';
import {
  SLAPolicy,
  SLAPolicyPayload,
  PRIORITY_LABELS,
  IMPACT_LABELS,
  SupportTicketPriority,
  SupportTicketImpact,
  canManageSLAs,
} from '@/types/supportTicket';
import { authService } from '@/services/authService';

export default function SLAPoliciesPage() {
  const navigate = useNavigate();
  const session = authService.getSession();
  const userLevel = session?.level ?? 0;

  const {
    policies,
    isLoading,
    canManage,
    createPolicy,
    updatePolicy,
    deletePolicy,
    isCreating,
    isUpdating,
    isDeleting,
  } = useSLAPolicies();

  const [editingPolicy, setEditingPolicy] = useState<SLAPolicy | null>(null);
  const [deletingPolicy, setDeletingPolicy] = useState<SLAPolicy | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const [formData, setFormData] = useState<SLAPolicyPayload>({
    name: '',
    description: '',
    priority: 'P3',
    impact: 'baixo',
    first_response_hours: 4,
    resolution_hours: 24,
    business_hours_only: true,
    is_active: true,
  });

  // Check access
  if (!canManageSLAs(userLevel)) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acesso Negado</h2>
          <p className="text-muted-foreground">
            Apenas administradores podem gerenciar políticas de SLA.
          </p>
        </Card>
      </div>
    );
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      priority: 'P3',
      impact: 'baixo',
      first_response_hours: 4,
      resolution_hours: 24,
      business_hours_only: true,
      is_active: true,
    });
  };

  const handleEdit = (policy: SLAPolicy) => {
    setEditingPolicy(policy);
    setFormData({
      name: policy.name,
      description: policy.description || '',
      priority: policy.priority,
      impact: policy.impact,
      first_response_hours: policy.first_response_hours,
      resolution_hours: policy.resolution_hours,
      business_hours_only: policy.business_hours_only,
      is_active: policy.is_active,
    });
  };

  const handleSave = async () => {
    if (editingPolicy) {
      await updatePolicy(editingPolicy.id, formData);
      setEditingPolicy(null);
    } else {
      await createPolicy(formData);
      setShowCreateDialog(false);
    }
    resetForm();
  };

  const handleDelete = async () => {
    if (deletingPolicy) {
      await deletePolicy(deletingPolicy.id);
      setDeletingPolicy(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Políticas de SLA</h1>
            <p className="text-muted-foreground">Gerenciamento de acordos de nível de serviço</p>
          </div>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Política
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : policies.length === 0 ? (
            <div className="p-8 text-center">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhuma política cadastrada</h3>
              <p className="text-muted-foreground mt-1 mb-4">
                Crie políticas de SLA para definir tempos de resposta e resolução.
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Política
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Impacto</TableHead>
                  <TableHead>1ª Resposta</TableHead>
                  <TableHead>Resolução</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell className="font-medium">{policy.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{PRIORITY_LABELS[policy.priority]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{IMPACT_LABELS[policy.impact]}</Badge>
                    </TableCell>
                    <TableCell>{policy.first_response_hours}h</TableCell>
                    <TableCell>{policy.resolution_hours}h</TableCell>
                    <TableCell>
                      {policy.business_hours_only ? 'Comercial' : '24/7'}
                    </TableCell>
                    <TableCell>
                      {policy.is_active ? (
                        <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" />
                          Inativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(policy)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingPolicy(policy)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog
        open={showCreateDialog || !!editingPolicy}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setEditingPolicy(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPolicy ? 'Editar Política de SLA' : 'Nova Política de SLA'}
            </DialogTitle>
            <DialogDescription>
              Configure os tempos de resposta e resolução para esta combinação de prioridade e impacto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: SLA Premium P0"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(v) => setFormData({ ...formData, priority: v as SupportTicketPriority })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Impacto</Label>
                <Select
                  value={formData.impact}
                  onValueChange={(v) => setFormData({ ...formData, impact: v as SupportTicketImpact })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(IMPACT_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>1ª Resposta (horas)</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.first_response_hours}
                  onChange={(e) => setFormData({ ...formData, first_response_hours: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Resolução (horas)</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.resolution_hours}
                  onChange={(e) => setFormData({ ...formData, resolution_hours: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="business-hours">Apenas horário comercial</Label>
              <Switch
                id="business-hours"
                checked={formData.business_hours_only}
                onCheckedChange={(checked) => setFormData({ ...formData, business_hours_only: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is-active">Política ativa</Label>
              <Switch
                id="is-active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setEditingPolicy(null);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.name || isCreating || isUpdating}
            >
              {editingPolicy ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingPolicy} onOpenChange={() => setDeletingPolicy(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Política de SLA</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a política "{deletingPolicy?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
