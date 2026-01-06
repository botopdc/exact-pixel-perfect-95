import React from 'react';
import { Link } from 'react-router-dom';
import { partnerAuthService, referralsService, commissionsService } from '@/services/partnersService';
import { PARTNER_DISCOUNTS, PARTNER_TYPE_LABELS } from '@/types/partner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calculator,
  Users,
  TrendingUp,
  DollarSign,
  ArrowRight,
  Percent,
  FileText,
  CheckCircle2,
  Clock,
  Handshake,
} from 'lucide-react';

export default function DashboardParceiro() {
  const session = partnerAuthService.getSession();

  if (!session) return null;

  const discount = PARTNER_DISCOUNTS[session.tipo_parceria];
  const discountPercent = (discount * 100).toFixed(0);
  const isFinder = session.tipo_parceria === 'FINDER';

  // Get referral stats for FINDER
  const referralStats = isFinder ? referralsService.getStats(session.partnerId) : null;
  const commissions = isFinder ? commissionsService.getByPartnerId(session.partnerId) : [];
  const pendingCommission = commissions.reduce((sum, c) => {
    return sum + c.parcelas
      .filter(p => p.status_pagamento === 'Pendente')
      .reduce((s, p) => s + p.valor, 0);
  }, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Bem-vindo, {session.empresa}!
          </h1>
          <p className="text-muted-foreground">
            Portal exclusivo de parceiros OPEN Datacenter
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm px-3 py-1">
            <Handshake className="h-4 w-4 mr-1" />
            {PARTNER_TYPE_LABELS[session.tipo_parceria]}
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Discount Card */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Seu Desconto
            </CardTitle>
            <Percent className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {discount > 0 ? `${discountPercent}%` : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {discount > 0 ? 'Sobre toda price list' : 'Modelo de comissão'}
            </p>
          </CardContent>
        </Card>

        {/* Partner Type Info */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tipo de Parceria
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{session.tipo_parceria}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {session.tipo_parceria === 'ISV' && 'Independent Software Vendor'}
              {session.tipo_parceria === 'VAR' && 'Value Added Reseller'}
              {session.tipo_parceria === 'FINDER' && 'Indicador de Clientes'}
            </p>
          </CardContent>
        </Card>

        {/* FINDER: Referrals Stats */}
        {isFinder && referralStats && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Indicações
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{referralStats.total}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    {referralStats.fechado} fechadas
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {referralStats.proposta} em proposta
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Comissão Pendente
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-500">
                  {formatCurrency(pendingCommission)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Aguardando pagamento
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {/* Non-FINDER: Contract Status */}
        {!isFinder && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Contrato
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-500">Aceito</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Contrato de parceria ativo
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Status
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">Ativo</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Acesso completo ao portal
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Calculator Card */}
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
                <Calculator className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Calculadora de Preços</CardTitle>
                <CardDescription>
                  {discount > 0
                    ? `Com ${discountPercent}% de desconto automático`
                    : 'Price list OPEN Datacenter'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Monte propostas para seus clientes com preços exclusivos de parceiro.
              {discount > 0 && ' O desconto é aplicado automaticamente no valor final.'}
            </p>
            <Button asChild className="w-full">
              <Link to="/parceiro/calculadora">
                Abrir Calculadora
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* FINDER: Referrals Card */}
        {isFinder ? (
          <Card className="hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Users className="h-6 w-6 text-emerald-500" />
                </div>
                <div>
                  <CardTitle>Indicações</CardTitle>
                  <CardDescription>
                    Ganhe 100% do primeiro MRR
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Registre indicações de novos clientes e acompanhe suas comissões.
                Pagamento em 3 parcelas após recebimento pela OPEN.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/parceiro/indicacoes">
                  Ver Indicações
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <CardTitle>Benefícios {session.tipo_parceria}</CardTitle>
                  <CardDescription>
                    Vantagens exclusivas para parceiros
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2 mb-4">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  {discountPercent}% de desconto em toda price list
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Calculadora de preços exclusiva
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Suporte técnico prioritário
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Materiais de co-marketing
                </li>
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* FINDER: Recent Commissions */}
      {isFinder && commissions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Comissões Recentes</CardTitle>
            <CardDescription>
              Acompanhe o status dos seus pagamentos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {commissions.slice(0, 3).map((commission) => (
                <div
                  key={commission.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{commission.empresa_indicada}</p>
                    <p className="text-sm text-muted-foreground">
                      MRR: {formatCurrency(commission.mrr_primeira_parcela)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-emerald-500">
                      {formatCurrency(commission.comissao_total)}
                    </p>
                    <div className="flex gap-1 mt-1">
                      {commission.parcelas.map((p) => (
                        <Badge
                          key={p.numero}
                          variant={
                            p.status_pagamento === 'Pago'
                              ? 'default'
                              : p.status_pagamento === 'Bloqueado'
                              ? 'destructive'
                              : 'secondary'
                          }
                          className="text-xs"
                        >
                          {p.numero}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
