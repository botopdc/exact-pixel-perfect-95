import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileText, Loader2, FileSignature, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

import { useContract, useContractByProposalId, useCreateContract, useUpdateContractStatus } from '@/hooks/useContracts';
import {
  CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS,
  BILLING_CYCLE_OPTIONS, CONTRACT_DURATION_OPTIONS,
  type ContractStatus,
} from '@/types/contract';
import { formatCurrency } from '@/lib/calculatorConfig';
import { getProposal as getProposalFromEdge } from '@/services/proposalApi';
import { trackProposalEvent } from '@/services/proposalTrackingService';
import { ROUTES } from '@/config/routes';

export default function ContratoDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const proposalIdParam = searchParams.get('proposalId');
  const isViewing = !!id;

  // States
  const [proposalData, setProposalData] = useState<any>(null);
  const [loadingProposal, setLoadingProposal] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);

  // Editable fields for new contract
  const [contractDuration, setContractDuration] = useState<number>(12);
  const [billingCycle, setBillingCycle] = useState('mensal');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  // Queries
  const { data: existingContract, isLoading: isLoadingContract } = useContract(isViewing ? id : undefined);
  const { data: contractForProposal, isLoading: isCheckingDuplicate } = useContractByProposalId(proposalIdParam || undefined);
  const createContract = useCreateContract();
  const updateStatus = useUpdateContractStatus();

  // Load proposal data for new contract
  useEffect(() => {
    if (!proposalIdParam || isViewing) return;

    async function loadProposal() {
      setLoadingProposal(true);
      try {
        const res = await getProposalFromEdge(proposalIdParam!);
        if (!res?.success || !res.proposal) {
          setProposalError('Proposta não encontrada');
          return;
        }
        if (res.proposal.status !== 'Aprovado') {
          setProposalError('Apenas propostas com status "Aprovado" podem gerar contratos');
          return;
        }
        const p = {
          ...res.proposal,
          servers: res.servers || [],
          addons: res.addons || [],
        };
        setProposalData(p);
        setContractDuration(p.contract_duration || 12);
      } catch (err: any) {
        setProposalError(err.message || 'Erro ao carregar proposta');
      } finally {
        setLoadingProposal(false);
      }
    }
    loadProposal();
  }, [proposalIdParam, isViewing]);

  // Redirect if duplicate
  useEffect(() => {
    if (contractForProposal && !isViewing) {
      toast.info('Esta proposta já foi convertida em contrato');
      navigate(ROUTES.modulos.comercial.contractView(contractForProposal.id), { replace: true });
    }
  }, [contractForProposal, isViewing, navigate]);

  // Auto-calculate end date
  useEffect(() => {
    if (startDate && contractDuration) {
      const start = new Date(startDate);
      start.setMonth(start.getMonth() + contractDuration);
      setEndDate(start.toISOString().split('T')[0]);
    }
  }, [startDate, contractDuration]);

  // Handle generate contract
  const handleGenerate = async () => {
    if (!proposalData) return;

    try {
      const result = await createContract.mutateAsync({
        proposal_id: proposalData.id,
        proposal_uuid: proposalData.display_id || null,
        client_name: proposalData.name || '',
        company: proposalData.company || '',
        email: proposalData.email || '',
        phone: proposalData.phone || '',
        currency: proposalData.currency || 'BRL',
        subtotal: proposalData.total || 0,
        discount_amount: 0,
        total: proposalData.total || 0,
        datacenter: proposalData.datacenter || null,
        contract_duration: contractDuration,
        billing_cycle: billingCycle,
        start_date: startDate || null,
        end_date: endDate || null,
        due_at: proposalData.due_at || null,
        notes: notes || null,
        proposal_payload: {
          proposal: proposalData,
          servers: proposalData.servers || [],
          addons: proposalData.addons || [],
        },
      });

      trackProposalEvent({
        proposalId: proposalData.id,
        source: 'contract_generated',
      });

      navigate(ROUTES.modulos.comercial.contractView(result.id), { replace: true });
    } catch {
      // error handled by hook
    }
  };

  // Loading state
  if (isLoadingContract || loadingProposal || isCheckingDuplicate) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Error state
  if (proposalError) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(ROUTES.modulos.comercial.contracts)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{proposalError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  // ===== VIEW MODE: existing contract =====
  if (isViewing && existingContract) {
    const c = existingContract;
    const payload = c.proposal_payload as any;
    const servers = payload?.servers || [];
    const addons = payload?.addons || [];

    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(ROUTES.modulos.comercial.contracts)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Contrato {c.contract_number || c.id.substring(0, 8)}
            </h1>
          </div>
          <Badge className={CONTRACT_STATUS_COLORS[c.status as ContractStatus] || ''}>
            {CONTRACT_STATUS_LABELS[c.status as ContractStatus] || c.status}
          </Badge>
        </div>

        {/* Status actions */}
        {c.status === 'rascunho' && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateStatus.mutate({ id: c.id, status: 'pendente_assinatura' })}
              disabled={updateStatus.isPending}
            >
              Enviar para assinatura
            </Button>
          </div>
        )}
        {c.status === 'pendente_assinatura' && (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => updateStatus.mutate({ id: c.id, status: 'assinado' })}
              disabled={updateStatus.isPending}
            >
              Marcar como assinado
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => updateStatus.mutate({ id: c.id, status: 'cancelado' })}
              disabled={updateStatus.isPending}
            >
              Cancelar
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Dados do Cliente</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Nome:</span> {c.client_name}</div>
              <div><span className="text-muted-foreground">Empresa:</span> {c.company}</div>
              <div><span className="text-muted-foreground">Email:</span> {c.email}</div>
              <div><span className="text-muted-foreground">Telefone:</span> {c.phone || '—'}</div>
              {c.tax_id && <div><span className="text-muted-foreground">CNPJ/CPF:</span> {c.tax_id}</div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Condições</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Valor:</span> <span className="font-semibold">{formatCurrency(c.total)}</span></div>
              <div><span className="text-muted-foreground">Moeda:</span> {c.currency}</div>
              <div><span className="text-muted-foreground">Datacenter:</span> {c.datacenter || '—'}</div>
              <div><span className="text-muted-foreground">Duração:</span> {c.contract_duration ? `${c.contract_duration} meses` : '—'}</div>
              <div><span className="text-muted-foreground">Ciclo de cobrança:</span> {c.billing_cycle}</div>
              {c.start_date && <div><span className="text-muted-foreground">Início:</span> {new Date(c.start_date).toLocaleDateString('pt-BR')}</div>}
              {c.end_date && <div><span className="text-muted-foreground">Fim:</span> {new Date(c.end_date).toLocaleDateString('pt-BR')}</div>}
              <div><span className="text-muted-foreground">Gerado em:</span> {new Date(c.generated_from_proposal_at).toLocaleDateString('pt-BR')}</div>
            </CardContent>
          </Card>
        </div>

        {c.notes && (
          <Card>
            <CardHeader><CardTitle className="text-base">Observações</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{c.notes}</p></CardContent>
          </Card>
        )}

        {/* Servers from snapshot */}
        {servers.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Servidores (snapshot da proposta)</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-muted-foreground">Nome</th>
                      <th className="text-left py-2 px-3 text-muted-foreground">Tipo</th>
                      <th className="text-right py-2 px-3 text-muted-foreground">vCPU</th>
                      <th className="text-right py-2 px-3 text-muted-foreground">RAM</th>
                      <th className="text-right py-2 px-3 text-muted-foreground">Qtd</th>
                      <th className="text-right py-2 px-3 text-muted-foreground">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {servers.map((s: any, i: number) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 px-3">{s.name}</td>
                        <td className="py-2 px-3">{s.server_type || s.type}</td>
                        <td className="py-2 px-3 text-right">{s.vcpu}</td>
                        <td className="py-2 px-3 text-right">{s.ram_gb || s.ramGb} GB</td>
                        <td className="py-2 px-3 text-right">{s.qty_servers || s.qtyServers || 1}</td>
                        <td className="py-2 px-3 text-right font-medium">{formatCurrency(s.total_price || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Addons from snapshot */}
        {addons.filter((a: any) => a.enabled).length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Add-ons (snapshot da proposta)</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                {addons.filter((a: any) => a.enabled).map((a: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <span>{a.label} × {a.quantity}</span>
                    <span className="font-medium">{formatCurrency(a.total_price || 0)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ===== CREATE MODE: generate contract from proposal =====
  if (proposalData) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(ROUTES.modulos.comercial.contracts)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileSignature className="h-6 w-6 text-primary" />
              Gerar Contrato
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              A partir da proposta {proposalData.display_id || proposalData.id?.substring(0, 8)}
            </p>
          </div>
        </div>

        <Alert>
          <FileSignature className="h-4 w-4" />
          <AlertDescription>
            Ao gerar o contrato, um snapshot completo da proposta será salvo. O contrato será criado com status "Rascunho".
          </AlertDescription>
        </Alert>

        {/* Proposal summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Cliente</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Nome:</span> {proposalData.name}</div>
              <div><span className="text-muted-foreground">Empresa:</span> {proposalData.company}</div>
              <div><span className="text-muted-foreground">Email:</span> {proposalData.email}</div>
              <div><span className="text-muted-foreground">Telefone:</span> {proposalData.phone}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Condições da Proposta</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Valor total:</span> <span className="text-lg font-bold text-primary">{formatCurrency(proposalData.total)}</span></div>
              <div><span className="text-muted-foreground">Datacenter:</span> {proposalData.datacenter}</div>
              <div><span className="text-muted-foreground">Canal:</span> {proposalData.channel_type}</div>
              {proposalData.reseller_name && (
                <div><span className="text-muted-foreground">Parceiro:</span> {proposalData.reseller_name}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Editable contract fields */}
        <Card>
          <CardHeader><CardTitle className="text-base">Dados do Contrato</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duração do contrato</Label>
                <Select value={String(contractDuration)} onValueChange={(v) => setContractDuration(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_DURATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Ciclo de cobrança</Label>
                <Select value={billingCycle} onValueChange={setBillingCycle}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_CYCLE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data de início</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Data de término (auto-calculado)</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label>Observações do contrato</Label>
                <Textarea
                  placeholder="Observações adicionais para o contrato..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Servers */}
        {proposalData.servers?.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Servidores ({proposalData.servers.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-muted-foreground">Nome</th>
                      <th className="text-left py-2 px-3 text-muted-foreground">Tipo</th>
                      <th className="text-right py-2 px-3 text-muted-foreground">vCPU</th>
                      <th className="text-right py-2 px-3 text-muted-foreground">RAM</th>
                      <th className="text-right py-2 px-3 text-muted-foreground">Qtd</th>
                      <th className="text-right py-2 px-3 text-muted-foreground">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposalData.servers.map((s: any, i: number) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 px-3">{s.name}</td>
                        <td className="py-2 px-3">{s.server_type || s.type}</td>
                        <td className="py-2 px-3 text-right">{s.vcpu}</td>
                        <td className="py-2 px-3 text-right">{s.ram_gb || s.ramGb} GB</td>
                        <td className="py-2 px-3 text-right">{s.qty_servers || s.qtyServers || 1}</td>
                        <td className="py-2 px-3 text-right font-medium">{formatCurrency(s.total_price || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Addons */}
        {proposalData.addons?.filter((a: any) => a.enabled).length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Add-ons</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                {proposalData.addons.filter((a: any) => a.enabled).map((a: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <span>{a.label} × {a.quantity}</span>
                    <span className="font-medium">{formatCurrency(a.total_price || 0)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {proposalData.observations && (
          <Card>
            <CardHeader><CardTitle className="text-base">Observações da proposta</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">{proposalData.observations}</p></CardContent>
          </Card>
        )}

        <Separator />

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={() => navigate(ROUTES.modulos.comercial.contracts)}>
            Cancelar
          </Button>
          <Button
            size="lg"
            onClick={handleGenerate}
            disabled={createContract.isPending}
          >
            {createContract.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <FileSignature className="h-4 w-4 mr-2" />
            )}
            Gerar Contrato
          </Button>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="text-center py-12 text-muted-foreground">
      <p>Nenhuma proposta selecionada.</p>
      <Button variant="link" onClick={() => navigate(ROUTES.modulos.comercial.contracts)}>
        Voltar para contratos
      </Button>
    </div>
  );
}
