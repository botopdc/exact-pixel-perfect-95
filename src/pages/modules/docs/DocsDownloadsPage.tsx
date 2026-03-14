import React from 'react';
import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getAllDownloadableDocs } from '@/data/docs/registry';
import { getDocContent } from '@/data/docs/content';

export default function DocsDownloadsPage() {
  const docs = getAllDownloadableDocs();

  const handleDownload = (doc: typeof docs[0]) => {
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
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Downloads</h1>
        <p className="text-muted-foreground text-sm">
          Todos os documentos disponíveis para download em formato Markdown.
        </p>
      </div>

      <div className="space-y-2">
        {docs.map(doc => (
          <div
            key={doc.slug}
            className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-sm text-foreground truncate">{doc.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="secondary" className="text-[10px]">{doc.category}</Badge>
                  <span className="text-xs text-muted-foreground truncate">{doc.summary}</span>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => handleDownload(doc)} className="shrink-0 ml-4">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
