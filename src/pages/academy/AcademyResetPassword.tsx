import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { academyAuthService } from '@/services/academyAuthService';
import logoWhite from '@/assets/logo-white.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, GraduationCap, CheckCircle2, ArrowLeft, Mail } from 'lucide-react';

export default function AcademyResetPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [lastSubmitTime, setLastSubmitTime] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Rate limiting: prevent multiple submissions within 30 seconds
    const now = Date.now();
    if (now - lastSubmitTime < 30000) {
      setError('Aguarde alguns segundos antes de tentar novamente.');
      return;
    }

    if (!email.trim()) {
      setError('Por favor, informe seu e-mail.');
      return;
    }

    setIsLoading(true);
    setLastSubmitTime(now);

    try {
      // Always show success to not expose if email exists
      await academyAuthService.requestPasswordReset(email.toLowerCase().trim());
      setSuccess(true);
    } catch {
      // Even on error, show success message for security
      setSuccess(true);
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
              Instruções Enviadas!
            </h2>
            <p className="text-muted-foreground mb-6">
              Se este e-mail estiver cadastrado, você receberá as instruções em instantes.
            </p>
            <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mb-6">
              <p className="text-sm text-yellow-600 dark:text-yellow-500">
                <strong>Nota:</strong> A redefinição de senha não libera acesso se seu cadastro ainda estiver pendente de aprovação.
              </p>
            </div>
            <Link to="/academy/login">
              <Button className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para o Login
              </Button>
            </Link>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            © {new Date().getFullYear()} OPEN Datacenter. Todos os direitos reservados.
          </p>
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

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src={logoWhite} alt="OPEN Datacenter" className="h-16 w-auto mb-4" />
          <div className="flex flex-col items-center">
            <span className="text-3xl font-bold tracking-wider text-foreground">OPEN</span>
            <span className="text-xs tracking-[0.35em] text-muted-foreground uppercase">Academy</span>
          </div>
        </div>

        {/* Reset Card */}
        <div className="open-card">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold text-foreground">Redefinir Senha</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Informe seu e-mail para receber as instruções
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm text-foreground">
                E-mail
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="bg-input border-border focus:border-primary pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Digite o e-mail cadastrado na OPEN Academy.
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar Instruções'
              )}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-border space-y-2">
            <p className="text-sm text-muted-foreground text-center">
              Lembrou a senha?{' '}
              <Link to="/academy/login" className="text-primary hover:underline">
                Fazer login
              </Link>
            </p>
            <p className="text-sm text-muted-foreground text-center">
              Não tem conta?{' '}
              <Link to="/academy/signup" className="text-primary hover:underline">
                Inscreva-se
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
