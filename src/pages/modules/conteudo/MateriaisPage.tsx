import React from 'react';
import PlaceholderPage from '../placeholders/PlaceholderPage';
import { BookMarked } from 'lucide-react';

export default function MateriaisPage() {
  return (
    <PlaceholderPage
      title="Materiais Internos"
      description="Repositório de documentos internos, apresentações, templates e materiais de apoio para a equipe."
      icon={BookMarked}
      backUrl="/modulos/conteudo"
    />
  );
}
