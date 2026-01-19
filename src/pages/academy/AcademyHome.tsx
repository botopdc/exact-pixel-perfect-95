import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { academyAuthService } from '@/services/academyAuthService';
import { ACADEMY_LEVEL_LABELS } from '@/types/academy';
import logoWhite from '@/assets/logo-white.png';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  GraduationCap, 
  LogOut, 
  Percent, 
  Calendar, 
  Building2, 
  BookOpen,
  Server,
  Cloud,
  Database
} from 'lucide-react';

export default function AcademyHome() {
  const navigate = useNavigate();
  const session = academyAuthService.getSession();

  useEffect(() => {
    if (!session) {
      navigate('/academy/login', { replace: true });
    }
  }, [session, navigate]);

  if (!session) {
    return null;
  }

  const handleLogout = () => {
    academyAuthService.logout();
    navigate('/academy/login', { replace: true });
  };

  const enrollment = session.enrollment;
  const daysRemaining = enrollment?.valid_until 
    ? Math.ceil((new Date(enrollment.valid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={logoWhite} alt="OPEN Datacenter" className="h-10 w-auto" />
            <div>
              <span className="text-lg font-bold tracking-wider text-foreground">OPEN</span>
              <span className="text-xs tracking-[0.2em] text-muted-foreground uppercase ml-1">Academy</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-foreground">{session.name}</p>
              <p className="text-xs text-muted-foreground">{session.email}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Bem-vindo(a), {session.name.split(' ')[0]}!
              </h1>
              <p className="text-muted-foreground">
                Área exclusiva da OPEN Academy
              </p>
            </div>
          </div>
        </div>

        {/* Benefit Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Tipo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">
                {ACADEMY_LEVEL_LABELS[session.level]}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Seu Desconto
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold text-green-500">
                {enrollment?.discount_pct || 50}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Validade
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold">
                {enrollment?.valid_until 
                  ? new Date(enrollment.valid_until).toLocaleDateString('pt-BR')
                  : '—'}
              </p>
              {daysRemaining > 0 && daysRemaining <= 30 && (
                <Badge variant="outline" className="mt-1 text-yellow-600 border-yellow-500/20">
                  {daysRemaining} dias restantes
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Instituição
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold truncate">
                {enrollment?.institution_name || '—'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Services Section */}
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Serviços Disponíveis
        </h2>
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Server className="h-5 w-5 text-blue-500" />
                </div>
                Servidores Virtuais
              </CardTitle>
              <CardDescription>
                VMs com alta performance para seus projetos acadêmicos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary" className="text-green-600">
                {enrollment?.discount_pct || 50}% OFF
              </Badge>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Cloud className="h-5 w-5 text-purple-500" />
                </div>
                Cloud Storage
              </CardTitle>
              <CardDescription>
                Armazenamento seguro e escalável para seus dados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary" className="text-green-600">
                {enrollment?.discount_pct || 50}% OFF
              </Badge>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                  <Database className="h-5 w-5 text-orange-500" />
                </div>
                Banco de Dados
              </CardTitle>
              <CardDescription>
                Bancos gerenciados para aplicações e pesquisas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary" className="text-green-600">
                {enrollment?.discount_pct || 50}% OFF
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Info Box */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">
                  Benefícios OPEN Academy
                </h3>
                <p className="text-sm text-muted-foreground">
                  Como membro da OPEN Academy, você tem acesso a descontos exclusivos em todos os serviços 
                  de infraestrutura da OPEN Datacenter. Utilize seus créditos acadêmicos para desenvolver 
                  projetos, pesquisas e aprendizado prático em cloud computing.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-6">
        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} OPEN Datacenter. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
}
