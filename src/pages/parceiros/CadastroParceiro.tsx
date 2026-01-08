import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { openApi } from '@/lib/openApi';
import { PartnerType, PARTNER_TYPE_LABELS } from '@/types/partner';
import logoWhite from '@/assets/logo-white.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, AlertCircle, CheckCircle2, Building2, User, Mail, Phone, FileText } from 'lucide-react';

export default function CadastroParceiro() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    empresa: '',
    cnpj: '',
    responsavel: '',
    email: '',
    telefone: '',
    tipo_parceria: '' as PartnerType | '',
    senha: '',
    confirmarSenha: '',
  });

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 18);
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 10) {
      return numbers
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d)/, '$1-$2')
        .slice(0, 14);
    }
    return numbers
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .slice(0, 15);
  };

  const handleChange = (field: string, value: string) => {
    if (field === 'cnpj') {
      value = formatCNPJ(value);
    } else if (field === 'telefone') {
      value = formatPhone(value);
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.empresa.trim()) return 'Nome da empresa é obrigatório';
    if (!formData.cnpj.trim() || formData.cnpj.replace(/\D/g, '').length !== 14) return 'CNPJ inválido';
    if (!formData.responsavel.trim()) return 'Nome do responsável é obrigatório';
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return 'E-mail inválido';
    if (!formData.telefone.trim() || formData.telefone.replace(/\D/g, '').length < 10) return 'Telefone inválido';
    if (!formData.tipo_parceria) return 'Selecione o tipo de parceria';
    if (!formData.senha || formData.senha.length < 6) return 'Senha deve ter no mínimo 6 caracteres';
    if (formData.senha !== formData.confirmarSenha) return 'As senhas não conferem';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);

    try {
      // Criar parceiro via API
      await openApi.createPartner({
        name: formData.empresa.trim(),
        docnum: formData.cnpj.trim(),
        type: formData.tipo_parceria as 'ISV' | 'VAR' | 'FINDER',
        status: 'Pendente',
        responsible_name: formData.responsavel.trim(),
        responsible_email: formData.email.trim().toLowerCase(),
        responsible_phone: [formData.telefone.trim()],
        responsible_password: formData.senha,
        responsible_password_confirmation: formData.confirmarSenha,
      });

      setSuccess(true);
    } catch (err: any) {
      console.error('[CadastroParceiro] Erro:', err);
      
      // Tratar erros de validação da API
      if (err?.response?.status === 422) {
        const errors = err.response?.data?.errors;
        if (errors) {
          const firstError = Object.values(errors).flat()[0] as string;
          setError(firstError || 'Erro de validação');
          return;
        }
      }
      
      if (err?.response?.data?.message) {
        setError(err.response.data.message);
        return;
      }
      
      setError('Erro ao realizar cadastro. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-3xl" />
          <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-primary/5 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="relative w-full max-w-md text-center">
          <div className="flex justify-center mb-6">
            <div className="h-20 w-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-foreground mb-4">Cadastro Realizado!</h1>
          <p className="text-muted-foreground mb-6">
            Seu cadastro foi recebido com sucesso. Você receberá um e-mail quando sua conta for aprovada.
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            Após a aprovação, você precisará aceitar o contrato de parceria para ter acesso completo ao sistema.
          </p>

          <Button asChild className="w-full">
            <Link to="/parceiro/login">Ir para Login</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-primary/5 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <img src={logoWhite} alt="OPEN Datacenter" className="h-14 w-auto mb-3" />
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold tracking-wider text-foreground">OPEN</span>
            <span className="text-[10px] tracking-[0.35em] text-muted-foreground uppercase">Programa de Parceiros</span>
          </div>
        </div>

        {/* Form Card */}
        <div className="open-card">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-foreground mb-2">Cadastro de Parceiro</h1>
            <p className="text-sm text-muted-foreground">
              Preencha os dados para se tornar um parceiro OPEN Datacenter
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Empresa */}
            <div className="space-y-2">
              <Label htmlFor="empresa" className="text-sm text-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Nome da Empresa
              </Label>
              <Input
                id="empresa"
                placeholder="Razão Social"
                value={formData.empresa}
                onChange={(e) => handleChange('empresa', e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            {/* CNPJ */}
            <div className="space-y-2">
              <Label htmlFor="cnpj" className="text-sm text-foreground">
                CNPJ
              </Label>
              <Input
                id="cnpj"
                placeholder="00.000.000/0000-00"
                value={formData.cnpj}
                onChange={(e) => handleChange('cnpj', e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            {/* Responsável */}
            <div className="space-y-2">
              <Label htmlFor="responsavel" className="text-sm text-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                Nome do Responsável
              </Label>
              <Input
                id="responsavel"
                placeholder="Nome completo"
                value={formData.responsavel}
                onChange={(e) => handleChange('responsavel', e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm text-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="contato@empresa.com"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              {/* Telefone */}
              <div className="space-y-2">
                <Label htmlFor="telefone" className="text-sm text-foreground flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Telefone
                </Label>
                <Input
                  id="telefone"
                  placeholder="(00) 00000-0000"
                  value={formData.telefone}
                  onChange={(e) => handleChange('telefone', e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Tipo de Parceria */}
            <div className="space-y-2">
              <Label className="text-sm text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Tipo de Parceria
              </Label>
              <Select
                value={formData.tipo_parceria}
                onValueChange={(value) => handleChange('tipo_parceria', value)}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PARTNER_TYPE_LABELS) as PartnerType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {PARTNER_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {formData.tipo_parceria === 'ISV' && '15% de desconto na price list'}
                {formData.tipo_parceria === 'VAR' && '5% de desconto na price list'}
                {formData.tipo_parceria === 'FINDER' && 'Comissão de 100% do primeiro MRR por indicação'}
              </p>
            </div>

            {/* Senha */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="senha" className="text-sm text-foreground">
                  Senha
                </Label>
                <Input
                  id="senha"
                  type="password"
                  placeholder="••••••••"
                  value={formData.senha}
                  onChange={(e) => handleChange('senha', e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmarSenha" className="text-sm text-foreground">
                  Confirmar Senha
                </Label>
                <Input
                  id="confirmarSenha"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmarSenha}
                  onChange={(e) => handleChange('confirmarSenha', e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                'Cadastrar'
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Já é parceiro?{' '}
              <Link to="/parceiro/login" className="text-primary hover:underline">
                Faça login
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} OPEN Datacenter. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
