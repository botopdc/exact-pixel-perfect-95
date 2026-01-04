import { Link } from 'react-router-dom';
import { useTopArticles, useBestRatedArticles, useRecentArticles } from '@/hooks/useArticles';
import { TrendingUp, ThumbsUp, Clock, Eye, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

function ArticleListItem({ article }: { article: { id: string; title: string; views_count?: number; helpful_yes?: number } }) {
  return (
    <Link
      to={`/artigos/${article.id}`}
      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-secondary/50 transition-colors group"
    >
      <span className="text-sm text-muted-foreground group-hover:text-foreground line-clamp-1 flex-1 mr-2">
        {article.title}
      </span>
      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

function SidebarSection({
  title,
  icon: Icon,
  articles,
  isLoading,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  articles?: { id: string; title: string; views_count?: number; helpful_yes?: number }[];
  isLoading: boolean;
}) {
  return (
    <div className="open-card">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      <div className="space-y-1">
        {isLoading ? (
          <>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </>
        ) : articles && articles.length > 0 ? (
          articles.map((article) => (
            <ArticleListItem key={article.id} article={article} />
          ))
        ) : (
          <p className="text-sm text-muted-foreground py-2">Nenhum artigo encontrado</p>
        )}
      </div>
    </div>
  );
}

export function ArticleSidebar() {
  const { data: topArticles, isLoading: topLoading } = useTopArticles();
  const { data: bestRatedArticles, isLoading: ratedLoading } = useBestRatedArticles();
  const { data: recentArticles, isLoading: recentLoading } = useRecentArticles();

  return (
    <div className="space-y-6">
      <SidebarSection
        title="Mais Acessados"
        icon={TrendingUp}
        articles={topArticles}
        isLoading={topLoading}
      />
      <SidebarSection
        title="Mais Bem Avaliados"
        icon={ThumbsUp}
        articles={bestRatedArticles}
        isLoading={ratedLoading}
      />
      <SidebarSection
        title="Últimos Criados"
        icon={Clock}
        articles={recentArticles}
        isLoading={recentLoading}
      />
    </div>
  );
}
