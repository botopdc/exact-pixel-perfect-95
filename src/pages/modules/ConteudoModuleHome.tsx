import React from 'react';
import { 
  BookOpen, 
  FileText, 
  FolderOpen, 
  Search, 
  BookMarked,
  Plus,
} from 'lucide-react';
import { ModuleHeader, KPICard, ShortcutCard, SectionTitle } from '@/components/navigation/ModuleCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';

export default function ConteudoModuleHome() {
  return (
    <div className="space-y-8">
      <ModuleHeader
        title="Conteúdo & Documentação"
        description="Artigos, procedimentos e base de conhecimento"
        icon={BookOpen}
        actions={
          <Link to="/modulos/conteudo/artigos">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Artigo
            </Button>
          </Link>
        }
      />

      {/* Global Search */}
      <div className="max-w-2xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar em toda a documentação..." 
            className="pl-10 h-12"
          />
        </div>
      </div>

      {/* KPIs Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Artigos Publicados"
          value="124"
          description="Documentos ativos"
          icon={FileText}
        />
        <KPICard
          title="Visualizações"
          value="2.450"
          description="Este mês"
          icon={BookOpen}
          trend={{ value: 18, label: 'vs mês anterior', positive: true }}
        />
        <KPICard
          title="Procedimentos"
          value="45"
          description="Documentados"
          icon={FolderOpen}
        />
        <KPICard
          title="Em Revisão"
          value="8"
          description="Aguardando aprovação"
          icon={BookMarked}
        />
      </div>

      {/* Quick Access Cards */}
      <div>
        <SectionTitle 
          title="Acesso Rápido" 
          description="Navegue pelas seções de documentação"
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <ShortcutCard
            title="Artigos"
            description="Artigos e tutoriais"
            icon={FileText}
            href="/modulos/conteudo/artigos"
          />
          <ShortcutCard
            title="Procedimentos"
            description="Processos documentados"
            icon={FolderOpen}
            href="/modulos/conteudo/procedimentos"
          />
          <ShortcutCard
            title="Materiais Internos"
            description="Documentos da equipe"
            icon={BookMarked}
            href="/modulos/conteudo/materiais"
          />
          <ShortcutCard
            title="Base de Conhecimento"
            description="FAQ e soluções"
            icon={BookOpen}
            href="/modulos/conteudo/base"
          />
        </div>
      </div>

      {/* Recent Articles */}
      <div>
        <SectionTitle 
          title="Artigos Recentes" 
          description="Últimas publicações e atualizações"
        />
        <div className="space-y-3">
          {[
            { title: 'Como configurar VPN Site-to-Site', category: 'Infraestrutura', date: '2 dias atrás' },
            { title: 'Guia de Troubleshooting - Conectividade', category: 'Suporte', date: '3 dias atrás' },
            { title: 'Procedimento de Backup e Restore', category: 'Operações', date: '1 semana atrás' },
          ].map((article, index) => (
            <div key={index} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{article.title}</p>
                  <p className="text-sm text-muted-foreground">{article.category}</p>
                </div>
              </div>
              <span className="text-sm text-muted-foreground">{article.date}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
