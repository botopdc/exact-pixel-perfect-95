import React from 'react';
import PlaceholderPage from '../placeholders/PlaceholderPage';
import { GraduationCap } from 'lucide-react';

export default function AcademyPage() {
  return (
    <PlaceholderPage
      title="OPEN Academy"
      description="Plataforma de treinamentos, cursos e capacitação para colaboradores."
      icon={GraduationCap}
      backUrl="/modulos/gente"
    />
  );
}
