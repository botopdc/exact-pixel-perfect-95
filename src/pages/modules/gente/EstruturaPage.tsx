import React from 'react';
import PlaceholderPage from '../placeholders/PlaceholderPage';
import { Building2 } from 'lucide-react';

export default function EstruturaPage() {
  return (
    <PlaceholderPage
      title="Estrutura Organizacional"
      description="Organograma da empresa, estrutura de equipes e hierarquia organizacional."
      icon={Building2}
      backUrl="/modulos/gente"
    />
  );
}
