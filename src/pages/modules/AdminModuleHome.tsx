import React from 'react';
import { 
  Settings, 
  Users, 
  Shield, 
  DollarSign, 
  Sliders,
  FileText,
  Activity,
} from 'lucide-react';
import { ModuleHeader, KPICard, ShortcutCard, SectionTitle } from '@/components/navigation/ModuleCard';

export default function AdminModuleHome() {
  return (
    <div className="space-y-8">
      <ModuleHeader
        title="Admin"
        description="Configurações do sistema e administração"
        icon={Settings}
      />

      {/* System Status */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Usuários Ativos"
          value="156"
          description="Logados nos últimos 30 dias"
          icon={Users}
        />
        <KPICard
          title="Perfis Configurados"
          value="11"
          description="Níveis de acesso"
          icon={Shield}
        />
        <KPICard
          title="Última Atualização"
          value="2h atrás"
          description="Tabela de preços"
          icon={DollarSign}
        />
        <KPICard
          title="Status do Sistema"
          value="Operacional"
          description="Todos os serviços ativos"
          icon={Activity}
        />
      </div>

      {/* Admin Sections */}
      <div>
        <SectionTitle 
          title="Configurações do Sistema" 
          description="Acesse as áreas de administração"
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <ShortcutCard
            title="Gestão de Usuários"
            description="Criar, editar e gerenciar usuários"
            icon={Users}
            href="/modulos/admin/usuarios"
          />
          <ShortcutCard
            title="Permissões & Perfis"
            description="Configurar níveis de acesso"
            icon={Shield}
            href="/modulos/admin/permissoes"
          />
          <ShortcutCard
            title="Configuração de Preços"
            description="Tabela de preços e descontos"
            icon={DollarSign}
            href="/modulos/admin/precos"
          />
          <ShortcutCard
            title="Parâmetros do Sistema"
            description="Configurações gerais"
            icon={Sliders}
            href="/modulos/admin/parametros"
          />
          <ShortcutCard
            title="Logs & Auditoria"
            description="Histórico de ações"
            icon={FileText}
            href="/modulos/admin/logs"
          />
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <SectionTitle 
          title="Atividade Recente" 
          description="Últimas ações no sistema"
        />
        <div className="space-y-3">
          {[
            { action: 'Usuário criado', user: 'admin@open.com.br', detail: 'Novo usuário: joao.silva@open.com.br', time: '10 min atrás' },
            { action: 'Preço atualizado', user: 'gerente@open.com.br', detail: 'VM Standard: R$ 299 → R$ 319', time: '2h atrás' },
            { action: 'Permissão alterada', user: 'admin@open.com.br', detail: 'Nível CS agora pode ver KPIs', time: '1 dia atrás' },
          ].map((log, index) => (
            <div key={index} className="flex items-center justify-between p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{log.action}</p>
                  <p className="text-sm text-muted-foreground">{log.detail}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{log.time}</p>
                <p className="text-xs text-muted-foreground">{log.user}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
