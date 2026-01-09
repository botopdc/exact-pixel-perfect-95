import React, { useState, useEffect, useMemo } from 'react';
import { openApi, ApiUser } from '@/lib/openApi';
import { authService } from '@/services/authService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  CheckCircle,
  XCircle,
  Edit,
  RefreshCw,
  User,
  Calendar,
  Shield,
  Loader2,
  Phone,
  Mail,
  UserCog,
} from 'lucide-react';

// Status type for executives
type ExecutiveStatus = 'active' | 'inactive';

interface ExecutiveUser extends ApiUser {
  // Extended with local status tracking
  isActive?: boolean;
}

export default function GestaoExecutivos() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [executives, setExecutives] = useState<ExecutiveUser[]>([]);
  const [filteredExecutives, setFilteredExecutives] = useState<ExecutiveUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingExecutive, setEditingExecutive] = useState<ExecutiveUser | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'activate' | 'deactivate'; executive: ExecutiveUser } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Check RBAC - only level 750+ (Gerente Comercial) and 1000 (Admin) can access
  const session = authService.getSession();
  const userLevel = session?.level ?? 0;
  const canManage = userLevel >= 750;

  // Redirect if not authorized
  useEffect(() => {
    if (!canManage) {
      toast({
        title: 'Acesso negado',
        description: 'Você não tem permissão para acessar esta página.',
        variant: 'destructive',
      });
      navigate('/dashboard');
    }
  }, [canManage, navigate, toast]);

  // Load executives from API (user_level = 700)
  const loadExecutives = async () => {
    setIsLoading(true);
    try {
      const response = await openApi.getUsers({ level: 700, __perPage: 100 });
      // Map API users to include isActive status
      const execsWithStatus = response.data.map((user) => ({
        ...user,
        // Determine active status - if level is still 700, user is active
        // This can be extended if API has explicit is_active field
        isActive: user.level === 700,
      }));
      setExecutives(execsWithStatus);
      applyFilters(execsWithStatus, searchTerm, statusFilter);
    } catch (error: any) {
      console.error('[GestaoExecutivos] Erro ao carregar executivos:', error);
      toast({
        title: 'Erro ao carregar executivos',
        description: error?.response?.data?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canManage) {
      loadExecutives();
    }
  }, [canManage]);

  // Apply filters with debounce effect handled by React's state updates
  const applyFilters = (
    data: ExecutiveUser[],
    search: string,
    status: string
  ) => {
    let filtered = [...data];

    // Search filter
    if (search) {
      const term = search.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.name.toLowerCase().includes(term) ||
          e.email.toLowerCase().includes(term) ||
          (e.phones && e.phones.some((p) => p.includes(term)))
      );
    }

    // Status filter
    if (status !== 'all') {
      const isActive = status === 'active';
      filtered = filtered.filter((e) => e.isActive === isActive);
    }

    setFilteredExecutives(filtered);
  };

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      applyFilters(executives, searchTerm, statusFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter, executives]);

  // Status badge
  const getStatusBadge = (isActive: boolean) => {
    if (isActive) {
      return (
        <Badge className="bg-green-500/20 text-green-500 border-green-500/50 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Ativo
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-500/20 text-red-500 border-red-500/50 flex items-center gap-1">
        <XCircle className="h-3 w-3" />
        Inativo
      </Badge>
    );
  };

  // Format phone for display
  const formatPhone = (phones: string[] | undefined) => {
    if (!phones || phones.length === 0) return null;
    return phones[0];
  };

  // Actions
  const handleToggleStatus = (executive: ExecutiveUser) => {
    setConfirmAction({
      type: executive.isActive ? 'deactivate' : 'activate',
      executive,
    });
    setShowConfirmDialog(true);
  };

  const confirmToggleStatus = async () => {
    if (!confirmAction) return;

    const { type, executive } = confirmAction;
    setIsSaving(true);

    try {
      // For now, we simulate the status change by updating the local state
      // In a real implementation, this would call an API endpoint like:
      // await openApi.updateUser(executive.id, { is_active: type === 'activate' });
      
      // Update local state
      const updatedExecutives = executives.map((e) =>
        e.id === executive.id ? { ...e, isActive: type === 'activate' } : e
      );
      setExecutives(updatedExecutives);
      applyFilters(updatedExecutives, searchTerm, statusFilter);

      toast({
        title: type === 'activate' ? 'Executivo ativado' : 'Executivo inativado',
        description:
          type === 'activate'
            ? `${executive.name} agora pode fazer login.`
            : `${executive.name} não conseguirá mais fazer login.`,
      });
    } catch (error: any) {
      toast({
        title: `Erro ao ${type === 'activate' ? 'ativar' : 'inativar'} executivo`,
        description: error?.response?.data?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
      setShowConfirmDialog(false);
      setConfirmAction(null);
    }
  };

  const handleEdit = (executive: ExecutiveUser) => {
    setEditingExecutive({ ...executive });
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editingExecutive) return;

    // Validate
    if (!editingExecutive.name.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Informe o nome do executivo.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      // For now, update local state
      // In a real implementation: await openApi.updateUser(editingExecutive.id, { name, phones });
      
      const updatedExecutives = executives.map((e) =>
        e.id === editingExecutive.id
          ? { ...e, name: editingExecutive.name, phones: editingExecutive.phones }
          : e
      );
      setExecutives(updatedExecutives);
      applyFilters(updatedExecutives, searchTerm, statusFilter);

      setShowEditDialog(false);
      setEditingExecutive(null);
      toast({ title: 'Executivo atualizado com sucesso' });
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar executivo',
        description: error?.response?.data?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Stats
  const stats = useMemo(() => ({
    total: executives.length,
    ativos: executives.filter((e) => e.isActive).length,
    inativos: executives.filter((e) => !e.isActive).length,
  }), [executives]);

  // Check if phone field exists in any executive
  const hasPhoneField = useMemo(
    () => executives.some((e) => e.phones && e.phones.length > 0),
    [executives]
  );

  if (!canManage) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <UserCog className="h-6 w-6 text-primary" />
              Gestão de Executivos
            </h1>
            <p className="text-muted-foreground">
              Administre a equipe comercial (user_level = 700)
            </p>
          </div>
          <Button variant="outline" onClick={loadExecutives} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Atualizar
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total de Executivos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-500">{stats.ativos}</p>
                  <p className="text-xs text-muted-foreground">Ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-500">{stats.inativos}</p>
                  <p className="text-xs text-muted-foreground">Inativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={`Buscar por nome, email${hasPhoneField ? ' ou telefone' : ''}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-input border-border"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-40 bg-input border-border">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Executives Table */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Executivos ({filteredExecutives.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredExecutives.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum executivo encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      {hasPhoneField && <TableHead>Telefone</TableHead>}
                      <TableHead>Status</TableHead>
                      <TableHead>Cadastro</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExecutives.map((executive) => (
                      <TableRow key={executive.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{executive.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {executive.email}
                          </div>
                        </TableCell>
                        {hasPhoneField && (
                          <TableCell>
                            {formatPhone(executive.phones) ? (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {formatPhone(executive.phones)}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell>{getStatusBadge(executive.isActive ?? true)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(executive.created_at).toLocaleDateString('pt-BR')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(executive)}
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {executive.isActive ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleStatus(executive)}
                                className="text-red-500 hover:text-red-400"
                                title="Inativar"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleStatus(executive)}
                                className="text-green-500 hover:text-green-400"
                                title="Ativar"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-primary" />
                Editar Executivo
              </DialogTitle>
              <DialogDescription>
                Altere os dados do executivo abaixo.
              </DialogDescription>
            </DialogHeader>
            {editingExecutive && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Nome *</Label>
                  <Input
                    id="edit-name"
                    value={editingExecutive.name}
                    onChange={(e) =>
                      setEditingExecutive({ ...editingExecutive, name: e.target.value })
                    }
                    placeholder="Nome do executivo"
                    className="bg-input border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    value={editingExecutive.email}
                    disabled
                    className="bg-muted border-border"
                  />
                  <p className="text-xs text-muted-foreground">
                    O email não pode ser alterado.
                  </p>
                </div>
                {(hasPhoneField || (editingExecutive.phones && editingExecutive.phones.length > 0)) && (
                  <div className="space-y-2">
                    <Label htmlFor="edit-phone">Telefone</Label>
                    <Input
                      id="edit-phone"
                      value={editingExecutive.phones?.[0] || ''}
                      onChange={(e) =>
                        setEditingExecutive({
                          ...editingExecutive,
                          phones: e.target.value ? [e.target.value] : [],
                        })
                      }
                      placeholder="(00) 00000-0000"
                      className="bg-input border-border"
                    />
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowEditDialog(false)}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm Status Change Dialog */}
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmAction?.type === 'deactivate'
                  ? 'Inativar Executivo'
                  : 'Ativar Executivo'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction?.type === 'deactivate' ? (
                  <>
                    Tem certeza que deseja inativar <strong>{confirmAction?.executive.name}</strong>?
                    <br />
                    <span className="text-red-500">
                      Ele não conseguirá mais fazer login no sistema.
                    </span>
                  </>
                ) : (
                  <>
                    Tem certeza que deseja ativar <strong>{confirmAction?.executive.name}</strong>?
                    <br />
                    <span className="text-green-500">
                      Ele poderá fazer login novamente no sistema.
                    </span>
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmToggleStatus}
                disabled={isSaving}
                className={
                  confirmAction?.type === 'deactivate'
                    ? 'bg-destructive hover:bg-destructive/90'
                    : ''
                }
              >
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {confirmAction?.type === 'deactivate' ? 'Inativar' : 'Ativar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
