import React, { useState, useMemo } from 'react';
import { Search, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { searchDocs } from '@/data/docs/registry';
import { Badge } from '@/components/ui/badge';

export function DocsSearch() {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchDocs(query), [query]);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar na documentação..."
          className="pl-10 h-10"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>
      {query.trim() && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {results.map(doc => (
            <Link
              key={doc.slug}
              to={`/modulos/docs/${doc.slug}`}
              onClick={() => setQuery('')}
              className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border last:border-0"
            >
              <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                <p className="text-xs text-muted-foreground truncate">{doc.summary}</p>
                <Badge variant="secondary" className="mt-1 text-[10px]">{doc.category}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
      {query.trim() && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 px-4 py-6 text-center text-sm text-muted-foreground">
          Nenhum documento encontrado para "{query}"
        </div>
      )}
    </div>
  );
}
