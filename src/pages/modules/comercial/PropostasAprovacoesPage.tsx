import React from 'react';
import PlaceholderPage from '../placeholders/PlaceholderPage';
import { CheckCircle } from 'lucide-react';

export default function PropostasAprovacoesPage() {
  return (
    <PlaceholderPage
      title="Aprovações de Propostas"
      description="Fila de propostas aguardando aprovação gerencial e fluxo de aprovação."
      icon={CheckCircle}
      backUrl="/modulos/comercial/propostas"
    />
  );
}
