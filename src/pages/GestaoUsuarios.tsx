// ============================================================================
// GESTÃO DE USUÁRIOS — Supabase-native (sem openApi/Laravel)
// Substitui a versão antiga que chamava GET /api/user (401 Unauthorized)
// Fonte de dados: public.profiles + public.user_roles (Supabase Auth)
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, RefreshCw, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Shield, UserCheck, UserX,
  MoreHorizontal, Mail, Key, Loader2, Filter, X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getLevelName, getEffectiveRoles, getUserDisplayRole, isAdmin as checkIsAdmin } from '@/lib/rbac';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

interface UserProfile {
  id: string;
  name: string;
  full_name: string | null;
  email: string;
  level: number;
  legacy_user_id: number | null;
  is_active: boolean;
  department: string | null;
  created_at?: string;
  // resolved from user_roles join
  roles: string[];
}

const PER_PAGE_OPTIONS = [15, 25, 50];

const LEVEL_FILTER_OPTIONS = [
  { value: 'all', label: 'Todos os níveis' },
  { value: '1000', label: 'Administrador (1000)' },
  { value: '950', label: 'Gerente de Suporte (950)' },
  { value: '900', label: 'Suporte (900)' },
  { value: '775', label: 'Customer Success (775)' },
  { value: '750', label: 'Gerente Comercial (750)' },
  { value: '700', label: 'Comercial (700)' },
  { value: '690', label: 'Arquiteto (690)' },
  { value: '680', label: 'BDR (680)' },
  { value: '600', label: 'RH (600)' },
  { value: '200', label: 'Parceiro (200)' },
  { value: '1', label: 'Cliente (1)' },
];

// ============================================================================
// HELPERS
// ============================================================================

function StatusBadge({ active }: { active: boolean }) {
  return active
    ? <Badge className="bg-green-500/15 text-green-600 border-green-500/30 text-xs">Ativo</Badge>
    : <Badge variant="destructive" className="text-xs">Inativo</Badge>;
}

function LevelBadge({ level }: { level: number }) {
  const colorMap: Record<number, string> = {
    1000: 'bg-purple-500/15 text-purple-600 border-purple-500/30',
    950:  'bg-indigo-500/15 text-indigo-600 border-indigo-500/30',
    900:  'bg-blue-500/15 text-blue-600 border-blue-500/30',
    775:  'bg-cyan-500/15 text-cyan-600 border-cyan-500/30',
    750:  'bg-teal-500/15 text-teal-600 border-teal-500/30',
    700:  'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
    690:  'bg-lime-500/15 text-lime-700 border-lime-500/30',
    680:  'bg-yellow-500/15 text-yellow-700 border-yellow-500/30',
    600:  'bg-orange-500/15 text-orange-600 border-orange-500/30',
    200:  'bg-gray-500/15 text-gray-600 border-gray-500/30',
    1:    'bg-slate-500/15 text-slate-600 border-slate-500/30',
  };
  const cls = colorMap[level] || 'bg-muted text-muted-foreground';
  return (
    <Badge className={`text-xs font-mono ${cls}`}>
      {level} — {getLevelName(level)}
    </Badge>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function GestaoUsuarios() {
  const { profile: authProfile, roles: authRoles } = useAuth();
  const effectiveRoles = getEffectiveRoles(authRoles, authProfile);
  const isAdmin = checkIsAdmin(effectiveRoles);

  // Data
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // all | active | inactive

  // Confirm dialogs
  const [toggleActiveUser, setToggleActiveUser] = useState<UserProfile | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [levelFilter, statusFilter]);

  // ============================================================================
  // DATA FETCHING — 100% Supabase (sem openApi/Laravel)
  // ============================================================================

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      // 1) Build base query
      let query = supabase
        .from('profiles')
        .select('id, name, full_name, email, level, legacy_user_id, is_active, department, created_at', { count: 'exact' });

      // 2) Apply filters
      if (debouncedSearch.trim()) {
        const s = `%${debouncedSearch.trim()}%`;
        query = query.or(`name.ilike.${s},email.ilike.${s}`);
      }
      if (levelFilter !== 'all') {
        query = query.eq('level', Number(levelFilter));
      }
      if (statusFilter === 'active') {
        query = query.eq('is_active', true);
      } else if (statusFilter === 'inactive') {
        query = query.eq('is_active', false);
      }

      // 3) Pagination & order
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;
      query = query.order('name').range(from, to);

      const { data: profilesData, error: profilesError, count } = await query;

      if (profilesError) {
        console.error('[UsuariosPage] profiles error:', profilesError.message);
        toast.error('Erro ao carregar usuários');
        setUsers([]);
        setTotal(0);
        return;
      }

      if (!profilesData || profilesData.length === 0) {
        setUsers([]);
        setTotal(count ?? 0);
        return;
      }

      // 4) Fetch roles for this page's users
      const userIds = profilesData.map((p: any) => p.id);
      const { data: rolesData } = await (supabase as any)
        .from('user_roles')
        .select('user_id, role_slug')
        .in('user_id', userIds);

      // 5) Build a map: user_id → role slugs
      const rolesMap: Record<string, string[]> = {};
      (rolesData || []).forEach((r: any) => {
        if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
        rolesMap[r.user_id].push(r.role_slug);
      });

      // 6) Combine
      const combined: UserProfile[] = profilesData.map((p: any) => ({
        id: p.id,
        name: p.name || p.full_name || '—',
        full_name: p.full_name,
        email: p.email,
        level: p.level ?? 1,
        legacy_user_id: p.legacy_user_id,
        is_active: p.is_active ?? true,
        department: p.department,
        created_at: p.created_at,
        roles: rolesMap[p.id] || [],
      }));

      setUsers(combined);
      setTotal(count ?? 0);
    } catch (err) {
      console.error('[UsuariosPage] unexpected error:', err);
      toast.error('Erro inesperado ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }, [page, perPage, debouncedSearch, levelFilter, statusFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  async function handleToggleActive() {
    if (!toggleActiveUser) return;
    setActionLoading(true);
    const newStatus = !toggleActiveUser.is_active;
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: newStatus })
      .eq('id', toggleActiveUser.id);

    if (error) {
      toast.error('Erro ao alterar status: ' + error.message);
    } else {
      toast.success(`Usuário ${newStatus ? 'ativado' : 'desativado'} com sucesso`);
      fetchUsers();
    }
    setActionLoading(false);
    setToggleActiveUser(null);
  }

  // ============================================================================
  // PAGINATION
  // ============================================================================

  const lastPage = Math.max(1, Math.ceil(total / perPage));

  // ============================================================================
  // RENDER
  // ============================================================================

  const hasActiveFilters = debouncedSearch || levelFilter !== 'all' || statusFilter !== 'all';

  function clearFilters() {
    setSearch('');
    setLevelFilter('all');
    setStatusFilter('all');
    setPage(1);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestão de Usuários</h1>
            <p className="text-sm text-muted-foreground">
              {total > 0 ? `${total} usuário${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}` : 'Carregando...'}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            {/* Level filter */}
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-56">
                <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVEL_FILTER_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>

            {/* Per page */}
            <Select value={String(perPage)} onValueChange={v => { setPerPage(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PER_PAGE_OPTIONS.map(n => (
                  <SelectItem key={n} value={String(n)}>{n} / pág.</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                <X className="h-4 w-4 mr-1" /> Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
              <Users className="h-10 w-10 opacity-30" />
              <p className="text-sm">Nenhum usuário encontrado</p>
              {hasActiveFilters && (
                <Button variant="link" size="sm" onClick={clearFilters}>Limpar filtros</Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Nível</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(user => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{user.name}</p>
                          {user.legacy_user_id && (
                            <p className="text-xs text-muted-foreground font-mono">#{user.legacy_user_id}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <LevelBadge level={user.level} />
                      </TableCell>
                      <TableCell>
                        {user.roles.filter(r => r !== 'internal_user').length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {user.roles
                              .filter(r => r !== 'internal_user')
                              .slice(0, 2)
                              .map(r => (
                                <Badge key={r} variant="secondary" className="text-xs font-mono">
                                  {r}
                                </Badge>
                              ))}
                            {user.roles.filter(r => r !== 'internal_user').length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{user.roles.filter(r => r !== 'internal_user').length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">via level</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge active={user.is_active} />
                      </TableCell>
                      <TableCell className="text-right">
                        {isAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => window.location.href = `/modulos/admin/permissoes`}
                              >
                                <Shield className="h-4 w-4 mr-2" />
                                Gerenciar Permissões
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setToggleActiveUser(user)}
                                className={user.is_active ? 'text-destructive focus:text-destructive' : 'text-green-600 focus:text-green-600'}
                              >
                                {user.is_active
                                  ? <><UserX className="h-4 w-4 mr-2" /> Desativar usuário</>
                                  : <><UserCheck className="h-4 w-4 mr-2" /> Ativar usuário</>
                                }
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>

        {/* Pagination footer */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              Mostrando {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} de {total}
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(1)} disabled={page === 1}>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm px-3">{page} / {lastPage}</span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(p => p + 1)} disabled={page >= lastPage}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage(lastPage)} disabled={page >= lastPage}>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Confirm toggle active dialog */}
      <AlertDialog open={!!toggleActiveUser} onOpenChange={open => !open && setToggleActiveUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleActiveUser?.is_active ? 'Desativar usuário?' : 'Ativar usuário?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleActiveUser?.is_active
                ? `${toggleActiveUser?.name} perderá acesso ao sistema.`
                : `${toggleActiveUser?.name} voltará a ter acesso ao sistema.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleActive}
              disabled={actionLoading}
              className={toggleActiveUser?.is_active ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {toggleActiveUser?.is_active ? 'Desativar' : 'Ativar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
