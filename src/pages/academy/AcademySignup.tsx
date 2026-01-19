import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { academyAuthService, AcademySignupData } from '@/services/academyAuthService';
import { ACADEMY_LEVELS, ACADEMY_LEVEL_LABELS, INSTITUTION_TYPES, AcademyLevel } from '@/types/academy';
import logoWhite from '@/assets/logo-white.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertCircle, Eye, EyeOff, GraduationCap, CheckCircle2 } from 'lucide-react';

export default function AcademySignup() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<AcademySignupData>({
    full_name: '',
    email: '',
    password: '',
    academy_level: ACADEMY_LEVELS.ALUNO,
    institution_name: '',
    institution_type: '',
    course_area: '',
    proof_url: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (field: keyof AcademySignupData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Validate password match
    if (formData.password !== confirmPassword) {
      setError('As senhas não coincidem.');
      setIsLoading(false);
      return;
    }

    // Validate password strength
    if (formData.password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      setIsLoading(false);
      return;
    }

    try {
      const result = await academyAuthService.signup(formData);

      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error || 'Erro ao criar conta.');
      }
    } catch (err) {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Success screen
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-3xl" />
          <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-primary/5 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="relative w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <img src={logoWhite} alt="OPEN Datacenter" className="h-16 w-auto mb-4" />
            <div className="flex flex-col items-center">
              <span className="text-3xl font-bold tracking-wider text-foreground">OPEN</span>
              <span className="text-xs tracking-[0.35em] text-muted-foreground uppercase">Academy</span>
            </div>
          </div>

          <div className="open-card text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              Inscrição Enviada!
            </h2>
            <p className="text-muted-foreground mb-6">
              Seu cadastro foi recebido com sucesso. Nossa equipe irá analisar sua inscrição e você receberá uma notificação assim que for aprovada.
            </p>
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mb-6">
              <p className="text-sm text-yellow-600">
                <strong>Importante:</strong> Você só poderá acessar a OPEN Academy após a aprovação do seu cadastro pela nossa equipe.
              </p>
            </div>
            <Button onClick={() => navigate('/academy/login')} className="w-full">
              Voltar para o Login
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            © {new Date().getFullYear()} OPEN Datacenter. Todos os direitos reservados.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 py-8">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-primary/5 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <img src={logoWhite} alt="OPEN Datacenter" className="h-14 w-auto mb-3" />
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold tracking-wider text-foreground">OPEN</span>
            <span className="text-xs tracking-[0.35em] text-muted-foreground uppercase">Academy</span>
          </div>
        </div>

        {/* Signup Card */}
        <div className="open-card">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold text-foreground">Inscrição</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Cadastre-se para obter benefícios acadêmicos
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Tipo de Beneficiário */}
            <div className="space-y-2">
              <Label className="text-sm text-foreground">Tipo de Beneficiário *</Label>
              <Select 
                value={formData.academy_level.toString()} 
                onValueChange={(value) => handleChange('academy_level', parseInt(value) as AcademyLevel)}
              >
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ACADEMY_LEVELS.ALUNO.toString()}>
                    {ACADEMY_LEVEL_LABELS[ACADEMY_LEVELS.ALUNO]}
                  </SelectItem>
                  <SelectItem value={ACADEMY_LEVELS.PROFESSOR.toString()}>
                    {ACADEMY_LEVEL_LABELS[ACADEMY_LEVELS.PROFESSOR]}
                  </SelectItem>
                  <SelectItem value={ACADEMY_LEVELS.INSTITUICAO.toString()}>
                    {ACADEMY_LEVEL_LABELS[ACADEMY_LEVELS.INSTITUICAO]}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Nome Completo */}
            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-sm text-foreground">
                Nome Completo *
              </Label>
              <Input
                id="full_name"
                type="text"
                placeholder="Seu nome completo"
                value={formData.full_name}
                onChange={(e) => handleChange('full_name', e.target.value)}
                required
                disabled={isLoading}
                className="bg-input border-border focus:border-primary"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm text-foreground">
                E-mail *
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.edu.br"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
                disabled={isLoading}
                className="bg-input border-border focus:border-primary"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm text-foreground">
                Senha *
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  required
                  disabled={isLoading}
                  className="bg-input border-border focus:border-primary pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm text-foreground">
                Confirmar Senha *
              </Label>
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
                className="bg-input border-border focus:border-primary"
              />
            </div>

            {/* Institution Type */}
            <div className="space-y-2">
              <Label className="text-sm text-foreground">Tipo de Instituição</Label>
              <Select 
                value={formData.institution_type || ''} 
                onValueChange={(value) => handleChange('institution_type', value)}
              >
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {INSTITUTION_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Institution Name */}
            <div className="space-y-2">
              <Label htmlFor="institution_name" className="text-sm text-foreground">
                Nome da Instituição
              </Label>
              <Input
                id="institution_name"
                type="text"
                placeholder="Ex: Universidade de São Paulo"
                value={formData.institution_name || ''}
                onChange={(e) => handleChange('institution_name', e.target.value)}
                disabled={isLoading}
                className="bg-input border-border focus:border-primary"
              />
            </div>

            {/* Course/Area */}
            <div className="space-y-2">
              <Label htmlFor="course_area" className="text-sm text-foreground">
                Curso / Área de Atuação
              </Label>
              <Input
                id="course_area"
                type="text"
                placeholder="Ex: Ciência da Computação"
                value={formData.course_area || ''}
                onChange={(e) => handleChange('course_area', e.target.value)}
                disabled={isLoading}
                className="bg-input border-border focus:border-primary"
              />
            </div>

            {/* Proof URL */}
            <div className="space-y-2">
              <Label htmlFor="proof_url" className="text-sm text-foreground">
                Link do Comprovante (opcional)
              </Label>
              <Input
                id="proof_url"
                type="url"
                placeholder="https://..."
                value={formData.proof_url || ''}
                onChange={(e) => handleChange('proof_url', e.target.value)}
                disabled={isLoading}
                className="bg-input border-border focus:border-primary"
              />
              <p className="text-xs text-muted-foreground">
                Carteirinha de estudante, declaração, etc.
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar Inscrição'
              )}
            </Button>
          </form>

          <div className="mt-4 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Já tem conta?{' '}
              <Link to="/academy/login" className="text-primary hover:underline">
                Fazer login
              </Link>
            </p>
            <p className="text-xs text-muted-foreground">
              <Link to="/login" className="hover:underline">
                Acesso administrativo →
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
