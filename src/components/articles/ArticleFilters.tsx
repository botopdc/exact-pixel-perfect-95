import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, Plus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ARTICLE_CATEGORIES, ArticleCategory } from '@/types/article';

interface ArticleFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: ArticleCategory | '';
  onCategoryChange: (value: ArticleCategory | '') => void;
  author: string;
  onAuthorChange: (value: string) => void;
  authors: string[];
}

export function ArticleFilters({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  author,
  onAuthorChange,
  authors,
}: ArticleFiltersProps) {
  const hasFilters = search || category || author;

  const clearFilters = () => {
    onSearchChange('');
    onCategoryChange('');
    onAuthorChange('');
  };

  return (
    <div className="open-card mb-6">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 bg-input border-border"
          />
        </div>

        {/* Category Filter */}
        <Select value={category} onValueChange={(val) => onCategoryChange(val as ArticleCategory | '')}>
          <SelectTrigger className="w-full lg:w-[220px] bg-input border-border">
            <SelectValue placeholder="Filtrar por categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas as categorias</SelectItem>
            {ARTICLE_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Author Filter */}
        <Select value={author} onValueChange={onAuthorChange}>
          <SelectTrigger className="w-full lg:w-[200px] bg-input border-border">
            <SelectValue placeholder="Filtrar por autor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos os autores</SelectItem>
            {authors.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="icon"
            onClick={clearFilters}
            className="flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        {/* Create Button */}
        <Button asChild className="flex-shrink-0">
          <Link to="/artigos/novo">
            <Plus className="h-4 w-4 mr-2" />
            Criar artigo
          </Link>
        </Button>
      </div>
    </div>
  );
}
