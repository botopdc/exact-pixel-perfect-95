import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface DocsRendererProps {
  content: string;
}

export function DocsRenderer({ content }: DocsRendererProps) {
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none 
      prose-headings:text-foreground
      prose-h1:text-2xl prose-h1:font-bold prose-h1:border-b prose-h1:border-border prose-h1:pb-3
      prose-h2:text-xl prose-h2:font-semibold prose-h2:mt-8 prose-h2:mb-4
      prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-6
      prose-p:text-muted-foreground prose-p:leading-relaxed
      prose-a:text-primary prose-a:no-underline hover:prose-a:underline
      prose-strong:text-foreground
      prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
      prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-lg
      prose-table:border prose-table:border-border
      prose-th:bg-muted/50 prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-xs prose-th:font-semibold prose-th:text-foreground
      prose-td:px-3 prose-td:py-2 prose-td:text-sm prose-td:border-t prose-td:border-border
      prose-li:text-muted-foreground
      prose-ul:space-y-1
      prose-ol:space-y-1
      prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground
    ">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </article>
  );
}
