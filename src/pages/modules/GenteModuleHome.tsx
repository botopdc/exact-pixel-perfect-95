import React from 'react';
import { 
  Users, 
  Briefcase, 
  Building2, 
  Target, 
  Award,
  GraduationCap,
  Plus,
} from 'lucide-react';
import { ModuleHeader, KPICard, ShortcutCard, SectionTitle } from '@/components/navigation/ModuleCard';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { authService } from '@/services/authService';
import { USER_LEVELS } from '@/config/modulesConfig';

export default function GenteModuleHome() {
  const user = authService.getCurrentUser();
  const userLevel = user?.level ?? null;
  const isAdmin = userLevel === USER_LEVELS.ADMIN;

  return (
    <div className="space-y-8">
      <ModuleHeader
        title="Gente & Gestão"
        description="RH, vagas e estrutura organizacional"
        icon={Users}
        actions={
          <Link to="/modulos/gente/vagas">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Vaga
            </Button>
          </Link>
        }
      />

      {/* KPIs Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Colaboradores"
          value="48"
          description="Ativos na empresa"
          icon={Users}
          trend={{ value: 4, label: 'novos este mês', positive: true }}
        />
        <KPICard
          title="Vagas Abertas"
          value="5"
          description="Em processo seletivo"
          icon={Briefcase}
        />
        <KPICard
          title="Candidaturas"
          value="127"
          description="Recebidas este mês"
          icon={Award}
          trend={{ value: 32, label: 'vs mês anterior', positive: true }}
        />
        {isAdmin && (
          <KPICard
            title="Avaliações"
            value="12"
            description="Pendentes de revisão"
            icon={Target}
          />
        )}
      </div>

      {/* Quick Actions Section */}
      <div>
        <SectionTitle 
          title="Atalhos Rápidos" 
          description="Acesse rapidamente as funcionalidades"
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <ShortcutCard
            title="Vagas / RH"
            description="Gerenciar vagas e candidatos"
            icon={Briefcase}
            href="/modulos/gente/vagas"
          />
          {isAdmin && (
            <>
              <ShortcutCard
                title="Estrutura Organizacional"
                description="Organograma da empresa"
                icon={Building2}
                href="/modulos/gente/estrutura"
              />
              <ShortcutCard
                title="Metas Internas"
                description="Metas por área"
                icon={Target}
                href="/modulos/gente/metas"
              />
              <ShortcutCard
                title="Avaliações"
                description="Avaliações de desempenho"
                icon={Award}
                href="/modulos/gente/avaliacoes"
              />
            </>
          )}
          <ShortcutCard
            title="OPEN Academy"
            description="Treinamentos e cursos"
            icon={GraduationCap}
            href="/modulos/gente/academy"
          />
        </div>
      </div>

      {/* Open Positions */}
      <div>
        <SectionTitle 
          title="Vagas em Destaque" 
          description="Posições abertas atualmente"
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[
            { title: 'Engenheiro de Cloud', area: 'Infraestrutura', candidates: 23 },
            { title: 'Analista de Suporte N2', area: 'Suporte', candidates: 45 },
            { title: 'Desenvolvedor Full Stack', area: 'Tecnologia', candidates: 38 },
          ].map((job, index) => (
            <div key={index} className="p-4 rounded-lg border bg-card">
              <div className="flex items-start justify-between mb-2">
                <Briefcase className="h-5 w-5 text-primary" />
                <span className="text-xs text-muted-foreground">{job.candidates} candidatos</span>
              </div>
              <h3 className="font-medium mb-1">{job.title}</h3>
              <p className="text-sm text-muted-foreground">{job.area}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
