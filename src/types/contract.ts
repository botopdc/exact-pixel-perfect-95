/**
 * Contract Types - Supabase-backed
 */

export interface Contract {
  id: string;
  proposal_id: string;
  client_name: string;
  company: string;
  email: string;
  phone: string;
  status: ContractStatus;
  contract_number: string | null;
  total: number;
  datacenter: string | null;
  contract_duration: number | null;
  due_at: string | null;
  proposal_payload: Record<string, any>;
  contract_payload: Record<string, any> | null;
  generated_from_proposal_at: string;
  generated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type ContractStatus = 'rascunho' | 'ativo' | 'cancelado' | 'expirado';

export interface ContractFilters {
  status?: ContractStatus | '';
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  rascunho: 'Rascunho',
  ativo: 'Ativo',
  cancelado: 'Cancelado',
  expirado: 'Expirado',
};

export const CONTRACT_STATUS_COLORS: Record<ContractStatus, string> = {
  rascunho: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30',
  ativo: 'bg-green-500/20 text-green-600 border-green-500/30',
  cancelado: 'bg-red-500/20 text-red-600 border-red-500/30',
  expirado: 'bg-muted text-muted-foreground border-muted-foreground/30',
};
