import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '@/services/authService';
import { supabase } from '@/integrations/supabase/client';
import logoWhite from '@/assets/logo-white.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { getRedirectByLevel } from '@/lib/rbac';

type AuthMode = 'supabase' | 'legacy';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if already logged in (either Supabase or legacy)
  useEffect(() => {
    // Check Supabase session first
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('level')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profile) {
          navigate(getRedirectByLevel(profile.level), { replace: true });
          return;
        }
      }

      // Fallback: check legacy session
      if (authService.isAuthenticated()) {
        const user = authService.getCurrentUser();
        if (user) {
          navigate(getRedirectByLevel(user.level), { replace: true });
        }
      }
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const normalizedEmail = email.toLowerCase().trim();

    try {
      // 1) Try Supabase Auth first
      const { data: supaData, error: supaError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (!supaError && supaData.user) {
        // Load profile to get level
        const { data: profile } = await supabase
          .from('profiles')
          .select('level, is_active')
          .eq('id', supaData.user.id)
          .maybeSingle();

        if (profile && !profile.is_active) {
          await supabase.auth.signOut();
          setError('Conta desativada. Contacte o administrador.');
          setIsLoading(false);
          return;
        }

        if (profile) {
          // Partners must use partner portal
          if (profile.level === 200) {
            await supabase.auth.signOut();
            setError('Área exclusiva para parceiros. Use o login do Portal do Parceiro.');
            setIsLoading(false);
            return;
          }

          if (import.meta.env.DEV) {
            console.log('[Login] Supabase Auth success:', {
              uid: supaData.user.id,
              email: normalizedEmail,
              level: profile.level,
            });
          }

          navigate(getRedirectByLevel(profile.level), { replace: true });
          setIsLoading(false);
          return;
        }

        // Profile not found — user exists in auth but not in profiles
        // This can happen for new signups without backfill
        if (import.meta.env.DEV) {
          console.warn('[Login] Supabase Auth OK but no profile. Falling back to legacy.');
        }
        await supabase.auth.signOut();
      }

      // 2) Fallback to legacy API auth
      if (import.meta.env.DEV) {
        console.log('[Login] Trying legacy auth for:', normalizedEmail);
      }

      const result = await authService.login(normalizedEmail, password);

      if (result.success && result.session) {
        navigate(getRedirectByLevel(result.session.level), { replace: true });
      } else {
        setError(result.error || 'Email ou senha incorretos');
      }
    } catch (err) {
      console.error('[Login] Unexpected error:', err);
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Background Pattern */}
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
            <span className="text-xs tracking-[0.35em] text-muted-foreground uppercase">Datacenter</span>
          </div>
        </div>

        {/* Login Card */}
        <div className="open-card">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-foreground mb-2">Bem-vindo</h1>
            <p className="text-sm text-muted-foreground">
              Faça login para acessar o painel administrativo
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm text-foreground">Email</Label>
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

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm text-foreground">Senha</Label>
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

            {/* Forgot Password Link */}
            <div className="text-right">
              <Link
                to="/reset-password"
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                Esqueceu sua senha?
              </Link>
            </div>

            {/* Submit Button */}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Entrando...</>
              ) : 'Entrar'}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} OPEN Datacenter. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
