/**
 * Contract Service - Phase 1 (Local Storage)
 * Ready to swap to API in Phase 2
 */

import type { Contract, ContractFilters, ContractStatus } from '@/types/contract';

const STORAGE_KEY = 'contracts_v1';

/**
 * Generate a unique ID for new contracts
 */
function generateId(): string {
  return `CTR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Load contracts from localStorage
 */
function loadFromStorage(): Contract[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('[ContractService] Error loading from storage:', error);
    return [];
  }
}

/**
 * Save contracts to localStorage
 */
function saveToStorage(contracts: Contract[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contracts));
  } catch (error) {
    console.error('[ContractService] Error saving to storage:', error);
  }
}

/**
 * List all contracts with optional filters
 */
export async function listContracts(filters?: ContractFilters): Promise<Contract[]> {
  // Simular delay de rede
  await new Promise(resolve => setTimeout(resolve, 100));
  
  let contracts = loadFromStorage();
  
  if (filters) {
    if (filters.status) {
      contracts = contracts.filter(c => c.status === filters.status);
    }
    if (filters.duration) {
      contracts = contracts.filter(c => c.contract_duration === filters.duration);
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      contracts = contracts.filter(c => 
        c.company_name.toLowerCase().includes(searchLower) ||
        c.responsible_name.toLowerCase().includes(searchLower) ||
        c.proposal_label?.toLowerCase().includes(searchLower)
      );
    }
  }
  
  // Ordenar por data de atualização (mais recente primeiro)
  contracts.sort((a, b) => 
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
  
  return contracts;
}

/**
 * Get a single contract by ID
 */
export async function getContract(id: string): Promise<Contract | null> {
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const contracts = loadFromStorage();
  return contracts.find(c => c.id === id) || null;
}

/**
 * Get a contract by proposal ID
 */
export async function getContractByProposalId(proposalId: string | number): Promise<Contract | null> {
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const contracts = loadFromStorage();
  return contracts.find(c => String(c.proposal_id) === String(proposalId)) || null;
}

/**
 * Create a new contract
 */
export async function createContract(data: Omit<Contract, 'id' | 'created_at' | 'updated_at'>): Promise<Contract> {
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const contracts = loadFromStorage();
  
  // Verificar se já existe contrato para esta proposta
  const existing = contracts.find(c => String(c.proposal_id) === String(data.proposal_id));
  if (existing) {
    throw new Error('Já existe um contrato para esta proposta');
  }
  
  const now = new Date().toISOString();
  const newContract: Contract = {
    ...data,
    id: generateId(),
    created_at: now,
    updated_at: now,
  };
  
  contracts.push(newContract);
  saveToStorage(contracts);
  
  return newContract;
}

/**
 * Update an existing contract
 */
export async function updateContract(id: string, data: Partial<Contract>): Promise<Contract> {
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const contracts = loadFromStorage();
  const index = contracts.findIndex(c => c.id === id);
  
  if (index === -1) {
    throw new Error('Contrato não encontrado');
  }
  
  const updated: Contract = {
    ...contracts[index],
    ...data,
    id, // Garantir que o ID não mude
    created_at: contracts[index].created_at, // Manter data de criação
    updated_at: new Date().toISOString(),
  };
  
  contracts[index] = updated;
  saveToStorage(contracts);
  
  return updated;
}

/**
 * Delete a contract
 */
export async function deleteContract(id: string): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const contracts = loadFromStorage();
  const filtered = contracts.filter(c => c.id !== id);
  
  if (filtered.length === contracts.length) {
    throw new Error('Contrato não encontrado');
  }
  
  saveToStorage(filtered);
}

/**
 * Update contract status
 */
export async function updateContractStatus(id: string, status: ContractStatus): Promise<Contract> {
  return updateContract(id, { status });
}

// Export the service object for Phase 2 migration
export const contractService = {
  list: listContracts,
  get: getContract,
  getByProposalId: getContractByProposalId,
  create: createContract,
  update: updateContract,
  delete: deleteContract,
  updateStatus: updateContractStatus,
};
