import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Eye, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { jobsService } from '@/services/jobsService';
import { Job, JobFormData, Department, Seniority, WorkModel, EmploymentType, JobStatus } from '@/types/job';
import { toast } from 'sonner';

const departments: Department[] = ['Comercial', 'TI', 'CS', 'Marketing', 'Adm/Fin', 'Operações'];
const seniorities: Seniority[] = ['Junior', 'Pleno', 'Senior', 'Especialista'];
const workModels: WorkModel[] = ['Presencial', 'Híbrido', 'Remoto'];
const employmentTypes: EmploymentType[] = ['CLT', 'PJ', 'Estágio'];

interface Props {
  isEdit?: boolean;
}

export default function JobForm({ isEdit = false }: Props) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<'pt' | 'en' | null>(null);
  const [benefitInput, setBenefitInput] = useState('');

  const [form, setForm] = useState<JobFormData>({
    titlePt: '',
    descriptionPt: '',
    functionPt: '',
    titleEn: '',
    descriptionEn: '',
    functionEn: '',
    slug: '',
    address: '',
    totalAmount: 1,
    applyUrl: '',
    department: 'TI',
    seniority: 'Pleno',
    workModel: 'Presencial',
    employmentType: 'CLT',
    salaryRange: '',
    benefits: [],
    status: 'draft',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isEdit && id) {
      loadJob();
    }
  }, [isEdit, id]);

  const loadJob = async () => {
    setLoading(true);
    try {
      const job = await jobsService.getById(id!);
      if (job) {
        setForm({
          titlePt: job.titlePt,
          descriptionPt: job.descriptionPt,
          functionPt: job.functionPt,
          titleEn: job.titleEn,
          descriptionEn: job.descriptionEn,
          functionEn: job.functionEn,
          slug: job.slug,
          address: job.address,
          totalAmount: job.totalAmount,
          applyUrl: job.applyUrl,
          department: job.department,
          seniority: job.seniority,
          workModel: job.workModel,
          employmentType: job.employmentType,
          salaryRange: job.salaryRange || '',
          benefits: job.benefits,
          status: job.status,
        });
      } else {
        toast.error('Vaga não encontrada');
        navigate('/modulos/gente/vagas');
      }
    } catch (error) {
      toast.error('Erro ao carregar vaga');
      navigate('/modulos/gente/vagas');
    } finally {
      setLoading(false);
    }
  };

  const updateField = <K extends keyof JobFormData>(field: K, value: JobFormData[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const generateSlugFromTitle = () => {
    if (form.titlePt && !form.slug) {
      updateField('slug', jobsService.generateSlug(form.titlePt));
    }
  };

  // Check slug uniqueness onBlur
  const checkSlugUniqueness = async () => {
    if (!form.slug.trim()) return;
    
    try {
      const isUnique = await jobsService.isSlugUnique(form.slug, isEdit ? id : undefined);
      if (!isUnique) {
        setErrors((prev) => ({ ...prev, slug: 'Este slug já está em uso' }));
      }
    } catch {
      // Ignore errors on slug check
    }
  };

  const addBenefit = () => {
    if (benefitInput.trim()) {
      updateField('benefits', [...form.benefits, benefitInput.trim()]);
      setBenefitInput('');
    }
  };

  const removeBenefit = (index: number) => {
    updateField('benefits', form.benefits.filter((_, i) => i !== index));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (form.titlePt.length < 6) {
      newErrors.titlePt = 'Título deve ter no mínimo 6 caracteres';
    }
    if (form.titleEn.length < 6) {
      newErrors.titleEn = 'Title must have at least 6 characters';
    }
    if (!form.descriptionPt.trim()) {
      newErrors.descriptionPt = 'Descrição é obrigatória';
    }
    if (!form.descriptionEn.trim()) {
      newErrors.descriptionEn = 'Description is required';
    }
    if (!form.slug.trim()) {
      newErrors.slug = 'Slug é obrigatório';
    }
    if (form.totalAmount <= 0) {
      newErrors.totalAmount = 'Quantidade deve ser maior que 0';
    }
    if (!form.applyUrl.trim()) {
      newErrors.applyUrl = 'URL de candidatura é obrigatória';
    } else {
      try {
        new URL(form.applyUrl);
      } catch {
        newErrors.applyUrl = 'URL inválida';
      }
    }
    if (!form.address.trim()) {
      newErrors.address = 'Endereço é obrigatório';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Parse API 422 validation errors
  const parseApiValidationErrors = (error: any): Record<string, string> => {
    const apiErrors: Record<string, string> = {};
    
    if (error?.response?.status === 422 && error?.response?.data?.errors) {
      const validationErrors = error.response.data.errors;
      
      // Map API field names to frontend field names
      const fieldMap: Record<string, string> = {
        title: 'titlePt',
        title_en: 'titleEn',
        description: 'descriptionPt',
        description_en: 'descriptionEn',
        role: 'functionPt',
        role_en: 'functionEn',
        slug: 'slug',
        quantity: 'totalAmount',
        address: 'address',
        subscription_url: 'applyUrl',
        department: 'department',
        seniority: 'seniority',
        work_regime: 'employmentType',
        contract_type: 'workModel',
        benefits: 'benefits',
        salary_range: 'salaryRange',
        status: 'status',
      };
      
      for (const [apiField, messages] of Object.entries(validationErrors)) {
        const frontendField = fieldMap[apiField] || apiField;
        const message = Array.isArray(messages) ? messages[0] : String(messages);
        apiErrors[frontendField] = message;
      }
    }
    
    return apiErrors;
  };

  const handleSave = async (status?: JobStatus) => {
    // Client-side validation first
    const isValid = validate();
    if (!isValid) {
      toast.error('Corrija os erros no formulário');
      return;
    }

    setSaving(true);
    try {
      const dataToSave = { ...form };
      if (status) {
        dataToSave.status = status;
      }

      if (isEdit && id) {
        // PUT /api/opdc-job/{id}
        await jobsService.update(id, dataToSave);
        toast.success('Vaga atualizada com sucesso');
      } else {
        // POST /api/opdc-job
        await jobsService.create(dataToSave);
        toast.success('Vaga criada com sucesso');
      }
      navigate('/modulos/gente/vagas');
    } catch (error: any) {
      // Handle 422 validation errors
      const apiErrors = parseApiValidationErrors(error);
      if (Object.keys(apiErrors).length > 0) {
        setErrors(apiErrors);
        toast.error('Corrija os erros de validação');
      } else {
        toast.error(error?.response?.data?.message || 'Erro ao salvar vaga');
      }
    } finally {
      setSaving(false);
    }
  };

  const renderMarkdown = (text: string) => {
    // Simple markdown rendering
    return text
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mt-6 mb-3">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>')
      .replace(/^\- (.*$)/gim, '<li class="ml-4">$1</li>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/\n\n/gim, '<br/><br/>');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/modulos/gente/vagas')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {isEdit ? 'Editar Vaga' : 'Nova Vaga'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isEdit ? 'Atualize as informações da vaga' : 'Preencha os dados para criar uma nova vaga'}
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Portuguese Content */}
        <div className="open-card space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary">PT</span>
            Conteúdo em Português
          </h3>

          <div className="space-y-2">
            <Label htmlFor="titlePt">Título *</Label>
            <Input
              id="titlePt"
              value={form.titlePt}
              onChange={(e) => updateField('titlePt', e.target.value)}
              onBlur={generateSlugFromTitle}
              placeholder="Ex: Engenheiro de Cloud Sênior"
              className={errors.titlePt ? 'border-destructive' : ''}
            />
            {errors.titlePt && <p className="text-xs text-destructive">{errors.titlePt}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="functionPt">Função *</Label>
            <Input
              id="functionPt"
              value={form.functionPt}
              onChange={(e) => updateField('functionPt', e.target.value)}
              placeholder="Ex: Engenharia de Cloud"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="descriptionPt">Descrição (Markdown) *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPreviewMode(previewMode === 'pt' ? null : 'pt')}
              >
                {previewMode === 'pt' ? <Edit3 className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                {previewMode === 'pt' ? 'Editar' : 'Preview'}
              </Button>
            </div>
            {previewMode === 'pt' ? (
              <div
                className="min-h-[200px] p-4 rounded-md border border-border bg-muted/30 prose prose-sm prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(form.descriptionPt) }}
              />
            ) : (
              <Textarea
                id="descriptionPt"
                value={form.descriptionPt}
                onChange={(e) => updateField('descriptionPt', e.target.value)}
                placeholder="Descrição da vaga em Markdown..."
                className={`min-h-[200px] ${errors.descriptionPt ? 'border-destructive' : ''}`}
              />
            )}
            {errors.descriptionPt && <p className="text-xs text-destructive">{errors.descriptionPt}</p>}
          </div>
        </div>

        {/* English Content */}
        <div className="open-card space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary">EN</span>
            English Content
          </h3>

          <div className="space-y-2">
            <Label htmlFor="titleEn">Title *</Label>
            <Input
              id="titleEn"
              value={form.titleEn}
              onChange={(e) => updateField('titleEn', e.target.value)}
              placeholder="Ex: Senior Cloud Engineer"
              className={errors.titleEn ? 'border-destructive' : ''}
            />
            {errors.titleEn && <p className="text-xs text-destructive">{errors.titleEn}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="functionEn">Function *</Label>
            <Input
              id="functionEn"
              value={form.functionEn}
              onChange={(e) => updateField('functionEn', e.target.value)}
              placeholder="Ex: Cloud Engineering"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="descriptionEn">Description (Markdown) *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPreviewMode(previewMode === 'en' ? null : 'en')}
              >
                {previewMode === 'en' ? <Edit3 className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                {previewMode === 'en' ? 'Edit' : 'Preview'}
              </Button>
            </div>
            {previewMode === 'en' ? (
              <div
                className="min-h-[200px] p-4 rounded-md border border-border bg-muted/30 prose prose-sm prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(form.descriptionEn) }}
              />
            ) : (
              <Textarea
                id="descriptionEn"
                value={form.descriptionEn}
                onChange={(e) => updateField('descriptionEn', e.target.value)}
                placeholder="Job description in Markdown..."
                className={`min-h-[200px] ${errors.descriptionEn ? 'border-destructive' : ''}`}
              />
            )}
            {errors.descriptionEn && <p className="text-xs text-destructive">{errors.descriptionEn}</p>}
          </div>
        </div>

        {/* Details */}
        <div className="open-card space-y-4">
          <h3 className="font-semibold text-foreground">Detalhes da Vaga</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => updateField('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                onBlur={checkSlugUniqueness}
                placeholder="engenheiro-cloud-senior"
                className={errors.slug ? 'border-destructive' : ''}
              />
              {errors.slug && <p className="text-xs text-destructive">{errors.slug}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalAmount">Quantidade de Vagas *</Label>
              <Input
                id="totalAmount"
                type="number"
                min="1"
                value={form.totalAmount}
                onChange={(e) => updateField('totalAmount', parseInt(e.target.value) || 1)}
                className={errors.totalAmount ? 'border-destructive' : ''}
              />
              {errors.totalAmount && <p className="text-xs text-destructive">{errors.totalAmount}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Endereço / Local *</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => updateField('address', e.target.value)}
              placeholder="Ex: São Paulo, SP"
              className={errors.address ? 'border-destructive' : ''}
            />
            {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="applyUrl">URL de Candidatura *</Label>
            <Input
              id="applyUrl"
              type="url"
              value={form.applyUrl}
              onChange={(e) => updateField('applyUrl', e.target.value)}
              placeholder="https://open.com.br/carreiras/apply/..."
              className={errors.applyUrl ? 'border-destructive' : ''}
            />
            {errors.applyUrl && <p className="text-xs text-destructive">{errors.applyUrl}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select value={form.department} onValueChange={(v) => updateField('department', v as Department)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Senioridade</Label>
              <Select value={form.seniority} onValueChange={(v) => updateField('seniority', v as Seniority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {seniorities.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Modelo de Trabalho</Label>
              <Select value={form.workModel} onValueChange={(v) => updateField('workModel', v as WorkModel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workModels.map((w) => (
                    <SelectItem key={w} value={w}>{w}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Contrato</Label>
              <Select value={form.employmentType} onValueChange={(v) => updateField('employmentType', v as EmploymentType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {employmentTypes.map((e) => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Optional Fields */}
        <div className="open-card space-y-4">
          <h3 className="font-semibold text-foreground">Informações Adicionais</h3>

          <div className="space-y-2">
            <Label htmlFor="salaryRange">Faixa Salarial (opcional)</Label>
            <Input
              id="salaryRange"
              value={form.salaryRange}
              onChange={(e) => updateField('salaryRange', e.target.value)}
              placeholder="Ex: R$ 10.000 - R$ 15.000"
            />
          </div>

          <div className="space-y-2">
            <Label>Benefícios</Label>
            <div className="flex gap-2">
              <Input
                value={benefitInput}
                onChange={(e) => setBenefitInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addBenefit())}
                placeholder="Digite e pressione Enter..."
              />
              <Button type="button" variant="outline" onClick={addBenefit}>
                Adicionar
              </Button>
            </div>
            {form.benefits.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.benefits.map((benefit, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => removeBenefit(index)}
                  >
                    {benefit} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => updateField('status', v as JobStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="published">Publicada</SelectItem>
                <SelectItem value="closed">Encerrada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <Button variant="destructive" onClick={() => navigate('/modulos/gente/vagas')}>
          Cancelar
        </Button>
        <Button variant="outline" onClick={() => handleSave('draft')} disabled={saving}>
          Salvar Rascunho
        </Button>
        <Button onClick={() => handleSave()} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
}
