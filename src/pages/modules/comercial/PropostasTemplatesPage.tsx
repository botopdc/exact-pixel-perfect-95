import React from 'react';
import PlaceholderPage from '../placeholders/PlaceholderPage';
import { FileText } from 'lucide-react';

export default function PropostasTemplatesPage() {
  return (
    <PlaceholderPage
      title="Templates de Propostas"
      description="Biblioteca de templates pré-configurados para agilizar a criação de propostas comerciais."
      icon={FileText}
      backUrl="/modulos/comercial/propostas"
    />
  );
}
