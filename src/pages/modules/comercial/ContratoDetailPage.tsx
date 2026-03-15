import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileText, Loader2, FileSignature, AlertCircle, ChevronRight, ChevronLeft, Check, Download, FileDown, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { contractDocumentService } from '@/services/contractDocumentService';
import { ROUTES } from '@/config/routes';
import {
  isValidCPF, isValidCNPJ, isValidCEP,
  formatCPF, formatCNPJ, formatCEP,
  fetchAddressByCEP,
} from '@/lib/validation';

const BR_STATES = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
];

type FieldErrors = Record<string, string>;

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
  const [currentStep, setCurrentStep] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [fetchingCep, setFetchingCep] = useState(false);

  // Editable fields for new contract
  const [contractDuration, setContractDuration] = useState<number>(12);
  const [billingCycle, setBillingCycle] = useState('mensal');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  // Legal / address fields
  const [legalName, setLegalName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [hasNoCnpj, setHasNoCnpj] = useState(false);
  const [cnpj, setCnpj] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [responsibleCpf, setResponsibleCpf] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [street, setStreet] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [paymentDay, setPaymentDay] = useState<number | ''>('');
  const [contractDate, setContractDate] = useState('');
  const [generatingDoc, setGeneratingDoc] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [lastGenerationDebug, setLastGenerationDebug] = useState<any>(null);

  // Queries
  const { data: existingContract, isLoading: isLoadingContract } = useContract(isViewing ? id : undefined);
  const { data: contractForProposal, isLoading: isCheckingDuplicate } = useContractByProposalId(proposalIdParam || undefined);
  const createContract = useCreateContract();
  const updateStatus = useUpdateContractStatus();

  const steps = [
    { label: 'Dados Jurídicos', key: 'legal' },
    { label: 'Endereço', key: 'address' },
    { label: 'Termos do Contrato', key: 'terms' },
  ];

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
        const p = { ...res.proposal, servers: res.servers || [], addons: res.addons || [] };
        setProposalData(p);
        setContractDuration(p.contract_duration || 12);
        setCompanyName(p.company || '');
        setLegalName(p.company || '');
        setResponsibleName(p.name || '');
        setContractDate(new Date().toISOString().split('T')[0]);
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

  // CEP auto-fill
  const handleCepBlur = async () => {
    const cleaned = zipCode.replace(/\D/g, '');
    if (cleaned.length !== 8) return;
    setFetchingCep(true);
    try {
      const addr = await fetchAddressByCEP(cleaned);
      if (addr) {
        if (addr.logradouro) setStreet(addr.logradouro);
        if (addr.bairro) setNeighborhood(addr.bairro);
        if (addr.cidade) setCity(addr.cidade);
        if (addr.uf) setState(addr.uf);
      }
    } finally {
      setFetchingCep(false);
    }
  };

  // ---- VALIDATION ----
  const validateStep = (step: number): FieldErrors => {
    const errors: FieldErrors = {};

    if (step === 0) {
      if (!legalName.trim()) errors.legalName = 'Razão social é obrigatória';
      if (!hasNoCnpj) {
        if (!cnpj.trim()) {
          errors.cnpj = 'CNPJ é obrigatório (ou marque "Sem CNPJ")';
        } else if (!isValidCNPJ(cnpj)) {
          errors.cnpj = 'CNPJ inválido';
        }
      }
      if (!responsibleName.trim()) errors.responsibleName = 'Nome do responsável é obrigatório';
      if (!responsibleCpf.trim()) {
        errors.responsibleCpf = 'CPF do responsável é obrigatório';
      } else if (!isValidCPF(responsibleCpf)) {
        errors.responsibleCpf = 'CPF inválido';
      }
    }

    if (step === 1) {
      if (!zipCode.trim()) {
        errors.zipCode = 'CEP é obrigatório';
      } else if (!isValidCEP(zipCode)) {
        errors.zipCode = 'CEP inválido (8 dígitos)';
      }
      if (!street.trim()) errors.street = 'Logradouro é obrigatório';
      if (!city.trim()) errors.city = 'Cidade é obrigatória';
      if (!state) errors.state = 'UF é obrigatória';
    }

    if (step === 2) {
      if (!contractDate) errors.contractDate = 'Data do contrato é obrigatória';
      if (!paymentDay || Number(paymentDay) < 1 || Number(paymentDay) > 31) {
        errors.paymentDay = 'Dia de pagamento deve ser entre 1 e 31';
      }
      if (!startDate) errors.startDate = 'Data de início é obrigatória';
    }

    return errors;
  };

  const handleNext = () => {
    const errors = validateStep(currentStep);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error('Corrija os campos obrigatórios antes de avançar');
      return;
    }
    setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const handlePrev = () => {
    setFieldErrors({});
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  // ---- GENERATE ----
  const handleGenerate = async () => {
    // Validate all steps
    const allErrors: FieldErrors = {};
    for (let i = 0; i < steps.length; i++) {
      Object.assign(allErrors, validateStep(i));
    }
    setFieldErrors(allErrors);
    if (Object.keys(allErrors).length > 0) {
      toast.error('Existem campos inválidos. Revise todas as etapas.');
      return;
    }

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
        legal_name: legalName || null,
        company_name: companyName || null,
        has_no_cnpj: hasNoCnpj,
        cnpj: hasNoCnpj ? null : cnpj || null,
        responsible_name: responsibleName || null,
        responsible_cpf: responsibleCpf || null,
        zip_code: zipCode || null,
        street: street || null,
        neighborhood: neighborhood || null,
        city: city || null,
        state: state || null,
        payment_day: paymentDay ? Number(paymentDay) : null,
        contract_date: contractDate || null,
      });

      trackProposalEvent({
        proposalId: proposalData.id,
        source: 'contract_generated',
      });

      navigate(ROUTES.modulos.comercial.contractView(result.id), { replace: true });
    } catch (err: any) {
      console.error('Erro ao criar contrato:', err);
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

  // ===== VIEW MODE =====
  if (isViewing && existingContract) {
    const c = existingContract;
    const payload = c.proposal_payload as any;
    const servers = payload?.servers || [];
    const addons = payload?.addons || [];

    const handleGenerateDocument = async () => {
      setGeneratingDoc(true);
      setLastGenerationDebug(null);
      try {
        const result = await contractDocumentService.generate(c.id);
        console.log('[contract-ui] generation_response=', result);
        console.log('[contract-ui] documents_from_backend=', result?.documents);
        console.log('[contract-ui] annex_from_backend=', result?.documents?.find((d: any) => d.type === 'annex_pdf'));
        console.log('[contract-ui] debug_from_backend=', result?.debug);
        setLastGenerationDebug(result?.debug || result);

        if (result?.annex_generated) {
          toast.success('Documentos gerados com sucesso (DOCX + Anexo I)!');
        } else if (result?.contract_docx_generated) {
          toast.warning(`DOCX gerado, mas Anexo I não foi gerado: ${result?.annex_skip_reason || 'motivo desconhecido'}`);
        } else {
          toast.info('Geração concluída — verifique os documentos.');
        }
        // Refresh contract data
        window.location.reload();
      } catch (err: any) {
        console.error('[contract-ui] generation_error=', err);
        console.error('[contract-ui] generation_error_message=', err?.message);
        toast.error(err.message || 'Erro ao gerar documento');
      } finally {
        setGeneratingDoc(false);
      }
    };

    const handleDownloadFile = async (bucket: string, path: string, filename: string) => {
      setDownloadingFile(path);
      try {
        const url = await contractDocumentService.getFileUrl(bucket, path);
        if (!url) {
          toast.error('Arquivo não encontrado');
          return;
        }
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (err: any) {
        toast.error('Erro ao baixar arquivo');
      } finally {
        setDownloadingFile(null);
      }
    };

    const cAny = c as any;
    const hasDocx = !!cAny.docx_path;
    const hasAnnex = !!cAny.annex_pdf_path;
    const hasAnyDocument = hasDocx || hasAnnex;

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

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {(c.status === 'rascunho' || c.status === 'pendente_assinatura') && (
            <Button
              variant="default"
              size="sm"
              onClick={handleGenerateDocument}
              disabled={generatingDoc}
            >
              {generatingDoc ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : hasAnyDocument ? (
                <RefreshCw className="h-4 w-4 mr-2" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              {hasAnyDocument ? 'Regerar documentos' : 'Gerar documentos'}
            </Button>
          )}
          {c.status === 'rascunho' && (
            <Button variant="outline" size="sm"
              onClick={() => updateStatus.mutate({ id: c.id, status: 'pendente_assinatura' })}
              disabled={updateStatus.isPending}>
              Enviar para assinatura
            </Button>
          )}
          {c.status === 'pendente_assinatura' && (
            <>
              <Button size="sm"
                onClick={() => updateStatus.mutate({ id: c.id, status: 'assinado' })}
                disabled={updateStatus.isPending}>
                Marcar como assinado
              </Button>
              <Button variant="destructive" size="sm"
                onClick={() => updateStatus.mutate({ id: c.id, status: 'cancelado' })}
                disabled={updateStatus.isPending}>
                Cancelar
              </Button>
            </>
          )}
        </div>

        {/* Downloads card */}
        {hasAnyDocument && (
          <Card>
            <CardHeader><CardTitle className="text-base">📄 Documentos gerados</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {hasDocx && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                  disabled={downloadingFile === cAny.docx_path}
                  onClick={() => handleDownloadFile(
                    'contracts-generated',
                    cAny.docx_path,
                    `contrato-${c.contract_number || c.id.substring(0, 8)}.docx`
                  )}
                >
                  {downloadingFile === cAny.docx_path ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Contrato DOCX (modelo preenchido)
                </Button>
              )}
              {hasAnnex && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                  disabled={downloadingFile === cAny.annex_pdf_path}
                  onClick={() => handleDownloadFile(
                    'contracts-generated',
                    cAny.annex_pdf_path,
                    `anexo-i-${c.contract_number || c.id.substring(0, 8)}.pdf`
                  )}
                >
                  {downloadingFile === cAny.annex_pdf_path ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Anexo I — Resumo da Proposta (PDF)
                </Button>
              )}
              {!hasAnnex && !hasDocx && (
                <p className="text-sm text-muted-foreground">Nenhum documento gerado ainda.</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Estratégia: {cAny.generation_strategy || 'N/A'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Debug panel — diagnostic info */}
        {(lastGenerationDebug || cAny.generation_strategy) && (
          <Card className="border-dashed border-yellow-500/50">
            <CardHeader>
              <CardTitle className="text-base text-yellow-600 dark:text-yellow-400">
                🔍 Diagnóstico — Geração de Documentos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs font-mono">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="text-muted-foreground">source_pdf_path:</span>
                <span>{cAny.proposal_pdf_source_path || lastGenerationDebug?.source_pdf_path || 'null'}</span>
                <span className="text-muted-foreground">source_pdf_exists:</span>
                <span>{lastGenerationDebug?.source_pdf_exists !== undefined ? String(lastGenerationDebug.source_pdf_exists) : 'N/A'}</span>
                <span className="text-muted-foreground">source_pdf_page_count:</span>
                <span>{lastGenerationDebug?.source_pdf_page_count ?? 'N/A'}</span>
                <span className="text-muted-foreground">trimmed_pdf_page_count:</span>
                <span>{lastGenerationDebug?.trimmed_pdf_page_count ?? 'N/A'}</span>
                <span className="text-muted-foreground">annex_saved:</span>
                <span className={lastGenerationDebug?.annex_saved ? 'text-green-600' : 'text-red-500'}>
                  {lastGenerationDebug?.annex_saved !== undefined ? String(lastGenerationDebug.annex_saved) : 'N/A'}
                </span>
                <span className="text-muted-foreground">annex_pdf_path (DB):</span>
                <span>{cAny.annex_pdf_path || 'null'}</span>
                <span className="text-muted-foreground">docx_path (DB):</span>
                <span>{cAny.docx_path || 'null'}</span>
                <span className="text-muted-foreground">generation_strategy:</span>
                <span>{cAny.generation_strategy || 'N/A'}</span>
                <span className="text-muted-foreground">documents_count:</span>
                <span>{lastGenerationDebug?.documents_count ?? 'N/A'}</span>
              </div>
              {lastGenerationDebug?.annex_skip_reason && (
                <Alert variant="destructive" className="mt-2">
                  <AlertCircle className="h-3 w-3" />
                  <AlertDescription className="text-xs">
                    {lastGenerationDebug.annex_skip_reason}
                  </AlertDescription>
                </Alert>
              )}
              {!hasAnnex && !lastGenerationDebug?.annex_skip_reason && cAny.generation_strategy && (
                <p className="text-yellow-600 dark:text-yellow-400 mt-1">
                  ⚠️ Anexo I não aparece — provavelmente a proposta não possui PDF gerado (pdf_path=null).
                </p>
              )}
            </CardContent>
          </Card>
        )}


        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Dados do Cliente</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Nome:</span> {c.client_name}</div>
              <div><span className="text-muted-foreground">Empresa:</span> {c.company}</div>
              <div><span className="text-muted-foreground">Email:</span> {c.email}</div>
              <div><span className="text-muted-foreground">Telefone:</span> {c.phone || '—'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Condições</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">Valor:</span> <span className="font-semibold">{formatCurrency(c.total)}</span></div>
              <div><span className="text-muted-foreground">Moeda:</span> {c.currency}</div>
              <div><span className="text-muted-foreground">Datacenter:</span> {c.datacenter || '—'}</div>
              <div><span className="text-muted-foreground">Duração:</span> {c.contract_duration ? `${c.contract_duration} meses` : '—'}</div>
              <div><span className="text-muted-foreground">Ciclo:</span> {c.billing_cycle}</div>
              {c.start_date && <div><span className="text-muted-foreground">Início:</span> {new Date(c.start_date).toLocaleDateString('pt-BR')}</div>}
              {c.end_date && <div><span className="text-muted-foreground">Fim:</span> {new Date(c.end_date).toLocaleDateString('pt-BR')}</div>}
              <div><span className="text-muted-foreground">Gerado em:</span> {new Date(c.generated_from_proposal_at).toLocaleDateString('pt-BR')}</div>
            </CardContent>
          </Card>
        </div>

        {(c.legal_name || c.responsible_name || c.cnpj || c.street) && (
          <Card>
            <CardHeader><CardTitle className="text-base">Dados Jurídicos / Endereço</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {c.legal_name && <div><span className="text-muted-foreground">Razão social:</span> {c.legal_name}</div>}
              {c.company_name && <div><span className="text-muted-foreground">Nome fantasia:</span> {c.company_name}</div>}
              {c.has_no_cnpj ? (
                <div><span className="text-muted-foreground">CNPJ:</span> <span className="italic">Sem CNPJ</span></div>
              ) : c.cnpj ? (
                <div><span className="text-muted-foreground">CNPJ:</span> {c.cnpj}</div>
              ) : null}
              {c.responsible_name && <div><span className="text-muted-foreground">Responsável:</span> {c.responsible_name}</div>}
              {c.responsible_cpf && <div><span className="text-muted-foreground">CPF:</span> {c.responsible_cpf}</div>}
              {c.zip_code && <div><span className="text-muted-foreground">CEP:</span> {c.zip_code}</div>}
              {c.street && <div><span className="text-muted-foreground">Endereço:</span> {c.street}</div>}
              {c.neighborhood && <div><span className="text-muted-foreground">Bairro:</span> {c.neighborhood}</div>}
              {(c.city || c.state) && <div><span className="text-muted-foreground">Cidade/UF:</span> {[c.city, c.state].filter(Boolean).join(' / ')}</div>}
              {c.payment_day && <div><span className="text-muted-foreground">Dia pagamento:</span> {c.payment_day}</div>}
              {c.contract_date && <div><span className="text-muted-foreground">Data contrato:</span> {new Date(c.contract_date).toLocaleDateString('pt-BR')}</div>}
            </CardContent>
          </Card>
        )}

        {c.notes && (
          <Card>
            <CardHeader><CardTitle className="text-base">Observações</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{c.notes}</p></CardContent>
          </Card>
        )}

        {servers.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Servidores (snapshot)</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground">Nome</th>
                    <th className="text-left py-2 px-3 text-muted-foreground">Tipo</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">vCPU</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">RAM</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">Qtd</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">Valor</th>
                  </tr></thead>
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

        {addons.filter((a: any) => a.enabled).length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Add-ons (snapshot)</CardTitle></CardHeader>
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

  // ===== CREATE MODE =====
  if (!proposalData) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Nenhuma proposta selecionada.</p>
        <Button variant="link" onClick={() => navigate(ROUTES.modulos.comercial.contracts)}>
          Voltar para contratos
        </Button>
      </div>
    );
  }

  const FieldError = ({ name }: { name: string }) =>
    fieldErrors[name] ? <p className="text-sm text-destructive mt-1">{fieldErrors[name]}</p> : null;

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
          Preencha os dados em 3 etapas. O contrato será criado como "Rascunho".
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

      {/* Stepper */}
      <div className="flex items-center gap-2 justify-center">
        {steps.map((step, idx) => (
          <React.Fragment key={step.key}>
            <button
              onClick={() => {
                if (idx < currentStep) { setFieldErrors({}); setCurrentStep(idx); }
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                idx === currentStep
                  ? 'bg-primary text-primary-foreground'
                  : idx < currentStep
                    ? 'bg-primary/20 text-primary cursor-pointer'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {idx < currentStep ? <Check className="h-4 w-4" /> : <span className="w-5 h-5 rounded-full border flex items-center justify-center text-xs">{idx + 1}</span>}
              <span className="hidden sm:inline">{step.label}</span>
            </button>
            {idx < steps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 0: Legal */}
      {currentStep === 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Dados Jurídicos da Contratante</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Razão social *</Label>
                <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Razão social completa" />
                <FieldError name="legalName" />
              </div>
              <div className="space-y-1">
                <Label>Nome fantasia</Label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Nome fantasia" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label>CNPJ {!hasNoCnpj && '*'}</Label>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Checkbox id="hasNoCnpj" checked={hasNoCnpj} onCheckedChange={(v) => setHasNoCnpj(!!v)} />
                    <label htmlFor="hasNoCnpj" className="text-xs text-muted-foreground cursor-pointer">Sem CNPJ</label>
                  </div>
                </div>
                <Input
                  value={cnpj}
                  onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                  placeholder="00.000.000/0000-00"
                  disabled={hasNoCnpj}
                  maxLength={18}
                />
                <FieldError name="cnpj" />
              </div>
              <div className="space-y-1">
                <Label>Nome do responsável *</Label>
                <Input value={responsibleName} onChange={(e) => setResponsibleName(e.target.value)} placeholder="Nome completo" />
                <FieldError name="responsibleName" />
              </div>
              <div className="space-y-1">
                <Label>CPF do responsável *</Label>
                <Input
                  value={responsibleCpf}
                  onChange={(e) => setResponsibleCpf(formatCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
                <FieldError name="responsibleCpf" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Address */}
      {currentStep === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Endereço</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>CEP *</Label>
                <Input
                  value={zipCode}
                  onChange={(e) => setZipCode(formatCEP(e.target.value))}
                  onBlur={handleCepBlur}
                  placeholder="00000-000"
                  maxLength={9}
                />
                {fetchingCep && <p className="text-xs text-muted-foreground">Buscando endereço...</p>}
                <FieldError name="zipCode" />
              </div>
              <div className="md:col-span-2 space-y-1">
                <Label>Logradouro *</Label>
                <Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Rua, Av., número, complemento" />
                <FieldError name="street" />
              </div>
              <div className="space-y-1">
                <Label>Bairro</Label>
                <Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Bairro" />
              </div>
              <div className="space-y-1">
                <Label>Cidade *</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" />
                <FieldError name="city" />
              </div>
              <div className="space-y-1">
                <Label>UF *</Label>
                <Select value={state} onValueChange={setState}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {BR_STATES.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError name="state" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Terms */}
      {currentStep === 2 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Termos do Contrato</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Duração do contrato *</Label>
                <Select value={String(contractDuration)} onValueChange={(v) => setContractDuration(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONTRACT_DURATION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Ciclo de cobrança *</Label>
                <Select value={billingCycle} onValueChange={setBillingCycle}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BILLING_CYCLE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Data do contrato *</Label>
                <Input type="date" value={contractDate} onChange={(e) => setContractDate(e.target.value)} />
                <FieldError name="contractDate" />
              </div>
              <div className="space-y-1">
                <Label>Dia de pagamento *</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={paymentDay}
                  onChange={(e) => {
                    const v = e.target.value ? Number(e.target.value) : '';
                    setPaymentDay(v);
                  }}
                  placeholder="Ex: 10"
                />
                <FieldError name="paymentDay" />
              </div>
              <div className="space-y-1">
                <Label>Data de início *</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <FieldError name="startDate" />
              </div>
              <div className="space-y-1">
                <Label>Data de término (auto-calculado)</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="md:col-span-2 space-y-1">
                <Label>Observações do contrato</Label>
                <Textarea placeholder="Observações adicionais..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Servers & Addons (always visible) */}
      {proposalData.servers?.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Servidores ({proposalData.servers.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground">Nome</th>
                  <th className="text-left py-2 px-3 text-muted-foreground">Tipo</th>
                  <th className="text-right py-2 px-3 text-muted-foreground">vCPU</th>
                  <th className="text-right py-2 px-3 text-muted-foreground">RAM</th>
                  <th className="text-right py-2 px-3 text-muted-foreground">Qtd</th>
                  <th className="text-right py-2 px-3 text-muted-foreground">Valor</th>
                </tr></thead>
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

      <Separator />

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <div>
          {currentStep > 0 && (
            <Button variant="outline" onClick={handlePrev}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
          )}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate(ROUTES.modulos.comercial.contracts)}>
            Cancelar
          </Button>
          {currentStep < steps.length - 1 ? (
            <Button onClick={handleNext}>
              Próximo <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
