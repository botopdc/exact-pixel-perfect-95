/**
 * Contract Types - Supabase-backed
 */

export interface Contract {
  id: string;
  proposal_id: string;
  proposal_uuid: string | null;
  client_name: string;
  company: string;
  email: string;
  phone: string;
  tax_id: string | null;
  status: ContractStatus;
  contract_number: string | null;
  currency: string;
  subtotal: number;
  discount_amount: number;
  total: number;
  datacenter: string | null;
  contract_duration: number | null;
  billing_cycle: string;
  start_date: string | null;
  end_date: string | null;
  due_at: string | null;
  proposal_payload: Record<string, any>;
  contract_payload: Record<string, any> | null;
  notes: string | null;
  generated_from_proposal_at: string;
  generated_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type ContractStatus =
  | 'rascunho'
  | 'pendente_assinatura'
  | 'assinado'
  | 'cancelado'
  | 'expirado';

export interface ContractFilters {
  status?: ContractStatus | '';
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  rascunho: 'Rascunho',
  pendente_assinatura: 'Pendente Assinatura',
  assinado: 'Assinado',
  cancelado: 'Cancelado',
  expirado: 'Expirado',
};

export const CONTRACT_STATUS_COLORS: Record<ContractStatus, string> = {
  rascunho: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30',
  pendente_assinatura: 'bg-sky-500/20 text-sky-600 border-sky-500/30',
  assinado: 'bg-green-500/20 text-green-600 border-green-500/30',
  cancelado: 'bg-red-500/20 text-red-600 border-red-500/30',
  expirado: 'bg-muted text-muted-foreground border-muted-foreground/30',
};

export const BILLING_CYCLE_OPTIONS = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
];

export const CONTRACT_DURATION_OPTIONS = [
  { value: 12, label: '12 meses' },
  { value: 24, label: '24 meses' },
  { value: 36, label: '36 meses' },
  { value: 48, label: '48 meses' },
];
