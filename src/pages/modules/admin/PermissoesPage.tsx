import React, { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, AlertTriangle, Search, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getLevelName } from '@/lib/rbac';
import { toast } from 'sonner';

interface Profile {
  id: string;
  name: string;
  email: string;
  level: number;
  legacy_user_id: number | null;
  is_active: boolean;
}

interface RoleRow {
  id: string;
  slug: string;
  name: string;
}

interface UserRoleRow {
  id: string;
  role_slug: string;
  role_name?: string; // resolved from join or lookup
}

export default function PermissoesPage() {
  const { profile: authProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [userRoles, setUserRoles] = useState<UserRoleRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [addRoleDialogOpen, setAddRoleDialogOpen] = useState(false);
  const [selectedRoleToAdd, setSelectedRoleToAdd] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('id, name, email, level, legacy_user_id, is_active').order('name'),
      (supabase as any).from('roles').select('id, slug, name').order('slug'),
    ]);
    setProfiles(profilesRes.data || []);
    setRoles(rolesRes.data || []);
    setLoading(false);
  }

  async function selectUser(p: Profile) {
    setSelectedProfile(p);
    const { data } = await (supabase as any)
      .from('user_roles')
      .select('id, role_slug')
      .eq('user_id', p.id);
    
    // Resolve role names from loaded roles
    const resolved: UserRoleRow[] = (data || []).map((ur: any) => {
      const role = roles.find(r => r.slug === ur.role_slug);
      return { id: ur.id, role_slug: ur.role_slug, role_name: role?.name || ur.role_slug };
    });
    setUserRoles(resolved);
  }

  async function addRole() {
    if (!selectedProfile || !selectedRoleToAdd) return;
    const { error } = await (supabase as any).from('user_roles').insert({
      user_id: selectedProfile.id,
      role_slug: selectedRoleToAdd,
    });
    if (error) {
      if (error.message.includes('duplicate')) {
        toast.error('Usuário já possui esta role');
      } else {
        toast.error(error.message);
      }
      return;
    }
    const role = roles.find(r => r.slug === selectedRoleToAdd);
    toast.success(`Role "${role?.name}" atribuída`);
    setAddRoleDialogOpen(false);
    setSelectedRoleToAdd('');
    selectUser(selectedProfile);
  }

  async function removeRole(ur: UserRoleRow) {
    if (!selectedProfile) return;
    const { error } = await (supabase as any).from('user_roles').delete().eq('id', ur.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Role "${ur.role_name}" removida`);
    selectUser(selectedProfile);
  }

  async function updateLevel(newLevel: number) {
    if (!selectedProfile) return;
    const oldLevel = selectedProfile.level;
    await supabase.from('profiles').update({ level: newLevel }).eq('id', selectedProfile.id);
    toast.success(`Level alterado de ${oldLevel} para ${newLevel}`);
    setSelectedProfile({ ...selectedProfile, level: newLevel });
    loadData();
  }

  const filteredProfiles = profiles.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.email.toLowerCase().includes(search.toLowerCase())
  );

  const assignedSlugs = userRoles.map(ur => ur.role_slug);
  const availableRoles = roles.filter(r => !assignedSlugs.includes(r.slug));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Permissões & Perfis</h1>
          <p className="text-sm text-muted-foreground">Gestão de roles e níveis de acesso dos usuários</p>
        </div>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>level</strong> é compatibilidade temporária; <strong>roles</strong> é o modelo novo de autorização.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Usuários</CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
            </div>
          </CardHeader>
          <CardContent className="max-h-[60vh] overflow-y-auto space-y-1 p-2">
            {loading ? (
              <p className="text-sm text-muted-foreground p-2">Carregando...</p>
            ) : (
              filteredProfiles.map(p => (
                <button
                  key={p.id}
                  onClick={() => selectUser(p)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedProfile?.id === p.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">{getLevelName(p.level)}</Badge>
                    {!p.is_active && <Badge variant="destructive" className="text-xs">Inativo</Badge>}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          {!selectedProfile ? (
            <CardContent className="flex items-center justify-center h-64 text-muted-foreground">
              <div className="text-center">
                <User className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p>Selecione um usuário para gerenciar permissões</p>
              </div>
            </CardContent>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="text-lg">{selectedProfile.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <p className="font-medium">{selectedProfile.email}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <p><Badge variant={selectedProfile.is_active ? 'default' : 'destructive'}>{selectedProfile.is_active ? 'Ativo' : 'Inativo'}</Badge></p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Legacy User ID:</span>
                    <p className="font-mono text-xs">{selectedProfile.legacy_user_id ?? '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Level atual:</span>
                    <div className="flex items-center gap-2">
                      <Select value={String(selectedProfile.level)} onValueChange={v => updateLevel(Number(v))}>
                        <SelectTrigger className="w-48 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 200, 600, 680, 690, 700, 750, 775, 900, 950, 1000].map(lv => (
                            <SelectItem key={lv} value={String(lv)}>{lv} — {getLevelName(lv)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm">Roles atribuídas</h3>
                    <Dialog open={addRoleDialogOpen} onOpenChange={setAddRoleDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" disabled={availableRoles.length === 0}>
                          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Role
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Adicionar Role</DialogTitle></DialogHeader>
                        <div className="space-y-4">
                          <Select value={selectedRoleToAdd} onValueChange={setSelectedRoleToAdd}>
                            <SelectTrigger><SelectValue placeholder="Selecionar role..." /></SelectTrigger>
                            <SelectContent>
                              {availableRoles.map(r => (
                                <SelectItem key={r.slug} value={r.slug}>{r.name} ({r.slug})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button onClick={addRole} disabled={!selectedRoleToAdd} className="w-full">Atribuir Role</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {userRoles.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Nenhuma role atribuída</p>
                  ) : (
                    <div className="space-y-2">
                      {userRoles.map(ur => (
                        <div key={ur.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                          <div>
                            <span className="font-medium text-sm">{ur.role_name}</span>
                            <span className="ml-2 text-xs text-muted-foreground font-mono">{ur.role_slug}</span>
                          </div>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeRole(ur)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
