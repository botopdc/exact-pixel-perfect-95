import React from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { DocEntry } from '@/data/docs/registry';
import { getDocContent } from '@/data/docs/content';

interface DocsHeaderProps {
  doc: DocEntry;
}

export function DocsHeader({ doc }: DocsHeaderProps) {
  const handleDownload = () => {
    const content = getDocContent(doc.file);
    if (!content) return;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.slug.replace(/\//g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-6 border-b border-border mb-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {doc.category}
          </Badge>
          {doc.module && (
            <Badge variant="outline" className="text-xs">
              {doc.module}
            </Badge>
          )}
        </div>
        <h1 className="text-2xl font-bold text-foreground">{doc.title}</h1>
        <p className="text-sm text-muted-foreground">{doc.summary}</p>
        {doc.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {doc.tags.map(tag => (
              <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
      {doc.downloadable && (
        <Button variant="outline" size="sm" onClick={handleDownload} className="shrink-0">
          <Download className="h-4 w-4 mr-2" />
          Download .md
        </Button>
      )}
    </div>
  );
}
