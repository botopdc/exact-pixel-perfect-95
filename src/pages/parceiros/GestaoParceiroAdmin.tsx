import React, { useState, useEffect } from 'react';
import { partnersService } from '@/services/partnersService';
import { Partner, PartnerStatus, PartnerType, PARTNER_TYPE_LABELS, PARTNER_DISCOUNTS } from '@/types/partner';
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
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  FileCheck,
  Edit,
  Trash2,
  RefreshCw,
  Building2,
  Mail,
  Phone,
  Calendar,
  Shield,
} from 'lucide-react';

export default function GestaoParceiroAdmin() {
  const { toast } = useToast();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [filteredPartners, setFilteredPartners] = useState<Partner[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Load partners
  const loadPartners = () => {
    const allPartners = partnersService.getAll();
    setPartners(allPartners);
    applyFilters(allPartners, searchTerm, statusFilter, typeFilter);
  };

  useEffect(() => {
    loadPartners();
  }, []);

  // Apply filters
  const applyFilters = (
    data: Partner[],
    search: string,
    status: string,
    type: string
  ) => {
    let filtered = [...data];

    if (search) {
      const term = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.empresa.toLowerCase().includes(term) ||
          p.cnpj.includes(term) ||
          p.responsavel.toLowerCase().includes(term) ||
          p.email.toLowerCase().includes(term)
      );
    }

    if (status !== 'all') {
      filtered = filtered.filter((p) => p.status === status);
    }

    if (type !== 'all') {
      filtered = filtered.filter((p) => p.tipo_parceria === type);
    }

    setFilteredPartners(filtered);
  };

  useEffect(() => {
    applyFilters(partners, searchTerm, statusFilter, typeFilter);
  }, [searchTerm, statusFilter, typeFilter, partners]);

  // Status badge
  const getStatusBadge = (status: PartnerStatus) => {
    const styles: Record<PartnerStatus, { className: string; icon: React.ReactNode }> = {
      Pendente: {
        className: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50',
        icon: <Clock className="h-3 w-3" />,
      },
      Ativo: {
        className: 'bg-green-500/20 text-green-500 border-green-500/50',
        icon: <CheckCircle className="h-3 w-3" />,
      },
      Inativo: {
        className: 'bg-red-500/20 text-red-500 border-red-500/50',
        icon: <XCircle className="h-3 w-3" />,
      },
    };
    const style = styles[status];
    return (
      <Badge className={`${style.className} flex items-center gap-1`}>
        {style.icon}
        {status}
      </Badge>
    );
  };

  // Partner type badge
  const getTypeBadge = (type: PartnerType) => {
    const discount = PARTNER_DISCOUNTS[type];
    const discountText = discount > 0 ? ` (-${(discount * 100).toFixed(0)}%)` : '';
    const colors: Record<PartnerType, string> = {
      ISV: 'bg-purple-500/20 text-purple-400 border-purple-500/50',
      VAR: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      FINDER: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
    };
    return (
      <Badge className={colors[type]}>
        {PARTNER_TYPE_LABELS[type]}{discountText}
      </Badge>
    );
  };

  // Contract status
  const getContractBadge = (partner: Partner) => {
    if (partner.contrato_aceito) {
      return (
        <Badge className="bg-green-500/20 text-green-500 border-green-500/50 flex items-center gap-1">
          <FileCheck className="h-3 w-3" />
          Aceito
        </Badge>
      );
    }
    return (
      <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/50">
        Pendente
      </Badge>
    );
  };

  // Actions
  const handleActivate = (partner: Partner) => {
    if (!partner.contrato_aceito) {
      toast({
        title: 'Contrato não aceito',
        description: 'O parceiro precisa aceitar o contrato antes de ser ativado.',
        variant: 'destructive',
      });
      return;
    }
    partnersService.update(partner.id, { status: 'Ativo' });
    loadPartners();
    toast({ title: 'Parceiro ativado com sucesso' });
  };

  const handleDeactivate = (partner: Partner) => {
    partnersService.update(partner.id, { status: 'Inativo' });
    loadPartners();
    toast({ title: 'Parceiro inativado' });
  };

  const handleDelete = (partner: Partner) => {
    if (confirm(`Deseja realmente excluir o parceiro ${partner.empresa}?`)) {
      partnersService.delete(partner.id);
      loadPartners();
      toast({ title: 'Parceiro excluído' });
    }
  };

  const handleEdit = (partner: Partner) => {
    setEditingPartner({ ...partner });
    setShowEditDialog(true);
  };

  const handleSaveEdit = () => {
    if (!editingPartner) return;
    partnersService.update(editingPartner.id, {
      tipo_parceria: editingPartner.tipo_parceria,
      status: editingPartner.status,
      empresa: editingPartner.empresa,
      responsavel: editingPartner.responsavel,
      email: editingPartner.email,
      telefone: editingPartner.telefone,
    });
    setShowEditDialog(false);
    setEditingPartner(null);
    loadPartners();
    toast({ title: 'Parceiro atualizado com sucesso' });
  };

  // Stats
  const stats = {
    total: partners.length,
    ativos: partners.filter((p) => p.status === 'Ativo').length,
    pendentes: partners.filter((p) => p.status === 'Pendente').length,
    inativos: partners.filter((p) => p.status === 'Inativo').length,
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Gestão de Parceiros
            </h1>
            <p className="text-muted-foreground">
              Administre cadastros, tipos e status dos parceiros
            </p>
          </div>
          <Button variant="outline" onClick={loadPartners}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
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
                <div className="h-10 w-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-500">{stats.pendentes}</p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
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
                  placeholder="Buscar por empresa, CNPJ, responsável ou email..."
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
                  <SelectItem value="Pendente">Pendente</SelectItem>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-40 bg-input border-border">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Tipos</SelectItem>
                  <SelectItem value="ISV">ISV</SelectItem>
                  <SelectItem value="VAR">VAR</SelectItem>
                  <SelectItem value="FINDER">FINDER</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Partners Table */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Parceiros ({filteredPartners.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredPartners.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum parceiro encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Contrato</TableHead>
                      <TableHead>Cadastro</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPartners.map((partner) => (
                      <TableRow key={partner.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{partner.empresa}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-sm">
                          {partner.cnpj}
                        </TableCell>
                        <TableCell>{partner.responsavel}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 text-xs">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Mail className="h-3 w-3" /> {partner.email}
                            </span>
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3 w-3" /> {partner.telefone}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getTypeBadge(partner.tipo_parceria)}</TableCell>
                        <TableCell>{getStatusBadge(partner.status)}</TableCell>
                        <TableCell>{getContractBadge(partner)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(partner.data_cadastro).toLocaleDateString('pt-BR')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(partner)}
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {partner.status === 'Pendente' && partner.contrato_aceito && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleActivate(partner)}
                                className="text-green-500 hover:text-green-400"
                                title="Ativar"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            {partner.status === 'Ativo' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeactivate(partner)}
                                className="text-red-500 hover:text-red-400"
                                title="Inativar"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                            {partner.status === 'Inativo' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleActivate(partner)}
                                className="text-green-500 hover:text-green-400"
                                title="Reativar"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(partner)}
                              className="text-red-500 hover:text-red-400"
                              title="Excluir"
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
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Editar Parceiro</DialogTitle>
            </DialogHeader>
            {editingPartner && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Empresa</label>
                  <Input
                    value={editingPartner.empresa}
                    onChange={(e) =>
                      setEditingPartner({ ...editingPartner, empresa: e.target.value })
                    }
                    className="bg-input border-border"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">Responsável</label>
                    <Input
                      value={editingPartner.responsavel}
                      onChange={(e) =>
                        setEditingPartner({ ...editingPartner, responsavel: e.target.value })
                      }
                      className="bg-input border-border"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">Telefone</label>
                    <Input
                      value={editingPartner.telefone}
                      onChange={(e) =>
                        setEditingPartner({ ...editingPartner, telefone: e.target.value })
                      }
                      className="bg-input border-border"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Email</label>
                  <Input
                    value={editingPartner.email}
                    onChange={(e) =>
                      setEditingPartner({ ...editingPartner, email: e.target.value })
                    }
                    className="bg-input border-border"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">
                      Tipo de Parceria
                    </label>
                    <Select
                      value={editingPartner.tipo_parceria}
                      onValueChange={(v) =>
                        setEditingPartner({
                          ...editingPartner,
                          tipo_parceria: v as PartnerType,
                        })
                      }
                    >
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ISV">ISV (-15%)</SelectItem>
                        <SelectItem value="VAR">VAR (-5%)</SelectItem>
                        <SelectItem value="FINDER">FINDER (sem desconto)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm text-muted-foreground mb-1">Status</label>
                    <Select
                      value={editingPartner.status}
                      onValueChange={(v) =>
                        setEditingPartner({
                          ...editingPartner,
                          status: v as PartnerStatus,
                        })
                      }
                    >
                      <SelectTrigger className="bg-input border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pendente">Pendente</SelectItem>
                        <SelectItem value="Ativo">Ativo</SelectItem>
                        <SelectItem value="Inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {editingPartner.contrato_aceito && editingPartner.data_hora_aceite && (
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p className="text-sm text-green-500 flex items-center gap-2">
                      <FileCheck className="h-4 w-4" />
                      Contrato aceito em{' '}
                      {new Date(editingPartner.data_hora_aceite).toLocaleString('pt-BR')}
                    </p>
                    {editingPartner.versao_contrato && (
                      <p className="text-xs text-green-500/70 mt-1">
                        Versão: {editingPartner.versao_contrato}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit}>Salvar Alterações</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
