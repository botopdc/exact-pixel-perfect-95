import React from 'react';
import PlaceholderPage from '../placeholders/PlaceholderPage';
import { Award } from 'lucide-react';

export default function AvaliacoesPage() {
  return (
    <PlaceholderPage
      title="Avaliações"
      description="Sistema de avaliações de desempenho, feedbacks e desenvolvimento profissional."
      icon={Award}
      backUrl="/modulos/gente"
    />
  );
}
