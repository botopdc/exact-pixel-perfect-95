import React from 'react';
import PlaceholderPage from '../placeholders/PlaceholderPage';
import { BookOpen } from 'lucide-react';

export default function BaseConhecimentoPage() {
  return (
    <PlaceholderPage
      title="Base de Conhecimento"
      description="FAQ, soluções para problemas comuns e base de conhecimento técnico para consulta rápida."
      icon={BookOpen}
      backUrl="/modulos/conteudo"
    />
  );
}
