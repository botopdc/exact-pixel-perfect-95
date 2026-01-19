import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { academyAuthService } from '@/services/academyAuthService';
import logoWhite from '@/assets/logo-white.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, Eye, EyeOff, GraduationCap, Clock } from 'lucide-react';

export default function AcademyLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    const session = academyAuthService.getSession();
    if (session) {
      navigate('/academy', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsPending(false);
    setIsLoading(true);

    try {
      const result = await academyAuthService.login(email, password);

      if (result.success && result.session) {
        navigate('/academy', { replace: true });
      } else {
        setError(result.error || 'Credenciais inválidas');
        setIsPending(result.pendingApproval || false);
      }
    } catch (err) {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

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

        {/* Login Card */}
        <div className="open-card">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold text-foreground">Portal do Aluno</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Acesse sua área exclusiva da OPEN Academy
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                isPending 
                  ? 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20' 
                  : 'bg-destructive/10 text-destructive'
              }`}>
                {isPending ? (
                  <Clock className="h-4 w-4 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                )}
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm text-foreground">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="bg-input border-border focus:border-primary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm text-foreground">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            <div className="text-right">
              <Link 
                to="/academy/reset-password" 
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                Esqueci minha senha
              </Link>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          <div className="mt-4 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Ainda não tem conta?{' '}
              <Link to="/academy/signup" className="text-primary hover:underline">
                Inscreva-se na Academy
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
