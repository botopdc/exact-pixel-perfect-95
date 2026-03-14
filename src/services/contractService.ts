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

export async function createContract(input: {
  proposal_id: string;
  client_name: string;
  company: string;
  email: string;
  phone: string;
  total: number;
  datacenter: string | null;
  contract_duration: number | null;
  due_at: string | null;
  proposal_payload: Record<string, any>;
}): Promise<Contract> {
  const { data, error } = await supabase
    .from('contracts')
    .insert({
      proposal_id: input.proposal_id,
      client_name: input.client_name,
      company: input.company,
      email: input.email,
      phone: input.phone,
      total: input.total,
      datacenter: input.datacenter,
      contract_duration: input.contract_duration,
      due_at: input.due_at,
      proposal_payload: input.proposal_payload as any,
      status: 'rascunho',
    })
    .select()
    .single();
  if (error) {
    if (error.message.includes('contracts_proposal_id_active_unique')) {
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
