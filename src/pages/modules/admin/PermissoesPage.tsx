import React from 'react';
import PlaceholderPage from '../placeholders/PlaceholderPage';
import { Shield } from 'lucide-react';

export default function PermissoesPage() {
  return (
    <PlaceholderPage
      title="Permissões & Perfis"
      description="Configuração de níveis de acesso, perfis de usuário e controle de permissões no sistema."
      icon={Shield}
      backUrl="/modulos/admin"
    />
  );
}
