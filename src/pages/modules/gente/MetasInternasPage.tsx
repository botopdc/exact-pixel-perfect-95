import React from 'react';
import PlaceholderPage from '../placeholders/PlaceholderPage';
import { Target } from 'lucide-react';

export default function MetasInternasPage() {
  return (
    <PlaceholderPage
      title="Metas Internas"
      description="Definição e acompanhamento de metas por área e departamento."
      icon={Target}
      backUrl="/modulos/gente"
    />
  );
}
