import React from 'react';
import { 
  LayoutDashboard, Cpu, Puzzle, Code, BookOpen, Terminal, History, Download,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DocsSearch } from '@/components/docs/DocsSearch';
import { DocsCard } from '@/components/docs/DocsCard';
import { DOCS_REGISTRY, getDocsByCategory } from '@/data/docs/registry';

const CATEGORY_CARDS = [
  { id: 'core', label: 'Arquitetura & Regras', icon: Cpu, description: 'Stack, schema, regras de negócio', link: '/modulos/docs/architecture' },
  { id: 'modules', label: 'Módulos', icon: Puzzle, description: 'Comercial, Parceiros, Atendimentos, Admin', link: '/modulos/docs/modules/comercial' },
  { id: 'api', label: 'API Reference', icon: Code, description: 'Endpoints, Edge Functions, autenticação', link: '/modulos/docs/api' },
  { id: 'playbooks', label: 'Playbooks', icon: BookOpen, description: 'Fluxos de propostas, contratos, migrações', link: '/modulos/docs/playbooks/proposal-flow' },
  { id: 'runbooks', label: 'Runbooks', icon: Terminal, description: 'Procedimentos operacionais (em breve)', disabled: true },
  { id: 'changelog', label: 'Changelog', icon: History, description: 'Histórico de alterações do sistema', link: '/modulos/docs/changelog' },
  { id: 'downloads', label: 'Downloads', icon: Download, description: 'Todos os documentos para download', link: '/modulos/docs/downloads' },
];

export default function DocsHome() {
  const recentDocs = DOCS_REGISTRY.slice(0, 6);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Documentação OPEN</h1>
        <p className="text-muted-foreground">
          Wiki oficial, base de conhecimento e referência técnica do sistema OPEN Datacenter.
        </p>
      </div>

      {/* Search */}
      <div className="max-w-xl">
        <DocsSearch />
      </div>

      {/* Category Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {CATEGORY_CARDS.map(cat => {
          const Icon = cat.icon;
          if (cat.disabled) {
            return (
              <div key={cat.id} className="flex flex-col p-4 rounded-lg border border-border bg-card/50 opacity-50">
                <Icon className="h-6 w-6 text-muted-foreground mb-3" />
                <h3 className="font-semibold text-foreground text-sm mb-1">{cat.label}</h3>
                <p className="text-xs text-muted-foreground">{cat.description}</p>
              </div>
            );
          }
          return (
            <Link
              key={cat.id}
              to={cat.link!}
              className="group flex flex-col p-4 rounded-lg border border-border bg-card hover:border-primary/40 transition-all"
            >
              <Icon className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-semibold text-foreground text-sm mb-1 group-hover:text-primary transition-colors">{cat.label}</h3>
              <p className="text-xs text-muted-foreground">{cat.description}</p>
            </Link>
          );
        })}
      </div>

      {/* Recent Docs */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Documentos Recentes</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recentDocs.map(doc => (
            <DocsCard key={doc.slug} doc={doc} />
          ))}
        </div>
      </div>
    </div>
  );
}
