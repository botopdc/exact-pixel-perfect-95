import { useState, useMemo } from 'react';
import { useArticles, useUniqueAuthors } from '@/hooks/useArticles';
import { ArticleCard } from '@/components/articles/ArticleCard';
import { ArticleSidebar } from '@/components/articles/ArticleSidebar';
import { ArticleFilters } from '@/components/articles/ArticleFilters';
import { ArticleCategory } from '@/types/article';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText } from 'lucide-react';

export default function Artigos() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ArticleCategory | ''>('');
  const [author, setAuthor] = useState('');

  const { data: articles, isLoading } = useArticles({
    search: search || undefined,
    category: category || undefined,
    author: author || undefined,
    status: 'published',
  });

  const { data: authors = [] } = useUniqueAuthors();

  return (
    <div className="flex gap-6">
      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {/* Filters */}
        <ArticleFilters
          search={search}
          onSearchChange={setSearch}
          category={category}
          onCategoryChange={setCategory}
          author={author}
          onAuthorChange={setAuthor}
          authors={authors}
        />

        {/* Articles List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="open-card">
                <div className="flex gap-4">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : articles && articles.length > 0 ? (
          <div className="space-y-4">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <div className="open-card text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Nenhum artigo encontrado
            </h3>
            <p className="text-muted-foreground">
              {search || category || author
                ? 'Tente ajustar os filtros de busca.'
                : 'Comece criando seu primeiro artigo.'}
            </p>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="hidden xl:block w-80 flex-shrink-0">
        <ArticleSidebar />
      </div>
    </div>
  );
}
