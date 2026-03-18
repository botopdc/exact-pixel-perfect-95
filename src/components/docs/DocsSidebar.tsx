import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Cpu,
  Puzzle,
  Code,
  BookOpen,
  Terminal,
  History,
  Download,
  Settings,
  RefreshCw,
  ShieldCheck,
  BarChart3,
  FileText,
} from 'lucide-react';
import { DOC_CATEGORIES, getDocsByCategory, type DocCategory } from '@/data/docs/registry';
import { useAuth } from '@/contexts/AuthContext';

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  Cpu,
  Puzzle,
  Code,
  BookOpen,
  Terminal,
  History,
  Download,
};

const ADMIN_LINKS = [
  { to: '/modulos/docs/admin/sync', label: 'Sync Engine', icon: RefreshCw },
  { to: '/modulos/docs/admin/changelog', label: 'Changelog', icon: FileText },
  { to: '/modulos/docs/admin/coverage', label: 'Cobertura', icon: BarChart3 },
  { to: '/modulos/docs/admin/health', label: 'Saúde da Wiki', icon: ShieldCheck },
];

export function DocsSidebar() {
  const location = useLocation();
  const user = authService.getCurrentUser();
  const userLevel = user?.level ?? 0;
  // Admin area visible for levels >= 750 (Gerente, Admin, etc.)
  const showAdmin = userLevel >= 750;

  return (
    <nav className="w-64 shrink-0 border-r border-border bg-card/50 overflow-y-auto">
      <div className="p-4 space-y-6">
        {/* Home link */}
        <Link
          to="/modulos/docs"
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            location.pathname === '/modulos/docs'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          )}
        >
          <LayoutDashboard className="h-4 w-4" />
          Visão Geral
        </Link>

        {/* Categories */}
        {DOC_CATEGORIES.filter(c => c.id !== 'overview').map(cat => {
          const Icon = ICON_MAP[cat.icon] || BookOpen;
          const docs = getDocsByCategory(cat.id);
          if (docs.length === 0 && cat.id !== 'downloads' && cat.id !== 'runbooks') return null;

          return (
            <div key={cat.id} className="space-y-1">
              <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                {cat.label}
              </div>
              {cat.id === 'downloads' && (
                <Link
                  to="/modulos/docs/downloads"
                  className={cn(
                    'block px-3 py-1.5 pl-8 rounded text-sm transition-colors',
                    location.pathname === '/modulos/docs/downloads'
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  Todos os downloads
                </Link>
              )}
              {cat.id === 'runbooks' && docs.length === 0 && (
                <div className="px-3 py-1.5 pl-8 text-xs text-muted-foreground/60 italic">
                  Em breve
                </div>
              )}
              {docs.map(doc => {
                const docPath = `/modulos/docs/${doc.slug}`;
                const isActive = location.pathname === docPath;
                return (
                  <Link
                    key={doc.slug}
                    to={docPath}
                    className={cn(
                      'block px-3 py-1.5 pl-8 rounded text-sm transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    {doc.title}
                  </Link>
                );
              })}
            </div>
          );
        })}

        {/* Admin Section */}
        {showAdmin && (
          <div className="space-y-1 pt-2 border-t border-border">
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Settings className="h-3.5 w-3.5" />
              Admin
            </div>
            {ADMIN_LINKS.map(link => {
              const isActive = location.pathname === link.to;
              const LinkIcon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 pl-8 rounded text-sm transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}
