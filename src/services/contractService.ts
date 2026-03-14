/**
 * Contract Service - Supabase-backed
 */

import { supabase } from '@/integrations/supabase/client';
import type { Contract, ContractFilters, ContractStatus } from '@/types/contract';

export async function listContracts(filters?: ContractFilters): Promise<Contract[]> {
  let query = supabase
    .from('contracts')
    .select('*')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.search) {
    const s = `%${filters.search}%`;
    query = query.or(`client_name.ilike.${s},company.ilike.${s},email.ilike.${s},contract_number.ilike.${s}`);
  }
  if (filters?.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }
  if (filters?.dateTo) {
    query = query.lte('created_at', `${filters.dateTo}T23:59:59`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []) as unknown as Contract[];
}

export async function getContract(id: string): Promise<Contract | null> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as Contract | null;
}

export async function getContractByProposalId(proposalId: string): Promise<Contract | null> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('proposal_id', proposalId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as Contract | null;
}

export interface CreateContractInput {
  proposal_id: string;
  proposal_uuid?: string | null;
  client_name: string;
  company: string;
  email: string;
  phone: string;
  tax_id?: string | null;
  currency?: string;
  subtotal?: number;
  discount_amount?: number;
  total: number;
  datacenter: string | null;
  contract_duration: number | null;
  billing_cycle?: string;
  start_date?: string | null;
  end_date?: string | null;
  due_at: string | null;
  notes?: string | null;
  proposal_payload: Record<string, any>;
  // Legal/address fields for contract text & PDF
  legal_name?: string | null;
  company_name?: string | null;
  has_no_cnpj?: boolean;
  cnpj?: string | null;
  responsible_name?: string | null;
  responsible_cpf?: string | null;
  zip_code?: string | null;
  street?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  payment_day?: number | null;
  contract_date?: string | null;
}

export async function createContract(input: CreateContractInput): Promise<Contract> {
  // Build contract_payload snapshot with all form data
  const contractPayload = {
    legal_name: input.legal_name,
    company_name: input.company_name,
    has_no_cnpj: input.has_no_cnpj,
    cnpj: input.cnpj,
    responsible_name: input.responsible_name,
    responsible_cpf: input.responsible_cpf,
    zip_code: input.zip_code,
    street: input.street,
    neighborhood: input.neighborhood,
    city: input.city,
    state: input.state,
    payment_day: input.payment_day,
    contract_date: input.contract_date,
    billing_cycle: input.billing_cycle,
    contract_duration: input.contract_duration,
    notes: input.notes,
  };

  const payload = {
    proposal_id: input.proposal_id,
    proposal_uuid: input.proposal_uuid || null,
    client_name: input.client_name,
    company: input.company,
    email: input.email,
    phone: input.phone || '',
    tax_id: input.tax_id || null,
    currency: input.currency || 'BRL',
    subtotal: input.subtotal || input.total,
    discount_amount: input.discount_amount || 0,
    total: input.total,
    datacenter: input.datacenter,
    contract_duration: input.contract_duration,
    billing_cycle: input.billing_cycle || 'mensal',
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    due_at: input.due_at,
    notes: input.notes || null,
    proposal_payload: input.proposal_payload,
    contract_payload: contractPayload,
    legal_name: input.legal_name || null,
    company_name: input.company_name || null,
    has_no_cnpj: input.has_no_cnpj || false,
    cnpj: input.has_no_cnpj ? null : (input.cnpj || null),
    responsible_name: input.responsible_name || null,
    responsible_cpf: input.responsible_cpf || null,
    zip_code: input.zip_code || null,
    street: input.street || null,
    neighborhood: input.neighborhood || null,
    city: input.city || null,
    state: input.state || null,
    payment_day: input.payment_day || null,
    contract_date: input.contract_date || null,
  };

  const { data, error } = await supabase.rpc('create_contract_from_proposal', {
    payload: payload as any,
  });

  if (error) {
    if (error.message.includes('já foi convertida')) {
      throw new Error('Esta proposta já foi convertida em contrato');
    }
    throw new Error(error.message);
  }

  return data as unknown as Contract;
}

export async function updateContract(id: string, updates: Partial<Contract>): Promise<Contract> {
  const { data, error } = await supabase
    .from('contracts')
    .update(updates as any)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as Contract;
}

export async function deleteContract(id: string): Promise<void> {
  const { error } = await supabase
    .from('contracts')
    .update({ deleted_at: new Date().toISOString() } as any)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function updateContractStatus(id: string, status: ContractStatus): Promise<Contract> {
  return updateContract(id, { status } as any);
}

/** Check which proposal IDs already have contracts */
export async function getConvertedProposalIds(proposalIds: string[]): Promise<Set<string>> {
  if (!proposalIds.length) return new Set();
  const { data, error } = await supabase
    .from('contracts')
    .select('proposal_id')
    .in('proposal_id', proposalIds)
    .is('deleted_at', null);
  if (error) return new Set();
  return new Set((data || []).map((r: any) => r.proposal_id));
}

export const contractService = {
  list: listContracts,
  get: getContract,
  getByProposalId: getContractByProposalId,
  create: createContract,
  update: updateContract,
  delete: deleteContract,
  updateStatus: updateContractStatus,
  getConvertedProposalIds,
};
