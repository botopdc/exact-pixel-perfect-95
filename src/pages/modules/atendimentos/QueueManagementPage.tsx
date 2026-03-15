// ============================================================================
// QUEUE MANAGEMENT PAGE — Admin/Manager can manage queue members
// Route: /modulos/atendimentos/suporte-tecnico/filas
// ============================================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useQueues, useQueueMembers, useQueueMemberMutations } from '@/hooks/useSupportTicketCore';
import { authService } from '@/services/authService';
import { TICKET_LIST_ROUTE } from '@/lib/ticketPermissions';
import type { SupportQueueRecord } from '@/services/supportTicketCoreService';

export default function QueueManagementPage() {
  const session = authService.getSession();
  const userLevel = session?.level ?? 0;
  const navigate = useNavigate();

  const { data: queues, isLoading: queuesLoading } = useQueues();
  const [selectedQueue, setSelectedQueue] = useState<string | undefined>();
  const { data: members, isLoading: membersLoading } = useQueueMembers(selectedQueue);
  const { addMember, removeMember, toggleMember } = useQueueMemberMutations();
  const [addOpen, setAddOpen] = useState(false);
  const [newMember, setNewMember] = useState({ user_id: '', user_name: '', user_email: '', user_level: '900' });

  const canManage = userLevel >= 950; // managers and admins can add/remove
  const canView = userLevel >= 900; // support can at least view

  if (!canView) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Acesso restrito a usuários de suporte.</p>
      </div>
    );
  }

  const handleAdd = async () => {
    if (!selectedQueue || !newMember.user_id || !newMember.user_name || !newMember.user_email) return;
    await addMember.mutateAsync({
      queue_id: selectedQueue,
      user_id: newMember.user_id,
      user_name: newMember.user_name,
      user_email: newMember.user_email,
      user_level: parseInt(newMember.user_level),
    });
    setNewMember({ user_id: '', user_name: '', user_email: '', user_level: '900' });
    setAddOpen(false);
  };

  const selectedQueueObj = queues?.find((q: SupportQueueRecord) => q.id === selectedQueue);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(TICKET_LIST_ROUTE)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Users className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Gestão de Filas</h1>
          <p className="text-sm text-muted-foreground">Gerencie membros das filas N1, N2, N3 e CS</p>
        </div>
      </div>

      {/* Queue selector */}
      <div className="flex flex-wrap gap-2">
        {queuesLoading ? (
          <Skeleton className="h-10 w-40" />
        ) : (
          queues?.map((q: SupportQueueRecord) => (
            <Button
              key={q.id}
              variant={selectedQueue === q.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedQueue(q.id)}
            >
              {q.name}
              <Badge variant="secondary" className="ml-2 h-4 px-1 text-[10px]">
                {members && selectedQueue === q.id
                  ? members.filter((m: any) => m.is_active).length
                  : ''}
              </Badge>
            </Button>
          ))
        )}
      </div>

      {/* Members table */}
      {selectedQueue && (
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">
              Membros — {selectedQueueObj?.name || 'Fila'}
            </CardTitle>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar Membro
            </Button>
          </CardHeader>
          <CardContent>
            {membersLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : !members || members.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum membro nesta fila. Adicione membros para que possam ver e assumir tickets.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Nível</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.user_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.user_email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{m.user_level}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.is_active ? 'default' : 'secondary'} className="text-xs">
                          {m.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => toggleMember.mutate(m.id)}
                            title={m.is_active ? 'Desativar' : 'Ativar'}
                          >
                            {m.is_active
                              ? <ToggleRight className="h-4 w-4 text-emerald-500" />
                              : <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                            }
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                            onClick={() => { if (confirm('Remover membro?')) removeMember.mutate(m.id); }}
                          >
                            <Trash2 className="h-4 w-4" />
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
      )}

      {/* Add member dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Membro à Fila</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>ID do Usuário (numérico) *</Label>
              <Input
                value={newMember.user_id}
                onChange={(e) => setNewMember(p => ({ ...p, user_id: e.target.value }))}
                placeholder="Ex: 42"
                type="number"
              />
            </div>
            <div>
              <Label>Nome *</Label>
              <Input
                value={newMember.user_name}
                onChange={(e) => setNewMember(p => ({ ...p, user_name: e.target.value }))}
                placeholder="Nome completo"
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                value={newMember.user_email}
                onChange={(e) => setNewMember(p => ({ ...p, user_email: e.target.value }))}
                placeholder="email@open.com.br"
                type="email"
              />
            </div>
            <div>
              <Label>Nível</Label>
              <Select value={newMember.user_level} onValueChange={(v) => setNewMember(p => ({ ...p, user_level: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="775">775 — CS</SelectItem>
                  <SelectItem value="900">900 — Suporte</SelectItem>
                  <SelectItem value="950">950 — Gerente Suporte</SelectItem>
                  <SelectItem value="1000">1000 — Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleAdd}
              disabled={addMember.isPending || !newMember.user_id || !newMember.user_name || !newMember.user_email}
            >
              {addMember.isPending ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
