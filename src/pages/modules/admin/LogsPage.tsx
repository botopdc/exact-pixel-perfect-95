import React from 'react';
import { FileText, Activity, User, Clock, Filter } from 'lucide-react';
import { ModuleHeader, SectionTitle } from '@/components/navigation/ModuleCard';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface LogEntry {
  id: string;
  action: string;
  user: string;
  detail: string;
  time: string;
  type: 'create' | 'update' | 'delete' | 'login' | 'system';
}

const mockLogs: LogEntry[] = [
  { id: '1', action: 'Usuário criado', user: 'admin@open.com.br', detail: 'Novo usuário: joao.silva@open.com.br', time: '10 min atrás', type: 'create' },
  { id: '2', action: 'Login realizado', user: 'gerente@open.com.br', detail: 'IP: 192.168.1.100', time: '15 min atrás', type: 'login' },
  { id: '3', action: 'Preço atualizado', user: 'admin@open.com.br', detail: 'VM Standard: R$ 299 → R$ 319', time: '2h atrás', type: 'update' },
  { id: '4', action: 'Permissão alterada', user: 'admin@open.com.br', detail: 'Nível CS agora pode ver KPIs', time: '1 dia atrás', type: 'update' },
  { id: '5', action: 'Proposta excluída', user: 'gerente@open.com.br', detail: 'Proposta #1234 removida', time: '2 dias atrás', type: 'delete' },
  { id: '6', action: 'Backup automático', user: 'sistema', detail: 'Backup diário concluído com sucesso', time: '3 dias atrás', type: 'system' },
];

const typeColors = {
  create: 'bg-green-500/10 text-green-600 dark:text-green-400',
  update: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  delete: 'bg-red-500/10 text-red-600 dark:text-red-400',
  login: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  system: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
};

export default function LogsPage() {
  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Logs & Auditoria"
        description="Histórico de ações e eventos do sistema"
        icon={FileText}
      />

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <Input placeholder="Buscar nos logs..." />
          </div>
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
          <Button variant="outline">Exportar</Button>
        </div>
      </Card>

      {/* Logs List */}
      <div>
        <SectionTitle title="Atividade Recente" />
        <div className="space-y-2">
          {mockLogs.map((log) => (
            <Card key={log.id} className="p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-muted">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{log.action}</p>
                    <Badge variant="secondary" className={typeColors[log.type]}>
                      {log.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{log.detail}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span className="truncate max-w-[150px]">{log.user}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Clock className="h-3 w-3" />
                    <span>{log.time}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
