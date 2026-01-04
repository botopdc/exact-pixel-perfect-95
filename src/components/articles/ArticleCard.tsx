import { Link } from 'react-router-dom';
import { Article, ArticleCategory } from '@/types/article';
import { Badge } from '@/components/ui/badge';
import { Clock, User, Eye, Lock, Server, Cloud, Database, Shield, Mail, Monitor, Wrench, AlertTriangle, FileText, GraduationCap } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ArticleCardProps {
  article: Article;
}

const categoryIcons: Record<ArticleCategory, React.ComponentType<{ className?: string }>> = {
  'Infraestrutura': Server,
  'Cloud / Virtualização': Cloud,
  'Backup & DR': Database,
  'Segurança': Shield,
  'E-mail': Mail,
  'Sistemas Operacionais': Monitor,
  'Automação & Ferramentas': Wrench,
  'Incidentes & Troubleshooting': AlertTriangle,
  'Procedimentos Internos': FileText,
  'Onboarding & Treinamento': GraduationCap,
};

export function ArticleCard({ article }: ArticleCardProps) {
  const IconComponent = categoryIcons[article.category] || FileText;

  return (
    <Link to={`/artigos/${article.id}`}>
      <div className="open-card hover:border-primary/50 transition-all duration-200 cursor-pointer group">
        <div className="flex items-start gap-4">
          {/* Category Icon */}
          <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <IconComponent className="h-6 w-6 text-primary" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                {article.title}
              </h3>
              {article.visibility === 'private' && (
                <div className="flex items-center gap-1 text-muted-foreground text-xs flex-shrink-0">
                  <Lock className="h-3 w-3" />
                  <span>Privado</span>
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                <span>{article.author}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{article.reading_time_minutes} min de leitura</span>
              </div>
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                <span>{article.views_count} views</span>
              </div>
              <span className="text-xs">
                {format(new Date(article.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-xs">
                {article.category}
              </Badge>
              {article.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  #{tag}
                </Badge>
              ))}
              {article.tags.length > 3 && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  +{article.tags.length - 3}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
