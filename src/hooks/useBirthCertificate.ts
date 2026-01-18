// ============================================================================
// BIRTH CERTIFICATE HOOKS
// React Query hooks for infrastructure documentation
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { birthCertificateService } from '@/services/birthCertificateService';
import type {
  CertCustomer,
  CertCustomerContact,
  CertAsset,
  CertAssetResources,
  CertAssetNetwork,
  CertAssetDisk,
  CertAssetLicense,
  CertAssetAccess,
} from '@/types/birthCertificate';
import { authService } from '@/services/authService';
import { toast } from 'sonner';

// Helper to get current user for audit
function getAuditUser() {
  const session = authService.getSession();
  if (!session) return undefined;
  return {
    id: session.userId,
    name: session.name,
    level: session.level,
  };
}

// ============================================================================
// CUSTOMERS
// ============================================================================

export function useCertCustomers() {
  return useQuery({
    queryKey: ['cert-customers'],
    queryFn: birthCertificateService.getCustomers,
  });
}

export function useCertCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ['cert-customer', id],
    queryFn: () => birthCertificateService.getCustomer(id!),
    enabled: !!id,
  });
}

export function useCreateCertCustomer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (customer: Omit<CertCustomer, 'id' | 'created_at' | 'updated_at' | 'contacts' | 'assets' | 'asset_count'>) =>
      birthCertificateService.createCustomer(customer, getAuditUser()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cert-customers'] });
      toast.success('Cliente criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar cliente: ${error.message}`);
    },
  });
}

export function useUpdateCertCustomer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CertCustomer> }) =>
      birthCertificateService.updateCustomer(id, data, getAuditUser()),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['cert-customers'] });
      queryClient.invalidateQueries({ queryKey: ['cert-customer', id] });
      toast.success('Cliente atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar cliente: ${error.message}`);
    },
  });
}

// ============================================================================
// CUSTOMER CONTACTS
// ============================================================================

export function useCreateCertContact() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (contact: Omit<CertCustomerContact, 'id' | 'created_at'>) =>
      birthCertificateService.createCustomerContact(contact),
    onSuccess: (_, contact) => {
      queryClient.invalidateQueries({ queryKey: ['cert-customer', contact.customer_id] });
      toast.success('Contato adicionado');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao adicionar contato: ${error.message}`);
    },
  });
}

export function useDeleteCertContact() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, customerId }: { id: string; customerId: string }) =>
      birthCertificateService.deleteCustomerContact(id).then(() => customerId),
    onSuccess: (customerId) => {
      queryClient.invalidateQueries({ queryKey: ['cert-customer', customerId] });
      toast.success('Contato removido');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover contato: ${error.message}`);
    },
  });
}

// ============================================================================
// ASSETS
// ============================================================================

export function useCertAssets(customerId?: string) {
  return useQuery({
    queryKey: ['cert-assets', customerId],
    queryFn: () => birthCertificateService.getAssets(customerId),
  });
}

export function useCertAsset(id: string | undefined) {
  return useQuery({
    queryKey: ['cert-asset', id],
    queryFn: () => birthCertificateService.getAsset(id!),
    enabled: !!id,
  });
}

export function useCreateCertAsset() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (asset: Omit<CertAsset, 'id' | 'created_at' | 'updated_at' | 'customer' | 'resources' | 'network' | 'disks' | 'licenses' | 'access'>) =>
      birthCertificateService.createAsset(asset, getAuditUser()),
    onSuccess: (_, asset) => {
      queryClient.invalidateQueries({ queryKey: ['cert-assets'] });
      queryClient.invalidateQueries({ queryKey: ['cert-customer', asset.customer_id] });
      toast.success('Ativo criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar ativo: ${error.message}`);
    },
  });
}

export function useUpdateCertAsset() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CertAsset> }) =>
      birthCertificateService.updateAsset(id, data, getAuditUser()),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['cert-assets'] });
      queryClient.invalidateQueries({ queryKey: ['cert-asset', id] });
      toast.success('Ativo atualizado');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar ativo: ${error.message}`);
    },
  });
}

// ============================================================================
// ASSET RESOURCES
// ============================================================================

export function useUpdateCertAssetResources() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ assetId, data }: { assetId: string; data: Partial<CertAssetResources> }) =>
      birthCertificateService.updateAssetResources(assetId, data, getAuditUser()),
    onSuccess: (_, { assetId }) => {
      queryClient.invalidateQueries({ queryKey: ['cert-asset', assetId] });
      toast.success('Recursos atualizados');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar recursos: ${error.message}`);
    },
  });
}

// ============================================================================
// ASSET NETWORK
// ============================================================================

export function useCreateCertNetwork() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (network: Omit<CertAssetNetwork, 'id' | 'created_at'>) =>
      birthCertificateService.createAssetNetwork(network, getAuditUser()),
    onSuccess: (_, network) => {
      queryClient.invalidateQueries({ queryKey: ['cert-asset', network.asset_id] });
      toast.success('IP adicionado');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao adicionar IP: ${error.message}`);
    },
  });
}

export function useUpdateCertNetwork() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, assetId, data }: { id: string; assetId: string; data: Partial<CertAssetNetwork> }) =>
      birthCertificateService.updateAssetNetwork(id, data).then(() => assetId),
    onSuccess: (assetId) => {
      queryClient.invalidateQueries({ queryKey: ['cert-asset', assetId] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar IP: ${error.message}`);
    },
  });
}

export function useDeleteCertNetwork() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, assetId }: { id: string; assetId: string }) =>
      birthCertificateService.deleteAssetNetwork(id).then(() => assetId),
    onSuccess: (assetId) => {
      queryClient.invalidateQueries({ queryKey: ['cert-asset', assetId] });
      toast.success('IP removido');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover IP: ${error.message}`);
    },
  });
}

// ============================================================================
// ASSET DISKS
// ============================================================================

export function useCreateCertDisk() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (disk: Omit<CertAssetDisk, 'id' | 'created_at'>) =>
      birthCertificateService.createAssetDisk(disk, getAuditUser()),
    onSuccess: (_, disk) => {
      queryClient.invalidateQueries({ queryKey: ['cert-asset', disk.asset_id] });
      toast.success('Disco adicionado');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao adicionar disco: ${error.message}`);
    },
  });
}

export function useUpdateCertDisk() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, assetId, data }: { id: string; assetId: string; data: Partial<CertAssetDisk> }) =>
      birthCertificateService.updateAssetDisk(id, data).then(() => assetId),
    onSuccess: (assetId) => {
      queryClient.invalidateQueries({ queryKey: ['cert-asset', assetId] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar disco: ${error.message}`);
    },
  });
}

export function useDeleteCertDisk() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, assetId }: { id: string; assetId: string }) =>
      birthCertificateService.deleteAssetDisk(id).then(() => assetId),
    onSuccess: (assetId) => {
      queryClient.invalidateQueries({ queryKey: ['cert-asset', assetId] });
      toast.success('Disco removido');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover disco: ${error.message}`);
    },
  });
}

// ============================================================================
// ASSET LICENSES
// ============================================================================

export function useCreateCertLicense() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (license: Omit<CertAssetLicense, 'id' | 'created_at'>) =>
      birthCertificateService.createAssetLicense(license, getAuditUser()),
    onSuccess: (_, license) => {
      queryClient.invalidateQueries({ queryKey: ['cert-asset', license.asset_id] });
      toast.success('Licença adicionada');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao adicionar licença: ${error.message}`);
    },
  });
}

export function useUpdateCertLicense() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, assetId, data }: { id: string; assetId: string; data: Partial<CertAssetLicense> }) =>
      birthCertificateService.updateAssetLicense(id, data).then(() => assetId),
    onSuccess: (assetId) => {
      queryClient.invalidateQueries({ queryKey: ['cert-asset', assetId] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar licença: ${error.message}`);
    },
  });
}

export function useDeleteCertLicense() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, assetId }: { id: string; assetId: string }) =>
      birthCertificateService.deleteAssetLicense(id).then(() => assetId),
    onSuccess: (assetId) => {
      queryClient.invalidateQueries({ queryKey: ['cert-asset', assetId] });
      toast.success('Licença removida');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover licença: ${error.message}`);
    },
  });
}

// ============================================================================
// ASSET ACCESS
// ============================================================================

export function useCreateCertAccess() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (access: Omit<CertAssetAccess, 'id' | 'created_at' | 'updated_at'>) =>
      birthCertificateService.createAssetAccess(access, getAuditUser()),
    onSuccess: (_, access) => {
      queryClient.invalidateQueries({ queryKey: ['cert-asset', access.asset_id] });
      toast.success('Acesso adicionado');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao adicionar acesso: ${error.message}`);
    },
  });
}

export function useUpdateCertAccess() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, assetId, data }: { id: string; assetId: string; data: Partial<CertAssetAccess> }) =>
      birthCertificateService.updateAssetAccess(id, data, getAuditUser()).then(() => assetId),
    onSuccess: (assetId) => {
      queryClient.invalidateQueries({ queryKey: ['cert-asset', assetId] });
      toast.success('Acesso atualizado');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar acesso: ${error.message}`);
    },
  });
}

export function useDeleteCertAccess() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, assetId }: { id: string; assetId: string }) =>
      birthCertificateService.deleteAssetAccess(id, getAuditUser()).then(() => assetId),
    onSuccess: (assetId) => {
      queryClient.invalidateQueries({ queryKey: ['cert-asset', assetId] });
      toast.success('Acesso removido');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover acesso: ${error.message}`);
    },
  });
}

// ============================================================================
// AUDIT LOGS
// ============================================================================

export function useCertAuditLogs(entityType?: string, entityId?: string) {
  return useQuery({
    queryKey: ['cert-audit-logs', entityType, entityId],
    queryFn: () => birthCertificateService.getAuditLogs(entityType, entityId),
  });
}

// ============================================================================
// SEARCH
// ============================================================================

export function useCertSearch(query: string) {
  return useQuery({
    queryKey: ['cert-search', query],
    queryFn: () => birthCertificateService.searchCertificates(query),
    enabled: query.length >= 2,
  });
}

// ============================================================================
// PROPOSAL LINKS
// ============================================================================

export function useActiveProposalLink(assetId: string | undefined) {
  return useQuery({
    queryKey: ['cert-proposal-link', assetId],
    queryFn: () => birthCertificateService.getActiveProposalLink(assetId!),
    enabled: !!assetId,
  });
}

export function useProposalLinksByCustomer(customerId: string | undefined) {
  return useQuery({
    queryKey: ['cert-proposal-links-customer', customerId],
    queryFn: () => birthCertificateService.getProposalLinksByCustomer(customerId!),
    enabled: !!customerId,
  });
}

export function useProposalLinkHistory(assetId: string | undefined) {
  return useQuery({
    queryKey: ['cert-proposal-link-history', assetId],
    queryFn: () => birthCertificateService.getProposalLinkHistory(assetId!),
    enabled: !!assetId,
  });
}

export function useLinkProposal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (params: {
      customer_id: string;
      asset_id: string;
      proposal_id: string;
      proposal_uuid?: string;
      proposal_status?: string;
      proposal_total?: number;
      proposal_term_months?: number;
      proposal_company?: string;
      snapshot_json: unknown;
      descricao?: string;
    }) => birthCertificateService.linkProposal(params, getAuditUser()),
    onSuccess: (_, { asset_id, customer_id }) => {
      queryClient.invalidateQueries({ queryKey: ['cert-proposal-link', asset_id] });
      queryClient.invalidateQueries({ queryKey: ['cert-proposal-links-customer', customer_id] });
      queryClient.invalidateQueries({ queryKey: ['cert-proposal-link-history', asset_id] });
      queryClient.invalidateQueries({ queryKey: ['cert-asset', asset_id] });
      toast.success('Proposta vinculada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao vincular proposta: ${error.message}`);
    },
  });
}

export function useUpdateProposalSnapshot() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ linkId, snapshot_json, additionalData }: {
      linkId: string;
      snapshot_json: unknown;
      assetId: string;
      additionalData?: {
        proposal_status?: string;
        proposal_total?: number;
        proposal_term_months?: number;
        proposal_company?: string;
      };
    }) => birthCertificateService.updateProposalSnapshot(linkId, snapshot_json, additionalData, getAuditUser()),
    onSuccess: (_, { assetId }) => {
      queryClient.invalidateQueries({ queryKey: ['cert-proposal-link', assetId] });
      queryClient.invalidateQueries({ queryKey: ['cert-proposal-link-history', assetId] });
      toast.success('Snapshot atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar snapshot: ${error.message}`);
    },
  });
}

export function useUnlinkProposal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ linkId, assetId }: { linkId: string; assetId: string; customerId?: string }) =>
      birthCertificateService.unlinkProposal(linkId, getAuditUser()).then(() => ({ assetId })),
    onSuccess: (_, { assetId, customerId }) => {
      queryClient.invalidateQueries({ queryKey: ['cert-proposal-link', assetId] });
      queryClient.invalidateQueries({ queryKey: ['cert-proposal-link-history', assetId] });
      if (customerId) {
        queryClient.invalidateQueries({ queryKey: ['cert-proposal-links-customer', customerId] });
      }
      toast.success('Proposta desvinculada');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao desvincular proposta: ${error.message}`);
    },
  });
}
