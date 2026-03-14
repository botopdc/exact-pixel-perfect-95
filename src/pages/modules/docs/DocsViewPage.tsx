import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { getDocBySlug } from '@/data/docs/registry';
import { getDocContent } from '@/data/docs/content';
import { DocsHeader } from '@/components/docs/DocsHeader';
import { DocsRenderer } from '@/components/docs/DocsRenderer';

export default function DocsViewPage() {
  // Capture the full wildcard path
  const params = useParams();
  const slug = params['*'] || '';

  const doc = getDocBySlug(slug);
  if (!doc) {
    return <Navigate to="/modulos/docs" replace />;
  }

  const content = getDocContent(doc.file);
  if (!content) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Conteúdo não encontrado para este documento.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <DocsHeader doc={doc} />
      <DocsRenderer content={content} />
    </div>
  );
}
