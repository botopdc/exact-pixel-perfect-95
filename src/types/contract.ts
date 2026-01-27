/**
 * Contract Types - Phase 1 (Local Storage)
 * Ready for API integration in Phase 2
 */

export interface ContractAddress {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export interface Contract {
  id: string;
  proposal_id: string | number;
  proposal_label?: string;
  status: ContractStatus;
  
  // Dados da Contratante
  company_name: string;
  cnpj: string | null;
  no_cnpj: boolean;
  responsible_name: string;
  cpf: string;
  
  // Endereço
  address: ContractAddress;
  
  // Condições
  contract_duration: ContractDuration;
  billing_day: BillingDay;
  date: string; // ISO date
  active: boolean;
  
  // Metadata
  created_at: string;
  updated_at: string;
  
  // Temporário - anexos só em localStorage
  attachments?: ContractAttachment[];
}

export type ContractStatus = 'rascunho' | 'ativo' | 'cancelado' | 'expirado';

export type ContractDuration = 12 | 24 | 36 | 48;

export type BillingDay = 5 | 10 | 15 | 20 | 25;

export interface ContractAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  addedAt: string;
  // Em Phase 1, só guardamos referência local
  localRef?: string;
}

export interface ContractFormData {
  // Step A - Dados da Contratante
  company_name: string;
  no_cnpj: boolean;
  cnpj: string;
  responsible_name: string;
  cpf: string;
  
  // Step B - Endereço e Condições
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  contract_duration: ContractDuration;
  billing_day: BillingDay;
  date: string;
  active: boolean;
}

export interface ContractFilters {
  status?: ContractStatus | '';
  duration?: ContractDuration | '';
  executivo?: string;
  search?: string;
}

// Constantes
export const CONTRACT_DURATIONS: ContractDuration[] = [12, 24, 36, 48];
export const BILLING_DAYS: BillingDay[] = [5, 10, 15, 20, 25];

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  rascunho: 'Rascunho',
  ativo: 'Ativo',
  cancelado: 'Cancelado',
  expirado: 'Expirado',
};

export const CONTRACT_STATUS_COLORS: Record<ContractStatus, string> = {
  rascunho: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  ativo: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelado: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  expirado: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};
