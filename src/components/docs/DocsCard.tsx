import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { DocEntry } from '@/data/docs/registry';

interface DocsCardProps {
  doc: DocEntry;
}

export function DocsCard({ doc }: DocsCardProps) {
  return (
    <Link
      to={`/modulos/docs/${doc.slug}`}
      className="group flex flex-col p-4 rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-card/80 transition-all"
    >
      <div className="flex items-start justify-between mb-2">
        <FileText className="h-5 w-5 text-primary" />
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <h3 className="font-semibold text-foreground text-sm mb-1">{doc.title}</h3>
      <p className="text-xs text-muted-foreground line-clamp-2 mb-3 flex-1">{doc.summary}</p>
      <div className="flex items-center gap-1.5">
        <Badge variant="secondary" className="text-[10px]">{doc.category}</Badge>
        {doc.module && <Badge variant="outline" className="text-[10px]">{doc.module}</Badge>}
      </div>
    </Link>
  );
}
