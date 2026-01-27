import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, ChevronRight, FileText, Upload, Trash2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProposalById } from '@/hooks/useProposalSearch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

import { useContract, useContractByProposalId, useCreateContract, useUpdateContract } from '@/hooks/useContracts';
import {
  CONTRACT_DURATIONS,
  BILLING_DAYS,
  type Contract,
  type ContractFormData,
  type ContractDuration,
  type BillingDay,
  type ContractAttachment,
} from '@/types/contract';
import {
  isValidCPF,
  isValidCNPJ,
  formatCPF,
  formatCNPJ,
  formatCEP,
  fetchAddressByCEP,
} from '@/lib/validation';
import { toast } from 'sonner';

type WizardStep = 'contratante' | 'endereco';

const STEPS: { id: WizardStep; title: string }[] = [
  { id: 'contratante', title: 'Dados da Contratante' },
  { id: 'endereco', title: 'Endereço e Condições' },
];

export default function ContratoDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const proposalIdParam = searchParams.get('proposalId');
  const isEditing = !!id && id !== 'novo';

  // Estado do wizard
  const [currentStep, setCurrentStep] = useState<WizardStep>('contratante');
  const [formData, setFormData] = useState<ContractFormData>({
    company_name: '',
    no_cnpj: false,
    cnpj: '',
    responsible_name: '',
    cpf: '',
    cep: '',
    logradouro: '',
    bairro: '',
    cidade: '',
    uf: '',
    contract_duration: 12,
    billing_day: 10,
    date: format(new Date(), 'yyyy-MM-dd'),
    active: true,
  });
  const [attachments, setAttachments] = useState<ContractAttachment[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoadingCEP, setIsLoadingCEP] = useState(false);

  // Queries
  const { data: existingContract, isLoading: isLoadingContract } = useContract(isEditing ? id : undefined);
  const { data: existingContractForProposal } = useContractByProposalId(proposalIdParam || undefined);
  
  // Buscar proposta para pré-preencher dados (apenas quando criando novo contrato)
  const { data: proposalData } = useProposalById(
    proposalIdParam && !isEditing && !existingContractForProposal ? proposalIdParam : null
  );
  
  // Mutations
  const createContract = useCreateContract();
  const updateContract = useUpdateContract();

  // Verificar proposta e pré-preencher dados
  useEffect(() => {
    if (proposalData && !isEditing && !existingContractForProposal) {
      // Verificar se a proposta está aprovada
      if (proposalData.status !== 'Aprovado') {
        toast.error('Apenas propostas aprovadas podem gerar contratos');
        navigate('/modulos/comercial/propostas');
        return;
      }
      
      // Pré-preencher dados da proposta
      setFormData(prev => ({
        ...prev,
        company_name: proposalData.company || '',
        responsible_name: proposalData.contact_name || '',
      }));
    }
  }, [proposalData, isEditing, existingContractForProposal, navigate]);

  // Se já existe contrato para esta proposta, redirecionar
  useEffect(() => {
    if (existingContractForProposal && !isEditing) {
      toast.info('Já existe um contrato para esta proposta');
      navigate(`/modulos/comercial/contratos/${existingContractForProposal.id}`);
    }
  }, [existingContractForProposal, isEditing, navigate]);

  // Carregar contrato existente para edição
  useEffect(() => {
    if (existingContract) {
      setFormData({
        company_name: existingContract.company_name,
        no_cnpj: existingContract.no_cnpj,
        cnpj: existingContract.cnpj || '',
        responsible_name: existingContract.responsible_name,
        cpf: existingContract.cpf,
        cep: existingContract.address.cep,
        logradouro: existingContract.address.logradouro,
        bairro: existingContract.address.bairro,
        cidade: existingContract.address.cidade,
        uf: existingContract.address.uf,
        contract_duration: existingContract.contract_duration,
        billing_day: existingContract.billing_day,
        date: existingContract.date,
        active: existingContract.active,
      });
      setAttachments(existingContract.attachments || []);
    }
  }, [existingContract]);

  // Buscar endereço por CEP
  const handleCEPChange = async (value: string) => {
    const formatted = formatCEP(value);
    setFormData(prev => ({ ...prev, cep: formatted }));
    
    if (formatted.replace(/\D/g, '').length === 8) {
      setIsLoadingCEP(true);
      const address = await fetchAddressByCEP(formatted);
      setIsLoadingCEP(false);
      
      if (address) {
        setFormData(prev => ({
          ...prev,
          logradouro: address.logradouro,
          bairro: address.bairro,
          cidade: address.cidade,
          uf: address.uf,
        }));
      }
    }
  };

  // Validação do passo atual
  const validateStep = (step: WizardStep): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 'contratante') {
      if (!formData.company_name.trim()) {
        newErrors.company_name = 'Nome da empresa é obrigatório';
      }
      if (!formData.no_cnpj && !formData.cnpj.trim()) {
        newErrors.cnpj = 'CNPJ é obrigatório';
      }
      if (!formData.no_cnpj && formData.cnpj && !isValidCNPJ(formData.cnpj)) {
        newErrors.cnpj = 'CNPJ inválido';
      }
      if (!formData.responsible_name.trim()) {
        newErrors.responsible_name = 'Nome do responsável é obrigatório';
      }
      if (!formData.cpf.trim()) {
        newErrors.cpf = 'CPF é obrigatório';
      }
      if (formData.cpf && !isValidCPF(formData.cpf)) {
        newErrors.cpf = 'CPF inválido';
      }
    }

    if (step === 'endereco') {
      if (!formData.cep.trim()) {
        newErrors.cep = 'CEP é obrigatório';
      }
      if (!formData.logradouro.trim()) {
        newErrors.logradouro = 'Logradouro é obrigatório';
      }
      if (!formData.cidade.trim()) {
        newErrors.cidade = 'Cidade é obrigatória';
      }
      if (!formData.uf.trim()) {
        newErrors.uf = 'UF é obrigatória';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Navegação entre passos
  const handleNext = () => {
    if (validateStep(currentStep)) {
      const currentIndex = STEPS.findIndex(s => s.id === currentStep);
      if (currentIndex < STEPS.length - 1) {
        setCurrentStep(STEPS[currentIndex + 1].id);
      }
    }
  };

  const handleBack = () => {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].id);
    } else {
      navigate('/modulos/comercial/contratos');
    }
  };

  // Salvar contrato
  const handleSave = async () => {
    if (!validateStep('endereco')) return;

    const contractData: Omit<Contract, 'id' | 'created_at' | 'updated_at'> = {
      proposal_id: proposalIdParam || existingContract?.proposal_id || '',
      proposal_label: existingContract?.proposal_label,
      status: 'rascunho',
      company_name: formData.company_name,
      cnpj: formData.no_cnpj ? null : formData.cnpj,
      no_cnpj: formData.no_cnpj,
      responsible_name: formData.responsible_name,
      cpf: formData.cpf,
      address: {
        cep: formData.cep,
        logradouro: formData.logradouro,
        bairro: formData.bairro,
        cidade: formData.cidade,
        uf: formData.uf,
      },
      contract_duration: formData.contract_duration,
      billing_day: formData.billing_day,
      date: formData.date,
      active: formData.active,
      attachments,
    };

    try {
      if (isEditing && id) {
        await updateContract.mutateAsync({ id, data: contractData });
      } else {
        await createContract.mutateAsync(contractData);
      }
      navigate('/modulos/comercial/contratos');
    } catch (error) {
      // Erro já tratado pelo hook
    }
  };

  // Upload de anexos (apenas local por enquanto)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: ContractAttachment[] = Array.from(files).map(file => ({
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      addedAt: new Date().toISOString(),
    }));

    setAttachments(prev => [...prev, ...newAttachments]);
    toast.success(`${files.length} arquivo(s) adicionado(s)`);
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  if (isLoadingContract) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            {isEditing ? 'Editar Contrato' : 'Novo Contrato'}
          </h1>
          {proposalIdParam && (
            <p className="text-sm text-muted-foreground mt-1">
              Vinculado à proposta #{proposalIdParam}
            </p>
          )}
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((step, index) => (
          <React.Fragment key={step.id}>
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                index === currentStepIndex
                  ? 'bg-primary text-primary-foreground'
                  : index < currentStepIndex
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {index < currentStepIndex ? (
                <Check className="h-4 w-4" />
              ) : (
                <span className="font-medium">{index + 1}</span>
              )}
              <span className="text-sm font-medium">{step.title}</span>
            </div>
            {index < STEPS.length - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>{STEPS[currentStepIndex].title}</CardTitle>
          <CardDescription>
            {currentStep === 'contratante'
              ? 'Preencha os dados da empresa contratante'
              : 'Informe o endereço e condições do contrato'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentStep === 'contratante' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="company_name">Nome da Empresa *</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                  placeholder="Razão social da empresa"
                  className={errors.company_name ? 'border-destructive' : ''}
                />
                {errors.company_name && (
                  <p className="text-xs text-destructive">{errors.company_name}</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="no_cnpj"
                  checked={formData.no_cnpj}
                  onCheckedChange={(checked) =>
                    setFormData(prev => ({ ...prev, no_cnpj: checked === true, cnpj: '' }))
                  }
                />
                <Label htmlFor="no_cnpj" className="text-sm font-normal cursor-pointer">
                  Não tem CNPJ
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ {!formData.no_cnpj && '*'}</Label>
                <Input
                  id="cnpj"
                  value={formData.cnpj}
                  onChange={(e) => setFormData(prev => ({ ...prev, cnpj: formatCNPJ(e.target.value) }))}
                  placeholder="00.000.000/0000-00"
                  disabled={formData.no_cnpj}
                  className={errors.cnpj ? 'border-destructive' : ''}
                />
                {errors.cnpj && (
                  <p className="text-xs text-destructive">{errors.cnpj}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="responsible_name">Nome do Responsável *</Label>
                <Input
                  id="responsible_name"
                  value={formData.responsible_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, responsible_name: e.target.value }))}
                  placeholder="Nome completo do responsável"
                  className={errors.responsible_name ? 'border-destructive' : ''}
                />
                {errors.responsible_name && (
                  <p className="text-xs text-destructive">{errors.responsible_name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cpf">CPF *</Label>
                <Input
                  id="cpf"
                  value={formData.cpf}
                  onChange={(e) => setFormData(prev => ({ ...prev, cpf: formatCPF(e.target.value) }))}
                  placeholder="000.000.000-00"
                  className={errors.cpf ? 'border-destructive' : ''}
                />
                {errors.cpf && (
                  <p className="text-xs text-destructive">{errors.cpf}</p>
                )}
              </div>
            </>
          )}

          {currentStep === 'endereco' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cep">CEP *</Label>
                  <Input
                    id="cep"
                    value={formData.cep}
                    onChange={(e) => handleCEPChange(e.target.value)}
                    placeholder="00000-000"
                    className={errors.cep ? 'border-destructive' : ''}
                  />
                  {errors.cep && (
                    <p className="text-xs text-destructive">{errors.cep}</p>
                  )}
                </div>
                <div className="flex items-end">
                  {isLoadingCEP && (
                    <p className="text-sm text-muted-foreground">Buscando endereço...</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logradouro">Logradouro *</Label>
                <Input
                  id="logradouro"
                  value={formData.logradouro}
                  onChange={(e) => setFormData(prev => ({ ...prev, logradouro: e.target.value }))}
                  placeholder="Rua, Avenida, etc."
                  className={errors.logradouro ? 'border-destructive' : ''}
                />
                {errors.logradouro && (
                  <p className="text-xs text-destructive">{errors.logradouro}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bairro">Bairro</Label>
                <Input
                  id="bairro"
                  value={formData.bairro}
                  onChange={(e) => setFormData(prev => ({ ...prev, bairro: e.target.value }))}
                  placeholder="Bairro"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="cidade">Cidade *</Label>
                  <Input
                    id="cidade"
                    value={formData.cidade}
                    onChange={(e) => setFormData(prev => ({ ...prev, cidade: e.target.value }))}
                    placeholder="Cidade"
                    className={errors.cidade ? 'border-destructive' : ''}
                  />
                  {errors.cidade && (
                    <p className="text-xs text-destructive">{errors.cidade}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="uf">UF *</Label>
                  <Input
                    id="uf"
                    value={formData.uf}
                    onChange={(e) => setFormData(prev => ({ ...prev, uf: e.target.value.toUpperCase().slice(0, 2) }))}
                    placeholder="SP"
                    maxLength={2}
                    className={errors.uf ? 'border-destructive' : ''}
                  />
                  {errors.uf && (
                    <p className="text-xs text-destructive">{errors.uf}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="contract_duration">Prazo do Contrato *</Label>
                  <Select
                    value={formData.contract_duration.toString()}
                    onValueChange={(value) =>
                      setFormData(prev => ({ ...prev, contract_duration: Number(value) as ContractDuration }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTRACT_DURATIONS.map((duration) => (
                        <SelectItem key={duration} value={duration.toString()}>
                          {duration} meses
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="billing_day">Dia de Pagamento *</Label>
                  <Select
                    value={formData.billing_day.toString()}
                    onValueChange={(value) =>
                      setFormData(prev => ({ ...prev, billing_day: Number(value) as BillingDay }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BILLING_DAYS.map((day) => (
                        <SelectItem key={day} value={day.toString()}>
                          Dia {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Data do Contrato</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Checkbox
                      id="active"
                      checked={formData.active}
                      onCheckedChange={(checked) =>
                        setFormData(prev => ({ ...prev, active: checked === true }))
                      }
                    />
                    <Label htmlFor="active" className="font-normal cursor-pointer">
                      Contrato ativo
                    </Label>
                  </div>
                </div>
              </div>

              {/* Anexos */}
              <div className="space-y-2 pt-4 border-t">
                <Label>Anexos</Label>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Os anexos são salvos apenas localmente nesta fase. Na Fase 2, serão enviados ao servidor.
                  </AlertDescription>
                </Alert>
                
                <div className="flex items-center gap-2">
                  <Input
                    id="attachments"
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('attachments')?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Adicionar Anexo
                  </Button>
                </div>

                {attachments.length > 0 && (
                  <ul className="space-y-2 mt-2">
                    {attachments.map((att) => (
                      <li
                        key={att.id}
                        className="flex items-center justify-between p-2 bg-muted rounded-lg"
                      >
                        <span className="text-sm truncate">{att.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveAttachment(att.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack}>
          {currentStepIndex === 0 ? 'Cancelar' : 'Voltar'}
        </Button>
        
        {currentStepIndex < STEPS.length - 1 ? (
          <Button onClick={handleNext}>
            Próximo
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleSave}
            disabled={createContract.isPending || updateContract.isPending}
          >
            {createContract.isPending || updateContract.isPending ? 'Salvando...' : 'Salvar Contrato'}
          </Button>
        )}
      </div>
    </div>
  );
}
