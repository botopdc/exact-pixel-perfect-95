import React from 'react';
import PlaceholderPage from '../placeholders/PlaceholderPage';
import { Sliders } from 'lucide-react';

export default function ParametrosPage() {
  return (
    <PlaceholderPage
      title="Parâmetros do Sistema"
      description="Configurações gerais do sistema, variáveis de ambiente e parâmetros operacionais."
      icon={Sliders}
      backUrl="/modulos/admin"
    />
  );
}
