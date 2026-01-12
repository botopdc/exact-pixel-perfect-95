// ============================================================================
// GESTÃO DE USUÁRIOS - CRUD completo conforme API
// Acesso: Admin (1000)
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { authService } from '@/services/authService';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import {
  useUsers,
  useUser,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  getUserLevelLabel,
  USER_LEVEL_OPTIONS,
  UserStoreRequest,
  UserUpdateRequest,
} from '@/hooks/useUsers';
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Users,
  Search,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  User,
  Mail,
  Phone,
  Calendar,
  Shield,
  Loader2,
  Eye,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createUserSchema = z.object({
  entity_id: z.number({ required_error: 'Entity ID é obrigatório' }).int().positive(),
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(255),
  email: z.string().email('Email inválido').max(255),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres').max(150),
  password_confirmation: z.string(),
  phones: z.array(z.string()).optional(),
  birthday: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
}).refine((data) => data.password === data.password_confirmation, {
  message: 'As senhas não conferem',
  path: ['password_confirmation'],
});

const updateUserSchema = z.object({
  entity_id: z.number().int().positive().optional(),
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(255).optional(),
  email: z.string().email('Email inválido').max(255).optional(),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres').max(150).optional().or(z.literal('')),
  password_confirmation: z.string().optional().or(z.literal('')),
  phones: z.array(z.string()).optional(),
  birthday: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
}).refine((data) => {
  if (data.password && data.password.length > 0) {
    return data.password === data.password_confirmation;
  }
  return true;
}, {
  message: 'As senhas não conferem',
  path: ['password_confirmation'],
});

type CreateUserFormData = z.infer<typeof createUserSchema>;
type UpdateUserFormData = z.infer<typeof updateUserSchema>;

// ============================================================================
// COMPONENT
// ============================================================================

export default function GestaoUsuarios() {
  const { toast } = useToast();
  const navigate = useNavigate();

  // Auth check
  const session = authService.getSession();
  const userLevel = session?.level ?? 0;
  const canManage = userLevel >= 1000; // Apenas Admin

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [perPage] = useState(15);

  // Dialogs
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  // Query params
  const queryParams = useMemo(() => {
    const params: Record<string, any> = {
      __page: page,
      __perPage: perPage,
    };
    if (searchTerm) params.__q = searchTerm;
    if (levelFilter && levelFilter !== 'all') params.level = parseInt(levelFilter);
    return params;
  }, [searchTerm, levelFilter, page, perPage]);

  // Queries
  const { data: usersData, isLoading, refetch } = useUsers(queryParams);
  const { data: selectedUser, isLoading: isLoadingUser } = useUser(selectedUserId);

  // Mutations
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();

  // Forms
  const createForm = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      entity_id: 1,
      name: '',
      email: '',
      password: '',
      password_confirmation: '',
      phones: [],
      birthday: null,
      tags: [],
    },
  });

  const editForm = useForm<UpdateUserFormData>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      name: '',
      email: '',
      phones: [],
      birthday: null,
      tags: [],
    },
  });

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

  // Load user data into edit form when selected
  useEffect(() => {
    if (selectedUser && showEditSheet) {
      editForm.reset({
        entity_id: selectedUser.entity_id,
        name: selectedUser.name,
        email: selectedUser.email,
        phones: selectedUser.phones || [],
        birthday: selectedUser.birthday || null,
        tags: [],
        password: '',
        password_confirmation: '',
      });
    }
  }, [selectedUser, showEditSheet, editForm]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Handlers
  const handleCreate = async (data: CreateUserFormData) => {
    try {
      await createMutation.mutateAsync({
        entity_id: data.entity_id,
        name: data.name,
        email: data.email,
        password: data.password,
        password_confirmation: data.password_confirmation,
        phones: data.phones,
        birthday: data.birthday,
        tags: data.tags,
      });
      toast({ title: 'Usuário criado com sucesso!' });
      setShowCreateSheet(false);
      createForm.reset();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Erro ao criar usuário';
      const errors = error?.response?.data?.errors;
      toast({
        title: 'Erro ao criar usuário',
        description: errors ? Object.values(errors).flat().join(', ') : message,
        variant: 'destructive',
      });
    }
  };

  const handleUpdate = async (data: UpdateUserFormData) => {
    if (!selectedUserId) return;

    // Remove empty password fields
    const payload: UserUpdateRequest = { ...data };
    if (!payload.password) {
      delete payload.password;
      delete payload.password_confirmation;
    }

    try {
      await updateMutation.mutateAsync({ id: selectedUserId, data: payload });
      toast({ title: 'Usuário atualizado com sucesso!' });
      setShowEditSheet(false);
      setSelectedUserId(null);
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Erro ao atualizar usuário';
      const errors = error?.response?.data?.errors;
      toast({
        title: 'Erro ao atualizar usuário',
        description: errors ? Object.values(errors).flat().join(', ') : message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedUserId) return;

    try {
      await deleteMutation.mutateAsync(selectedUserId);
      toast({ title: 'Usuário excluído com sucesso!' });
      setShowDeleteDialog(false);
      setSelectedUserId(null);
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir usuário',
        description: error?.response?.data?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const openEdit = (userId: number) => {
    setSelectedUserId(userId);
    setShowEditSheet(true);
  };

  const openView = (userId: number) => {
    setSelectedUserId(userId);
    setShowViewDialog(true);
  };

  const openDelete = (userId: number) => {
    setSelectedUserId(userId);
    setShowDeleteDialog(true);
  };

  // Stats
  const stats = useMemo(() => ({
    total: usersData?.total || 0,
    currentPage: usersData?.current_page || 1,
    lastPage: usersData?.last_page || 1,
  }), [usersData]);

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
              <Users className="h-6 w-6 text-primary" />
              Gestão de Usuários
            </h1>
            <p className="text-muted-foreground">
              Administre todos os usuários do sistema
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Atualizar
            </Button>
            <Button onClick={() => setShowCreateSheet(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Button>
          </div>
        </div>

        {/* Stats */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total de Usuários</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou email (__q)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-input border-border"
                />
              </div>
              <Select value={levelFilter} onValueChange={(v) => { setLevelFilter(v); setPage(1); }}>
                <SelectTrigger className="w-full md:w-48 bg-input border-border">
                  <SelectValue placeholder="Filtrar por nível" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os níveis</SelectItem>
                  {USER_LEVEL_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value.toString()}>
                      {opt.label} ({opt.value})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Usuários ({usersData?.data?.length || 0} de {stats.total})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !usersData?.data?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum usuário encontrado</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Nível</TableHead>
                        <TableHead>Entity ID</TableHead>
                        <TableHead>Criado em</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersData.data.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-mono text-xs">{user.id}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{user.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {user.email}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">
                              {user.level} - {getUserLevelLabel(user.level)}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{user.entity_id}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(user.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openView(user.id)}
                                title="Visualizar"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(user.id)}
                                title="Editar"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDelete(user.id)}
                                title="Excluir"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Página {stats.currentPage} de {stats.lastPage}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(stats.lastPage, p + 1))}
                      disabled={page >= stats.lastPage}
                    >
                      Próxima
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Create User Sheet */}
        <Sheet open={showCreateSheet} onOpenChange={setShowCreateSheet}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Novo Usuário</SheetTitle>
              <SheetDescription>
                Preencha os campos conforme UserStoreRequest da API
              </SheetDescription>
            </SheetHeader>

            <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="create-entity_id">Entity ID *</Label>
                <Input
                  id="create-entity_id"
                  type="number"
                  {...createForm.register('entity_id', { valueAsNumber: true })}
                  placeholder="1"
                />
                {createForm.formState.errors.entity_id && (
                  <p className="text-sm text-destructive">{createForm.formState.errors.entity_id.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-name">Nome *</Label>
                <Input
                  id="create-name"
                  {...createForm.register('name')}
                  placeholder="John Doe"
                  maxLength={255}
                />
                {createForm.formState.errors.name && (
                  <p className="text-sm text-destructive">{createForm.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-email">Email *</Label>
                <Input
                  id="create-email"
                  type="email"
                  {...createForm.register('email')}
                  placeholder="john@example.com"
                  maxLength={255}
                />
                {createForm.formState.errors.email && (
                  <p className="text-sm text-destructive">{createForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-password">Senha *</Label>
                <Input
                  id="create-password"
                  type="password"
                  {...createForm.register('password')}
                  placeholder="Mínimo 8 caracteres"
                  maxLength={150}
                />
                {createForm.formState.errors.password && (
                  <p className="text-sm text-destructive">{createForm.formState.errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-password_confirmation">Confirmar Senha *</Label>
                <Input
                  id="create-password_confirmation"
                  type="password"
                  {...createForm.register('password_confirmation')}
                  placeholder="Repita a senha"
                />
                {createForm.formState.errors.password_confirmation && (
                  <p className="text-sm text-destructive">{createForm.formState.errors.password_confirmation.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-birthday">Data de Nascimento</Label>
                <Input
                  id="create-birthday"
                  type="date"
                  {...createForm.register('birthday')}
                />
                <p className="text-xs text-muted-foreground">Formato: YYYY-MM-DD (opcional)</p>
              </div>

              <SheetFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setShowCreateSheet(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar Usuário
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>

        {/* Edit User Sheet */}
        <Sheet open={showEditSheet} onOpenChange={(open) => {
          setShowEditSheet(open);
          if (!open) setSelectedUserId(null);
        }}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Editar Usuário</SheetTitle>
              <SheetDescription>
                Atualizar dados conforme UserUpdateRequest da API
              </SheetDescription>
            </SheetHeader>

            {isLoadingUser ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4 mt-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-entity_id">Entity ID</Label>
                  <Input
                    id="edit-entity_id"
                    type="number"
                    {...editForm.register('entity_id', { valueAsNumber: true })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-name">Nome</Label>
                  <Input
                    id="edit-name"
                    {...editForm.register('name')}
                    maxLength={255}
                  />
                  {editForm.formState.errors.name && (
                    <p className="text-sm text-destructive">{editForm.formState.errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    {...editForm.register('email')}
                    maxLength={255}
                  />
                  {editForm.formState.errors.email && (
                    <p className="text-sm text-destructive">{editForm.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-password">Nova Senha (opcional)</Label>
                  <Input
                    id="edit-password"
                    type="password"
                    {...editForm.register('password')}
                    placeholder="Deixe vazio para manter a atual"
                    maxLength={150}
                  />
                  {editForm.formState.errors.password && (
                    <p className="text-sm text-destructive">{editForm.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-password_confirmation">Confirmar Nova Senha</Label>
                  <Input
                    id="edit-password_confirmation"
                    type="password"
                    {...editForm.register('password_confirmation')}
                    placeholder="Confirme a nova senha"
                  />
                  {editForm.formState.errors.password_confirmation && (
                    <p className="text-sm text-destructive">{editForm.formState.errors.password_confirmation.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-birthday">Data de Nascimento</Label>
                  <Input
                    id="edit-birthday"
                    type="date"
                    {...editForm.register('birthday')}
                  />
                </div>

                <SheetFooter className="mt-6">
                  <Button type="button" variant="outline" onClick={() => setShowEditSheet(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Salvar Alterações
                  </Button>
                </SheetFooter>
              </form>
            )}
          </SheetContent>
        </Sheet>

        {/* View User Dialog */}
        <Dialog open={showViewDialog} onOpenChange={(open) => {
          setShowViewDialog(open);
          if (!open) setSelectedUserId(null);
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Detalhes do Usuário</DialogTitle>
              <DialogDescription>Visualização completa dos dados</DialogDescription>
            </DialogHeader>

            {isLoadingUser ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : selectedUser ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">ID</Label>
                    <p className="font-mono">{selectedUser.id}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">UUID</Label>
                    <p className="font-mono text-xs truncate">{selectedUser.uuid}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-muted-foreground text-xs">Nome</Label>
                  <p className="font-medium">{selectedUser.name}</p>
                </div>

                <div>
                  <Label className="text-muted-foreground text-xs">Email</Label>
                  <p>{selectedUser.email}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">Nível</Label>
                    <Badge variant="outline">
                      {selectedUser.level} - {getUserLevelLabel(selectedUser.level)}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Entity ID</Label>
                    <p className="font-mono">{selectedUser.entity_id}</p>
                  </div>
                </div>

                {selectedUser.phones?.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Telefones</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedUser.phones.map((phone, i) => (
                        <Badge key={i} variant="secondary">{phone}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedUser.birthday && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Data de Nascimento</Label>
                    <p>{format(new Date(selectedUser.birthday), 'dd/MM/yyyy', { locale: ptBR })}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">Criado em</Label>
                    <p className="text-sm">{format(new Date(selectedUser.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Atualizado em</Label>
                    <p className="text-sm">{format(new Date(selectedUser.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                  </div>
                </div>
              </div>
            ) : null}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowViewDialog(false)}>
                Fechar
              </Button>
              <Button onClick={() => {
                setShowViewDialog(false);
                if (selectedUserId) openEdit(selectedUserId);
              }}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. O usuário será removido permanentemente do sistema.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setSelectedUserId(null)}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
