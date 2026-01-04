import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useArticle, useDeleteArticle, useRateArticle, useIncrementViews } from '@/hooks/useArticles';
import { ArticleContent } from '@/components/articles/ArticleContent';
import { ArticleCategory } from '@/types/article';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Clock,
  User,
  Eye,
  Lock,
  Edit,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  Server,
  Cloud,
  Database,
  Shield,
  Mail,
  Monitor,
  Wrench,
  AlertTriangle,
  GraduationCap,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

export default function ArtigoView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: article, isLoading } = useArticle(id);
  const deleteArticle = useDeleteArticle();
  const rateArticle = useRateArticle();
  const incrementViews = useIncrementViews();
  const [hasRated, setHasRated] = useState(false);
  const [hasViewed, setHasViewed] = useState(false);

  // Increment views on mount
  useEffect(() => {
    if (id && !hasViewed) {
      incrementViews.mutate(id);
      setHasViewed(true);
    }
  }, [id, hasViewed]);

  const handleDelete = () => {
    if (id) {
      deleteArticle.mutate(id, {
        onSuccess: () => navigate('/artigos'),
      });
    }
  };

  const handleRate = (helpful: boolean) => {
    if (id && !hasRated) {
      rateArticle.mutate({ id, helpful });
      setHasRated(true);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-32" />
        <div className="open-card space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="open-card text-center py-12 max-w-lg mx-auto">
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Artigo não encontrado
        </h2>
        <p className="text-muted-foreground mb-4">
          O artigo que você procura não existe ou foi removido.
        </p>
        <Button asChild>
          <Link to="/artigos">Voltar para Artigos</Link>
        </Button>
      </div>
    );
  }

  const IconComponent = categoryIcons[article.category] || FileText;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back Button */}
      <Button variant="ghost" asChild className="mb-6">
        <Link to="/artigos">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Artigos
        </Link>
      </Button>

      {/* Article Header */}
      <div className="open-card mb-6">
        {/* Category & Status */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <IconComponent className="h-5 w-5 text-primary" />
            </div>
            <Badge variant="secondary">{article.category}</Badge>
          </div>
          {article.visibility === 'private' && (
            <div className="flex items-center gap-1 text-muted-foreground text-sm bg-secondary/50 px-3 py-1 rounded-full">
              <Lock className="h-4 w-4" />
              <span>Privado para uso interno</span>
            </div>
          )}
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-foreground mb-4">
          {article.title}
        </h1>

        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
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
            <span>{article.views_count} visualizações</span>
          </div>
          <span>
            Criado em{' '}
            {format(new Date(article.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
              locale: ptBR,
            })}
          </span>
        </div>

        {/* Tags */}
        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {article.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-sm">
                #{tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Article Content */}
      <div className="open-card mb-6">
        <ArticleContent content={article.content} />
      </div>

      {/* Article Footer - Rating & Actions */}
      <div className="open-card">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Rating */}
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground">Este artigo foi útil?</span>
            <div className="flex items-center gap-2">
              <Button
                variant={hasRated ? 'ghost' : 'outline'}
                size="sm"
                onClick={() => handleRate(true)}
                disabled={hasRated}
                className="gap-2"
              >
                <ThumbsUp className="h-4 w-4" />
                <span>{article.helpful_yes}</span>
              </Button>
              <Button
                variant={hasRated ? 'ghost' : 'outline'}
                size="sm"
                onClick={() => handleRate(false)}
                disabled={hasRated}
                className="gap-2"
              >
                <ThumbsDown className="h-4 w-4" />
                <span>{article.helpful_no}</span>
              </Button>
            </div>
          </div>

          {/* Admin Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link to={`/artigos/${article.id}/editar`}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir artigo?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. O artigo será permanentemente
                    removido do sistema.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    Sim, excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
}
