import React, { useState, useEffect } from 'react';
import { commissionsService, partnersService, referralsService } from '@/services/partnersService';
import { Commission, PaymentStatus } from '@/types/partner';
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
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import {
  DollarSign,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  Building2,
  Users,
  RefreshCw,
  Ban,
  Unlock,
  Receipt,
  TrendingUp,
  AlertTriangle,
  Eye,
  CreditCard,
} from 'lucide-react';
import { formatCurrencyBRL } from '@/lib/calculatorConfig';

export default function GestaoComissoes() {
  const { toast } = useToast();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [filteredCommissions, setFilteredCommissions] = useState<Commission[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [receiptDate, setReceiptDate] = useState('');
  const [paymentProof, setPaymentProof] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [selectedInstallment, setSelectedInstallment] = useState<1 | 2 | 3>(1);

  // Load data
  const loadData = () => {
    const all = commissionsService.getAll();
    setCommissions(all);
    applyFilters(all, searchTerm, statusFilter);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Apply filters
  const applyFilters = (data: Commission[], search: string, status: string) => {
    let filtered = [...data];

    if (search) {
      const term = search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.parceiro_empresa?.toLowerCase().includes(term) ||
          c.empresa_indicada?.toLowerCase().includes(term)
      );
    }

    if (status !== 'all') {
      filtered = filtered.filter((c) => {
        if (status === 'pendente') return c.parcelas.some((p) => p.status_pagamento === 'Pendente');
        if (status === 'pago') return c.parcelas.every((p) => p.status_pagamento === 'Pago');
        if (status === 'bloqueado') return c.parcelas.some((p) => p.status_pagamento === 'Bloqueado');
        if (status === 'aguardando') return !c.data_primeiro_recebimento_open;
        return true;
      });
    }

    setFilteredCommissions(filtered);
  };

  useEffect(() => {
    applyFilters(commissions, searchTerm, statusFilter);
  }, [searchTerm, statusFilter, commissions]);

  // Stats
  const stats = commissionsService.getStats();
  const totalPago = commissions
    .flatMap((c) => c.parcelas)
    .filter((p) => p.status_pagamento === 'Pago')
    .reduce((sum, p) => sum + p.valor, 0);
  const totalPendente = commissions
    .flatMap((c) => c.parcelas)
    .filter((p) => p.status_pagamento === 'Pendente')
    .reduce((sum, p) => sum + p.valor, 0);

  // Status badge for installments
  const getInstallmentBadge = (status: PaymentStatus) => {
    const styles: Record<PaymentStatus, { className: string; icon: React.ReactNode }> = {
      Pendente: {
        className: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50',
        icon: <Clock className="h-3 w-3" />,
      },
      Pago: {
        className: 'bg-green-500/20 text-green-500 border-green-500/50',
        icon: <CheckCircle className="h-3 w-3" />,
      },
      Bloqueado: {
        className: 'bg-red-500/20 text-red-500 border-red-500/50',
        icon: <Ban className="h-3 w-3" />,
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

  // Commission status
  const getCommissionStatus = (commission: Commission) => {
    if (!commission.data_primeiro_recebimento_open) {
      return (
        <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/50 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Aguardando recebimento
        </Badge>
      );
    }
    const allPaid = commission.parcelas.every((p) => p.status_pagamento === 'Pago');
    const hasBlocked = commission.parcelas.some((p) => p.status_pagamento === 'Bloqueado');
    const paidCount = commission.parcelas.filter((p) => p.status_pagamento === 'Pago').length;

    if (allPaid) {
      return (
        <Badge className="bg-green-500/20 text-green-500 border-green-500/50 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Quitado
        </Badge>
      );
    }
    if (hasBlocked) {
      return (
        <Badge className="bg-red-500/20 text-red-500 border-red-500/50 flex items-center gap-1">
          <Ban className="h-3 w-3" />
          Bloqueio
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">
        {paidCount}/3 pagas
      </Badge>
    );
  };

  // Actions
  const handleSetReceiptDate = () => {
    if (!selectedCommission || !receiptDate) return;

    commissionsService.setFirstReceiptDate(selectedCommission.id, receiptDate);
    setShowReceiptDialog(false);
    setReceiptDate('');
    setSelectedCommission(null);
    loadData();
    toast({ title: 'Data de recebimento registrada!' });
  };

  const handlePayInstallment = () => {
    if (!selectedCommission) return;

    commissionsService.markInstallmentPaid(
      selectedCommission.id,
      selectedInstallment,
      paymentProof || undefined
    );
    setShowPayDialog(false);
    setPaymentProof('');
    setSelectedCommission(null);
    loadData();
    toast({ title: `Parcela ${selectedInstallment} marcada como paga!` });
  };

  const handleBlockInstallment = () => {
    if (!selectedCommission || !blockReason) return;

    commissionsService.blockInstallment(selectedCommission.id, selectedInstallment, blockReason);
    setShowBlockDialog(false);
    setBlockReason('');
    setSelectedCommission(null);
    loadData();
    toast({ title: `Parcela ${selectedInstallment} bloqueada` });
  };

  const handleUnblockInstallment = (commission: Commission, installmentNum: 1 | 2 | 3) => {
    commissionsService.unblockInstallment(commission.id, installmentNum);
    loadData();
    toast({ title: `Parcela ${installmentNum} desbloqueada` });
  };

  const openReceiptDialog = (commission: Commission) => {
    setSelectedCommission(commission);
    setShowReceiptDialog(true);
  };

  const openPayDialog = (commission: Commission, installmentNum: 1 | 2 | 3) => {
    setSelectedCommission(commission);
    setSelectedInstallment(installmentNum);
    setShowPayDialog(true);
  };

  const openBlockDialog = (commission: Commission, installmentNum: 1 | 2 | 3) => {
    setSelectedCommission(commission);
    setSelectedInstallment(installmentNum);
    setShowBlockDialog(true);
  };

  const openDetailsDialog = (commission: Commission) => {
    setSelectedCommission(commission);
    setShowDetailsDialog(true);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-primary" />
              Gestão de Comissões FINDER
            </h1>
            <p className="text-muted-foreground">
              Controle pagamentos e parcelas de comissões dos parceiros
            </p>
          </div>
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Receipt className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.totalComissoes}</p>
                  <p className="text-xs text-muted-foreground">Comissões</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-400">{formatCurrencyBRL(stats.valorTotal)}</p>
                  <p className="text-xs text-muted-foreground">Valor total</p>
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
                  <p className="text-lg font-bold text-green-500">{formatCurrencyBRL(totalPago)}</p>
                  <p className="text-xs text-muted-foreground">Pago ({stats.parcelasPagas})</p>
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
                  <p className="text-lg font-bold text-yellow-500">{formatCurrencyBRL(totalPendente)}</p>
                  <p className="text-xs text-muted-foreground">Pendente ({stats.parcelasPendentes})</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Ban className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-500">{stats.parcelasBloqueadas}</p>
                  <p className="text-xs text-muted-foreground">Bloqueadas</p>
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
                  placeholder="Buscar por parceiro ou empresa indicada..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-input border-border"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48 bg-input border-border">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="aguardando">Aguardando recebimento</SelectItem>
                  <SelectItem value="pendente">Com parcelas pendentes</SelectItem>
                  <SelectItem value="pago">Quitado</SelectItem>
                  <SelectItem value="bloqueado">Com bloqueio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Commissions List */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg">Comissões ({filteredCommissions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredCommissions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma comissão encontrada</p>
              </div>
            ) : (
              <Accordion type="single" collapsible className="space-y-2">
                {filteredCommissions.map((commission) => (
                  <AccordionItem
                    key={commission.id}
                    value={commission.id}
                    className="border border-border rounded-lg bg-muted/30 overflow-hidden"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 hover:no-underline">
                      <div className="flex flex-1 items-center justify-between gap-4 pr-4">
                        <div className="flex items-center gap-3">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <div className="text-left">
                            <p className="font-medium">{commission.empresa_indicada}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {commission.parceiro_empresa}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-semibold text-primary">
                              {formatCurrencyBRL(commission.comissao_total)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              MRR: {formatCurrencyBRL(commission.mrr_primeira_parcela)}
                            </p>
                          </div>
                          {getCommissionStatus(commission)}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-4">
                        {/* Info row */}
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Criado: {new Date(commission.data_criacao).toLocaleDateString('pt-BR')}
                          </span>
                          {commission.data_primeiro_recebimento_open && (
                            <span className="flex items-center gap-1">
                              <Receipt className="h-3 w-3" />
                              Recebido OPEN: {new Date(commission.data_primeiro_recebimento_open).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>

                        {/* Set receipt date button */}
                        {!commission.data_primeiro_recebimento_open && (
                          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-orange-400" />
                                <span className="text-sm text-orange-400">
                                  Aguardando confirmação do primeiro recebimento pela OPEN
                                </span>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => openReceiptDialog(commission)}
                              >
                                <Calendar className="h-4 w-4 mr-2" />
                                Registrar Recebimento
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Installments table */}
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Parcela</TableHead>
                              <TableHead>Valor</TableHead>
                              <TableHead>Vencimento</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Data Pgto</TableHead>
                              <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {commission.parcelas.map((parcela) => (
                              <TableRow key={parcela.numero}>
                                <TableCell className="font-medium">{parcela.numero}/3</TableCell>
                                <TableCell>{formatCurrencyBRL(parcela.valor)}</TableCell>
                                <TableCell>
                                  {parcela.vencimento
                                    ? new Date(parcela.vencimento).toLocaleDateString('pt-BR')
                                    : '-'}
                                </TableCell>
                                <TableCell>{getInstallmentBadge(parcela.status_pagamento)}</TableCell>
                                <TableCell>
                                  {parcela.data_pagamento
                                    ? new Date(parcela.data_pagamento).toLocaleDateString('pt-BR')
                                    : '-'}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center justify-end gap-1">
                                    {parcela.status_pagamento === 'Pendente' &&
                                      commission.data_primeiro_recebimento_open && (
                                        <>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => openPayDialog(commission, parcela.numero)}
                                            className="text-green-500 hover:text-green-400"
                                            title="Marcar como pago"
                                          >
                                            <CreditCard className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => openBlockDialog(commission, parcela.numero)}
                                            className="text-red-500 hover:text-red-400"
                                            title="Bloquear"
                                          >
                                            <Ban className="h-4 w-4" />
                                          </Button>
                                        </>
                                      )}
                                    {parcela.status_pagamento === 'Bloqueado' && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleUnblockInstallment(commission, parcela.numero)}
                                        className="text-blue-500 hover:text-blue-400"
                                        title="Desbloquear"
                                      >
                                        <Unlock className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>

                        {/* Blocked installment reason */}
                        {commission.parcelas.some((p) => p.status_pagamento === 'Bloqueado') && (
                          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                            <p className="text-sm font-medium text-red-400 mb-1">Motivos de bloqueio:</p>
                            {commission.parcelas
                              .filter((p) => p.status_pagamento === 'Bloqueado')
                              .map((p) => (
                                <p key={p.numero} className="text-sm text-muted-foreground">
                                  Parcela {p.numero}: {p.motivo_bloqueio || 'Sem motivo informado'}
                                </p>
                              ))}
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>

        {/* Receipt Date Dialog */}
        <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Registrar Recebimento pela OPEN</DialogTitle>
              <DialogDescription>
                Informe a data do primeiro recebimento do cliente. As parcelas serão calculadas
                para o dia 20 dos meses subsequentes.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                className="bg-input border-border"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReceiptDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSetReceiptDate} disabled={!receiptDate}>
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Pay Installment Dialog */}
        <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Marcar Parcela {selectedInstallment} como Paga</DialogTitle>
              <DialogDescription>
                Confirme o pagamento da parcela. Opcionalmente, informe o comprovante.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {selectedCommission && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <p className="text-sm">
                    <strong>Parceiro:</strong> {selectedCommission.parceiro_empresa}
                  </p>
                  <p className="text-sm">
                    <strong>Empresa:</strong> {selectedCommission.empresa_indicada}
                  </p>
                  <p className="text-sm">
                    <strong>Valor:</strong>{' '}
                    {formatCurrencyBRL(
                      selectedCommission.parcelas[selectedInstallment - 1]?.valor || 0
                    )}
                  </p>
                </div>
              )}
              <div>
                <label className="text-sm text-muted-foreground">
                  Comprovante (opcional)
                </label>
                <Input
                  value={paymentProof}
                  onChange={(e) => setPaymentProof(e.target.value)}
                  placeholder="Nº do comprovante ou observação"
                  className="bg-input border-border mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPayDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handlePayInstallment}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirmar Pagamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Block Installment Dialog */}
        <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Bloquear Parcela {selectedInstallment}</DialogTitle>
              <DialogDescription>
                Informe o motivo do bloqueio. A parcela ficará indisponível para pagamento.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <label className="text-sm text-muted-foreground">Motivo do bloqueio *</label>
              <Textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Ex: Pagamento do cliente não confirmado, inadimplência..."
                className="bg-input border-border mt-1"
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBlockDialog(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleBlockInstallment}
                disabled={!blockReason}
              >
                <Ban className="h-4 w-4 mr-2" />
                Bloquear Parcela
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
