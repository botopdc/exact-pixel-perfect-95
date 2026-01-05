import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PeriodoFiltro, TimeFiltro } from '@/services/kpiService';

interface KPIFiltersProps {
  periodo: PeriodoFiltro;
  onPeriodoChange: (periodo: PeriodoFiltro) => void;
  time?: TimeFiltro;
  onTimeChange?: (time: TimeFiltro) => void;
  empresa?: string;
  empresas?: string[];
  onEmpresaChange?: (empresa: string) => void;
  servico?: string;
  servicos?: string[];
  onServicoChange?: (servico: string) => void;
  showTimeFilter?: boolean;
  showEmpresaFilter?: boolean;
  showServicoFilter?: boolean;
}

export function KPIFilters({
  periodo,
  onPeriodoChange,
  time,
  onTimeChange,
  empresa,
  empresas = [],
  onEmpresaChange,
  servico,
  servicos = [],
  onServicoChange,
  showTimeFilter = false,
  showEmpresaFilter = false,
  showServicoFilter = false
}: KPIFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {/* Período */}
      <Select value={periodo} onValueChange={(v) => onPeriodoChange(v as PeriodoFiltro)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Período" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="hoje">Hoje</SelectItem>
          <SelectItem value="semana">Esta Semana</SelectItem>
          <SelectItem value="mes">Este Mês</SelectItem>
          <SelectItem value="todos">Todos</SelectItem>
        </SelectContent>
      </Select>

      {/* Time */}
      {showTimeFilter && onTimeChange && (
        <Select value={time} onValueChange={(v) => onTimeChange(v as TimeFiltro)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Times</SelectItem>
            <SelectItem value="suporte">Suporte</SelectItem>
            <SelectItem value="cs">Customer Success</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Empresa */}
      {showEmpresaFilter && onEmpresaChange && empresas.length > 0 && (
        <Select value={empresa || 'todas'} onValueChange={onEmpresaChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as Empresas</SelectItem>
            {empresas.map(e => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Serviço */}
      {showServicoFilter && onServicoChange && servicos.length > 0 && (
        <Select value={servico || 'todos'} onValueChange={onServicoChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Serviço" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Serviços</SelectItem>
            {servicos.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
