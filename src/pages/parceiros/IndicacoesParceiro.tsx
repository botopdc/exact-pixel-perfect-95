import React, { useState, useEffect } from 'react';
import { partnerAuthService, referralsService, commissionsService } from '@/services/partnersService';
import { Referral, ReferralStatus, Commission } from '@/types/partner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  Plus,
  Search,
  Building2,
  Mail,
  Phone,
  Calendar,
  TrendingUp,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
  FileText,
  Edit,
  Trash2,
  Eye,
} from 'lucide-react';
import { formatCurrencyBRL } from '@/lib/calculatorConfig';

const REFERRAL_STATUS_OPTIONS: ReferralStatus[] = ['Novo', 'Em contato', 'Proposta', 'Fechado', 'Perdido'];

export default function IndicacoesParceiro() {
  const { toast } = useToast();
  const session = partnerAuthService.getSession();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCommissionDialog, setShowCommissionDialog] = useState(false);
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null);
  const [newReferral, setNewReferral] = useState({
    empresa_indicada: '',
    cnpj_indicado: '',
    contato_nome: '',
    contato_email: '',
    contato_telefone: '',
    observacoes: '',
  });

  // Load data
  const loadData = () => {
    if (session) {
      setReferrals(referralsService.getByPartnerId(session.partnerId));
      setCommissions(commissionsService.getByPartnerId(session.partnerId));
    }
  };

  useEffect(() => {
    loadData();
  }, [session?.partnerId]);

  if (!session || session.tipo_parceria !== 'FINDER') {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="bg-card border-border max-w-md">
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">
              O módulo de Indicações está disponível apenas para parceiros FINDER.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Filter referrals
  const filteredReferrals = referrals.filter((r) => {
    const matchesSearch =
      r.empresa_indicada.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.contato_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.contato_email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status_indicacao === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = referralsService.getStats(session.partnerId);
  const totalCommission = commissions.reduce((sum, c) => sum + c.comissao_total, 0);
  const paidCommission = commissions.reduce((sum, c) => {
    return sum + c.parcelas.filter(p => p.status_pagamento === 'Pago').reduce((s, p) => s + p.valor, 0);
  }, 0);

  // Status badge
  const getStatusBadge = (status: ReferralStatus) => {
    const styles: Record<ReferralStatus, { className: string; icon: React.ReactNode }> = {
      Novo: { className: 'bg-blue-500/20 text-blue-400 border-blue-500/50', icon: <Plus className="h-3 w-3" /> },
      'Em contato': { className: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50', icon: <MessageSquare className="h-3 w-3" /> },
      Proposta: { className: 'bg-purple-500/20 text-purple-400 border-purple-500/50', icon: <FileText className="h-3 w-3" /> },
      Fechado: { className: 'bg-green-500/20 text-green-500 border-green-500/50', icon: <CheckCircle className="h-3 w-3" /> },
      Perdido: { className: 'bg-red-500/20 text-red-500 border-red-500/50', icon: <XCircle className="h-3 w-3" /> },
    };
    const style = styles[status];
    return (
      <Badge className={`${style.className} flex items-center gap-1`}>
        {style.icon}
        {status}
      </Badge>
    );
  };

  // Create referral
  const handleCreate = () => {
    if (!newReferral.empresa_indicada || !newReferral.contato_nome || !newReferral.contato_email) {
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' });
      return;
    }

    referralsService.create({
      parceiro_id: session.partnerId,
      empresa_indicada: newReferral.empresa_indicada,
      cnpj_indicado: newReferral.cnpj_indicado || undefined,
      contato_nome: newReferral.contato_nome,
      contato_email: newReferral.contato_email,
      contato_telefone: newReferral.contato_telefone,
      observacoes: newReferral.observacoes || undefined,
      status_indicacao: 'Novo',
    });

    setShowNewDialog(false);
    setNewReferral({
      empresa_indicada: '',
      cnpj_indicado: '',
      contato_nome: '',
      contato_email: '',
      contato_telefone: '',
      observacoes: '',
    });
    loadData();
    toast({ title: 'Indicação registrada com sucesso!' });
  };

  // Edit referral
  const handleEdit = (referral: Referral) => {
    setSelectedReferral({ ...referral });
    setShowEditDialog(true);
  };

  const handleSaveEdit = () => {
    if (!selectedReferral) return;

    referralsService.update(selectedReferral.id, {
      empresa_indicada: selectedReferral.empresa_indicada,
      cnpj_indicado: selectedReferral.cnpj_indicado,
      contato_nome: selectedReferral.contato_nome,
      contato_email: selectedReferral.contato_email,
      contato_telefone: selectedReferral.contato_telefone,
      observacoes: selectedReferral.observacoes,
      status_indicacao: selectedReferral.status_indicacao,
      valor_mrr_fechado: selectedReferral.valor_mrr_fechado,
    });

    setShowEditDialog(false);
    setSelectedReferral(null);
    loadData();
    toast({ title: 'Indicação atualizada!' });
  };

  // View commission
  const handleViewCommission = (referral: Referral) => {
    const commission = commissionsService.getByReferralId(referral.id);
    if (commission) {
      setSelectedCommission(commission);
      setShowCommissionDialog(true);
    }
  };

  // Delete referral
  const handleDelete = (referral: Referral) => {
    if (referral.status_indicacao === 'Fechado') {
      toast({ title: 'Não é possível excluir indicações fechadas', variant: 'destructive' });
      return;
    }
    if (confirm(`Deseja excluir a indicação ${referral.empresa_indicada}?`)) {
      referralsService.delete(referral.id);
      loadData();
      toast({ title: 'Indicação excluída' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Minhas Indicações
          </h1>
          <p className="text-muted-foreground">
            Registre leads e acompanhe suas comissões
          </p>
        </div>
        <Button onClick={() => setShowNewDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Indicação
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-400" />
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
              <div className="h-10 w-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-500">{stats.emContato + stats.proposta}</p>
                <p className="text-xs text-muted-foreground">Em andamento</p>
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
                <p className="text-2xl font-bold text-green-500">{stats.fechado}</p>
                <p className="text-xs text-muted-foreground">Fechados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold text-primary">{formatCurrencyBRL(stats.mrrTotal)}</p>
                <p className="text-xs text-muted-foreground">MRR gerado</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-400">{formatCurrencyBRL(totalCommission)}</p>
                <p className="text-xs text-muted-foreground">Comissão total</p>
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
                placeholder="Buscar por empresa, contato ou email..."
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
                <SelectItem value="all">Todos</SelectItem>
                {REFERRAL_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Referrals Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Indicações ({filteredReferrals.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredReferrals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma indicação encontrada</p>
              <Button variant="outline" className="mt-4" onClick={() => setShowNewDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Registrar primeira indicação
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>MRR</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReferrals.map((referral) => (
                    <TableRow key={referral.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span className="font-medium">{referral.empresa_indicada}</span>
                            {referral.cnpj_indicado && (
                              <p className="text-xs text-muted-foreground font-mono">{referral.cnpj_indicado}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-sm">
                          <span>{referral.contato_nome}</span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" /> {referral.contato_email}
                          </span>
                          {referral.contato_telefone && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" /> {referral.contato_telefone}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(referral.status_indicacao)}</TableCell>
                      <TableCell>
                        {referral.valor_mrr_fechado ? (
                          <span className="font-medium text-green-500">
                            {formatCurrencyBRL(referral.valor_mrr_fechado)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(referral.data_cadastro).toLocaleDateString('pt-BR')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(referral)}
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {referral.status_indicacao === 'Fechado' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewCommission(referral)}
                              className="text-emerald-400"
                              title="Ver comissão"
                            >
                              <DollarSign className="h-4 w-4" />
                            </Button>
                          )}
                          {referral.status_indicacao !== 'Fechado' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(referral)}
                              className="text-red-500 hover:text-red-400"
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
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

      {/* New Referral Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Indicação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Empresa indicada *</label>
              <Input
                value={newReferral.empresa_indicada}
                onChange={(e) => setNewReferral({ ...newReferral, empresa_indicada: e.target.value })}
                placeholder="Nome da empresa"
                className="bg-input border-border"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">CNPJ</label>
              <Input
                value={newReferral.cnpj_indicado}
                onChange={(e) => setNewReferral({ ...newReferral, cnpj_indicado: e.target.value })}
                placeholder="00.000.000/0000-00"
                className="bg-input border-border"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Nome do contato *</label>
                <Input
                  value={newReferral.contato_nome}
                  onChange={(e) => setNewReferral({ ...newReferral, contato_nome: e.target.value })}
                  placeholder="Nome"
                  className="bg-input border-border"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Telefone</label>
                <Input
                  value={newReferral.contato_telefone}
                  onChange={(e) => setNewReferral({ ...newReferral, contato_telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                  className="bg-input border-border"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Email do contato *</label>
              <Input
                type="email"
                value={newReferral.contato_email}
                onChange={(e) => setNewReferral({ ...newReferral, contato_email: e.target.value })}
                placeholder="email@empresa.com"
                className="bg-input border-border"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Observações</label>
              <Textarea
                value={newReferral.observacoes}
                onChange={(e) => setNewReferral({ ...newReferral, observacoes: e.target.value })}
                placeholder="Informações adicionais sobre o lead..."
                className="bg-input border-border"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Registrar Indicação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Referral Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Indicação</DialogTitle>
          </DialogHeader>
          {selectedReferral && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Empresa indicada</label>
                <Input
                  value={selectedReferral.empresa_indicada}
                  onChange={(e) => setSelectedReferral({ ...selectedReferral, empresa_indicada: e.target.value })}
                  className="bg-input border-border"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Nome do contato</label>
                  <Input
                    value={selectedReferral.contato_nome}
                    onChange={(e) => setSelectedReferral({ ...selectedReferral, contato_nome: e.target.value })}
                    className="bg-input border-border"
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Telefone</label>
                  <Input
                    value={selectedReferral.contato_telefone}
                    onChange={(e) => setSelectedReferral({ ...selectedReferral, contato_telefone: e.target.value })}
                    className="bg-input border-border"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Email</label>
                <Input
                  value={selectedReferral.contato_email}
                  onChange={(e) => setSelectedReferral({ ...selectedReferral, contato_email: e.target.value })}
                  className="bg-input border-border"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Status</label>
                <Select
                  value={selectedReferral.status_indicacao}
                  onValueChange={(v) => setSelectedReferral({ ...selectedReferral, status_indicacao: v as ReferralStatus })}
                >
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REFERRAL_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedReferral.status_indicacao === 'Fechado' && (
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">MRR fechado (R$)</label>
                  <Input
                    type="number"
                    value={selectedReferral.valor_mrr_fechado || ''}
                    onChange={(e) => setSelectedReferral({ ...selectedReferral, valor_mrr_fechado: parseFloat(e.target.value) || 0 })}
                    placeholder="5000.00"
                    className="bg-input border-border"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Informe o MRR do primeiro mês completo. Sua comissão será 100% deste valor.
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Observações</label>
                <Textarea
                  value={selectedReferral.observacoes || ''}
                  onChange={(e) => setSelectedReferral({ ...selectedReferral, observacoes: e.target.value })}
                  className="bg-input border-border"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Commission Dialog */}
      <Dialog open={showCommissionDialog} onOpenChange={setShowCommissionDialog}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-400" />
              Detalhes da Comissão
            </DialogTitle>
          </DialogHeader>
          {selectedCommission && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">MRR do cliente</p>
                  <p className="text-lg font-bold">{formatCurrencyBRL(selectedCommission.mrr_primeira_parcela)}</p>
                </div>
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <p className="text-xs text-emerald-400">Sua comissão (100%)</p>
                  <p className="text-lg font-bold text-emerald-400">{formatCurrencyBRL(selectedCommission.comissao_total)}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Parcelas</p>
                <div className="space-y-2">
                  {selectedCommission.parcelas.map((parcela) => (
                    <div
                      key={parcela.numero}
                      className={`p-3 rounded-lg border flex items-center justify-between ${
                        parcela.status_pagamento === 'Pago'
                          ? 'bg-green-500/10 border-green-500/30'
                          : parcela.status_pagamento === 'Bloqueado'
                          ? 'bg-red-500/10 border-red-500/30'
                          : 'bg-muted/50 border-border'
                      }`}
                    >
                      <div>
                        <p className="font-medium">Parcela {parcela.numero}/3</p>
                        {parcela.vencimento ? (
                          <p className="text-xs text-muted-foreground">
                            Vencimento: {new Date(parcela.vencimento).toLocaleDateString('pt-BR')}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Aguardando recebimento pela OPEN
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrencyBRL(parcela.valor)}</p>
                        <Badge
                          className={
                            parcela.status_pagamento === 'Pago'
                              ? 'bg-green-500/20 text-green-500'
                              : parcela.status_pagamento === 'Bloqueado'
                              ? 'bg-red-500/20 text-red-500'
                              : 'bg-yellow-500/20 text-yellow-500'
                          }
                        >
                          {parcela.status_pagamento}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
                <p className="font-medium mb-1">Regras de pagamento:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Pagamento condicionado ao recebimento pela OPEN</li>
                  <li>Parcelas no dia 20 dos meses subsequentes</li>
                  <li>3 parcelas iguais de {formatCurrencyBRL(selectedCommission.comissao_total / 3)}</li>
                </ul>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCommissionDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
