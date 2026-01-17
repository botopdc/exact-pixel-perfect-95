// ============================================================================
// ON-CALL (PLANTÃO) PAGE
// ============================================================================

import React, { useEffect, useState } from 'react';
import {
  Phone,
  Plus,
  Calendar,
  Clock,
  User,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ModuleHeader, SectionTitle } from '@/components/navigation/ModuleCard';
import { useToast } from '@/hooks/use-toast';
import {
  getOnCallShifts,
  getCurrentOnCallUsers,
  getTechUsers,
  createOnCallShift,
} from '@/services/techOpsService';
import type { TechOnCallShift, TechUser, OnCallLevel } from '@/types/techOps';
import { ON_CALL_LEVEL_LABELS } from '@/types/techOps';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function OnCallPage() {
  const { toast } = useToast();
  
  const [currentOnCall, setCurrentOnCall] = useState<TechOnCallShift[]>([]);
  const [allShifts, setAllShifts] = useState<TechOnCallShift[]>([]);
  const [users, setUsers] = useState<TechUser[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create dialog - use undefined for user_id to avoid empty string issues
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newShift, setNewShift] = useState<{
    user_id: string | undefined;
    level: OnCallLevel;
    start_at: string;
    end_at: string;
  }>({
    user_id: undefined,
    level: 'N1' as OnCallLevel,
    start_at: '',
    end_at: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [currentData, allData, usersData] = await Promise.all([
        getCurrentOnCallUsers(),
        getOnCallShifts(),
        getTechUsers({ is_active: true }),
      ]);
      setCurrentOnCall(currentData);
      setAllShifts(allData);
      setUsers(usersData.filter(u => ['N1', 'N2', 'N3', 'ADMIN'].includes(u.role)));
    } catch (error) {
      console.error('Erro ao carregar plantões:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateShift() {
    if (!newShift.user_id || !newShift.start_at || !newShift.end_at) {
      toast({ title: 'Erro', description: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }

    try {
      setSubmitting(true);
      await createOnCallShift({
        user_id: newShift.user_id,
        level: newShift.level,
        start_at: new Date(newShift.start_at).toISOString(),
        end_at: new Date(newShift.end_at).toISOString(),
        is_active: true,
      });
      toast({ title: 'Sucesso', description: 'Plantão criado' });
      setDialogOpen(false);
      setNewShift({ user_id: undefined, level: 'N1', start_at: '', end_at: '' });
      await loadData();
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível criar o plantão', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Escala de Plantão"
        description="Gerenciamento de plantonistas e escalas"
        icon={Phone}
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Plantão
          </Button>
        }
      />

      {/* Current On-Call */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Plantonistas Ativos Agora
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : currentOnCall.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Phone className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum plantonista ativo no momento</p>
              <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
                Criar Escala
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {currentOnCall.map((shift) => (
                <Card key={shift.id} className="bg-green-500/5 border-green-500/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                        <User className="h-6 w-6 text-green-500" />
                      </div>
                      <div>
                        <p className="font-semibold">{shift.user?.name}</p>
                        <Badge variant="outline" className="mt-1">
                          {ON_CALL_LEVEL_LABELS[shift.level]}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-muted-foreground">
                      <p>Até: {format(new Date(shift.end_at), "dd/MM 'às' HH:mm", { locale: ptBR })}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Shifts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Histórico de Escalas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plantonista</TableHead>
                <TableHead>Nível</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allShifts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhuma escala registrada
                  </TableCell>
                </TableRow>
              ) : (
                allShifts.map((shift) => {
                  const now = new Date();
                  const start = new Date(shift.start_at);
                  const end = new Date(shift.end_at);
                  const isActive = now >= start && now <= end && shift.is_active;
                  const isPast = now > end;
                  
                  return (
                    <TableRow key={shift.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{shift.user?.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{ON_CALL_LEVEL_LABELS[shift.level]}</Badge>
                      </TableCell>
                      <TableCell>
                        {format(start, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {format(end, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {isActive ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                            Ativo
                          </Badge>
                        ) : isPast ? (
                          <Badge variant="secondary">Concluído</Badge>
                        ) : (
                          <Badge variant="outline">Agendado</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Plantão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Plantonista</Label>
              <Select 
                value={newShift.user_id ?? ''} 
                onValueChange={(v) => setNewShift(prev => ({ ...prev, user_id: v || undefined }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o plantonista" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nível</Label>
              <Select 
                value={newShift.level} 
                onValueChange={(v) => setNewShift(prev => ({ ...prev, level: v as OnCallLevel }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="N1">Nível 1</SelectItem>
                  <SelectItem value="N2">Nível 2</SelectItem>
                  <SelectItem value="N3">Nível 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Início</Label>
                <Input
                  type="datetime-local"
                  value={newShift.start_at}
                  onChange={(e) => setNewShift(prev => ({ ...prev, start_at: e.target.value }))}
                />
              </div>
              <div>
                <Label>Fim</Label>
                <Input
                  type="datetime-local"
                  value={newShift.end_at}
                  onChange={(e) => setNewShift(prev => ({ ...prev, end_at: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateShift} disabled={submitting}>
              {submitting ? 'Criando...' : 'Criar Plantão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
