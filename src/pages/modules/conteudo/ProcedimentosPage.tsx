import React from 'react';
import PlaceholderPage from '../placeholders/PlaceholderPage';
import { FolderOpen } from 'lucide-react';

export default function ProcedimentosPage() {
  return (
    <PlaceholderPage
      title="Procedimentos"
      description="Área para documentação de processos operacionais, rotinas e procedimentos padrão da equipe."
      icon={FolderOpen}
      backUrl="/modulos/conteudo"
    />
  );
}
