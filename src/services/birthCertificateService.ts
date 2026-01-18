// ============================================================================
// BIRTH CERTIFICATE SERVICE
// Service layer for infrastructure documentation (Certidão de Nascimento)
// ============================================================================

import { supabase } from '@/integrations/supabase/client';
import type {
  CertCustomer,
  CertCustomerContact,
  CertAsset,
  CertAssetResources,
  CertAssetNetwork,
  CertAssetDisk,
  CertAssetLicense,
  CertAssetAccess,
  CertAuditLog,
  CertSearchResult,
} from '@/types/birthCertificate';

// ============================================================================
// AUDIT HELPER
// ============================================================================

async function logAudit(
  entityType: string,
  entityId: string,
  action: string,
  changes?: Record<string, unknown>,
  userId?: string,
  userName?: string,
  userLevel?: number
): Promise<void> {
  try {
    await supabase.from('cert_audit_logs').insert([{
      entity_type: entityType,
      entity_id: entityId,
      action,
      changes: changes ? JSON.parse(JSON.stringify(changes)) : null,
      user_id: userId || null,
      user_name: userName || null,
      user_level: userLevel || null,
    }]);
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
}

// ============================================================================
// CUSTOMERS
// ============================================================================

export async function getCustomers(): Promise<CertCustomer[]> {
  const { data, error } = await supabase
    .from('cert_customers')
    .select(`
      *,
      cert_assets(id)
    `)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((c: Record<string, unknown>) => ({
    ...c,
    asset_count: Array.isArray(c.cert_assets) ? c.cert_assets.length : 0,
  })) as CertCustomer[];
}

export async function getCustomer(id: string): Promise<CertCustomer | null> {
  const { data, error } = await supabase
    .from('cert_customers')
    .select(`
      *,
      cert_customer_contacts(*),
      cert_assets(*)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return {
    ...data,
    contacts: data.cert_customer_contacts || [],
    assets: data.cert_assets || [],
  } as CertCustomer;
}

export async function createCustomer(
  customer: Omit<CertCustomer, 'id' | 'created_at' | 'updated_at' | 'contacts' | 'assets' | 'asset_count'>,
  auditUser?: { id: string; name: string; level: number }
): Promise<CertCustomer> {
  const { data, error } = await supabase
    .from('cert_customers')
    .insert(customer)
    .select()
    .single();

  if (error) throw error;

  await logAudit(
    'customer',
    data.id,
    'CREATE',
    customer as Record<string, unknown>,
    auditUser?.id,
    auditUser?.name,
    auditUser?.level
  );

  return data as CertCustomer;
}

export async function updateCustomer(
  id: string,
  customer: Partial<CertCustomer>,
  auditUser?: { id: string; name: string; level: number }
): Promise<CertCustomer> {
  const { data, error } = await supabase
    .from('cert_customers')
    .update(customer)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await logAudit(
    'customer',
    id,
    'UPDATE',
    customer as Record<string, unknown>,
    auditUser?.id,
    auditUser?.name,
    auditUser?.level
  );

  return data as CertCustomer;
}

// ============================================================================
// CUSTOMER CONTACTS
// ============================================================================

export async function getCustomerContacts(customerId: string): Promise<CertCustomerContact[]> {
  const { data, error } = await supabase
    .from('cert_customer_contacts')
    .select('*')
    .eq('customer_id', customerId)
    .order('is_primary', { ascending: false });

  if (error) throw error;
  return data as CertCustomerContact[];
}

export async function createCustomerContact(
  contact: Omit<CertCustomerContact, 'id' | 'created_at'>
): Promise<CertCustomerContact> {
  const { data, error } = await supabase
    .from('cert_customer_contacts')
    .insert(contact)
    .select()
    .single();

  if (error) throw error;
  return data as CertCustomerContact;
}

export async function updateCustomerContact(
  id: string,
  contact: Partial<CertCustomerContact>
): Promise<CertCustomerContact> {
  const { data, error } = await supabase
    .from('cert_customer_contacts')
    .update(contact)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as CertCustomerContact;
}

export async function deleteCustomerContact(id: string): Promise<void> {
  const { error } = await supabase
    .from('cert_customer_contacts')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================================================
// ASSETS
// ============================================================================

export async function getAssets(customerId?: string): Promise<CertAsset[]> {
  let query = supabase
    .from('cert_assets')
    .select(`
      *,
      cert_customers(id, razao_social, nome_fantasia)
    `)
    .order('updated_at', { ascending: false });

  if (customerId) {
    query = query.eq('customer_id', customerId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((a: Record<string, unknown>) => ({
    ...a,
    customer: a.cert_customers,
  })) as CertAsset[];
}

export async function getAsset(id: string): Promise<CertAsset | null> {
  const { data, error } = await supabase
    .from('cert_assets')
    .select(`
      *,
      cert_customers(id, razao_social, nome_fantasia, cnpj, segmento, cidade, uf, tem_suporte, observacoes, created_at, updated_at),
      cert_asset_resources(*),
      cert_asset_network(*),
      cert_asset_disks(*),
      cert_asset_licenses(*),
      cert_asset_access(*)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) return null;

  return {
    ...data,
    customer: data.cert_customers,
    resources: Array.isArray(data.cert_asset_resources) 
      ? data.cert_asset_resources[0] 
      : data.cert_asset_resources,
    network: data.cert_asset_network || [],
    disks: data.cert_asset_disks || [],
    licenses: data.cert_asset_licenses || [],
    access: data.cert_asset_access || [],
  } as CertAsset;
}

export async function createAsset(
  asset: Omit<CertAsset, 'id' | 'created_at' | 'updated_at' | 'customer' | 'resources' | 'network' | 'disks' | 'licenses' | 'access'>,
  auditUser?: { id: string; name: string; level: number }
): Promise<CertAsset> {
  const { data, error } = await supabase
    .from('cert_assets')
    .insert(asset)
    .select()
    .single();

  if (error) throw error;

  // Create default resources record
  await supabase.from('cert_asset_resources').insert({
    asset_id: data.id,
    vcpu: 0,
    ram_gb: 0,
    backup_ativo: false,
    firewall_ativo: false,
  });

  await logAudit(
    'asset',
    data.id,
    'CREATE',
    asset as Record<string, unknown>,
    auditUser?.id,
    auditUser?.name,
    auditUser?.level
  );

  return data as CertAsset;
}

export async function updateAsset(
  id: string,
  asset: Partial<CertAsset>,
  auditUser?: { id: string; name: string; level: number }
): Promise<CertAsset> {
  const { data, error } = await supabase
    .from('cert_assets')
    .update(asset)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await logAudit(
    'asset',
    id,
    'UPDATE',
    asset as Record<string, unknown>,
    auditUser?.id,
    auditUser?.name,
    auditUser?.level
  );

  return data as CertAsset;
}

// ============================================================================
// ASSET RESOURCES
// ============================================================================

export async function updateAssetResources(
  assetId: string,
  resources: Partial<CertAssetResources>,
  auditUser?: { id: string; name: string; level: number }
): Promise<CertAssetResources> {
  // Check if exists
  const { data: existing } = await supabase
    .from('cert_asset_resources')
    .select('id')
    .eq('asset_id', assetId)
    .single();

  let data;
  let error;

  if (existing) {
    const result = await supabase
      .from('cert_asset_resources')
      .update(resources)
      .eq('asset_id', assetId)
      .select()
      .single();
    data = result.data;
    error = result.error;
  } else {
    const result = await supabase
      .from('cert_asset_resources')
      .insert({ asset_id: assetId, ...resources })
      .select()
      .single();
    data = result.data;
    error = result.error;
  }

  if (error) throw error;

  await logAudit(
    'asset_resources',
    assetId,
    existing ? 'UPDATE' : 'CREATE',
    resources as Record<string, unknown>,
    auditUser?.id,
    auditUser?.name,
    auditUser?.level
  );

  return data as CertAssetResources;
}

// ============================================================================
// ASSET NETWORK
// ============================================================================

export async function createAssetNetwork(
  network: Omit<CertAssetNetwork, 'id' | 'created_at'>,
  auditUser?: { id: string; name: string; level: number }
): Promise<CertAssetNetwork> {
  const { data, error } = await supabase
    .from('cert_asset_network')
    .insert(network)
    .select()
    .single();

  if (error) throw error;

  await logAudit(
    'asset_network',
    data.id,
    'CREATE',
    network as Record<string, unknown>,
    auditUser?.id,
    auditUser?.name,
    auditUser?.level
  );

  return data as CertAssetNetwork;
}

export async function updateAssetNetwork(
  id: string,
  network: Partial<CertAssetNetwork>
): Promise<CertAssetNetwork> {
  const { data, error } = await supabase
    .from('cert_asset_network')
    .update(network)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as CertAssetNetwork;
}

export async function deleteAssetNetwork(id: string): Promise<void> {
  const { error } = await supabase
    .from('cert_asset_network')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================================================
// ASSET DISKS
// ============================================================================

export async function createAssetDisk(
  disk: Omit<CertAssetDisk, 'id' | 'created_at'>,
  auditUser?: { id: string; name: string; level: number }
): Promise<CertAssetDisk> {
  const { data, error } = await supabase
    .from('cert_asset_disks')
    .insert(disk)
    .select()
    .single();

  if (error) throw error;

  await logAudit(
    'asset_disk',
    data.id,
    'CREATE',
    disk as Record<string, unknown>,
    auditUser?.id,
    auditUser?.name,
    auditUser?.level
  );

  return data as CertAssetDisk;
}

export async function updateAssetDisk(
  id: string,
  disk: Partial<CertAssetDisk>
): Promise<CertAssetDisk> {
  const { data, error } = await supabase
    .from('cert_asset_disks')
    .update(disk)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as CertAssetDisk;
}

export async function deleteAssetDisk(id: string): Promise<void> {
  const { error } = await supabase
    .from('cert_asset_disks')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================================================
// ASSET LICENSES
// ============================================================================

export async function createAssetLicense(
  license: Omit<CertAssetLicense, 'id' | 'created_at'>,
  auditUser?: { id: string; name: string; level: number }
): Promise<CertAssetLicense> {
  const { data, error } = await supabase
    .from('cert_asset_licenses')
    .insert(license)
    .select()
    .single();

  if (error) throw error;

  await logAudit(
    'asset_license',
    data.id,
    'CREATE',
    license as Record<string, unknown>,
    auditUser?.id,
    auditUser?.name,
    auditUser?.level
  );

  return data as CertAssetLicense;
}

export async function updateAssetLicense(
  id: string,
  license: Partial<CertAssetLicense>
): Promise<CertAssetLicense> {
  const { data, error } = await supabase
    .from('cert_asset_licenses')
    .update(license)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as CertAssetLicense;
}

export async function deleteAssetLicense(id: string): Promise<void> {
  const { error } = await supabase
    .from('cert_asset_licenses')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================================================
// ASSET ACCESS
// ============================================================================

export async function createAssetAccess(
  access: Omit<CertAssetAccess, 'id' | 'created_at' | 'updated_at'>,
  auditUser?: { id: string; name: string; level: number }
): Promise<CertAssetAccess> {
  const { data, error } = await supabase
    .from('cert_asset_access')
    .insert(access)
    .select()
    .single();

  if (error) throw error;

  await logAudit(
    'asset_access',
    data.id,
    'CREATE',
    { ...access, senha_ref: '[REDACTED]' } as Record<string, unknown>,
    auditUser?.id,
    auditUser?.name,
    auditUser?.level
  );

  return data as CertAssetAccess;
}

export async function updateAssetAccess(
  id: string,
  access: Partial<CertAssetAccess>,
  auditUser?: { id: string; name: string; level: number }
): Promise<CertAssetAccess> {
  const { data, error } = await supabase
    .from('cert_asset_access')
    .update(access)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await logAudit(
    'asset_access',
    id,
    'UPDATE',
    { ...access, senha_ref: access.senha_ref ? '[REDACTED]' : undefined } as Record<string, unknown>,
    auditUser?.id,
    auditUser?.name,
    auditUser?.level
  );

  return data as CertAssetAccess;
}

export async function deleteAssetAccess(
  id: string,
  auditUser?: { id: string; name: string; level: number }
): Promise<void> {
  await logAudit(
    'asset_access',
    id,
    'DELETE',
    undefined,
    auditUser?.id,
    auditUser?.name,
    auditUser?.level
  );

  const { error } = await supabase
    .from('cert_asset_access')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================================================
// AUDIT LOGS
// ============================================================================

export async function getAuditLogs(
  entityType?: string,
  entityId?: string
): Promise<CertAuditLog[]> {
  let query = supabase
    .from('cert_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (entityType) {
    query = query.eq('entity_type', entityType);
  }
  if (entityId) {
    query = query.eq('entity_id', entityId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as CertAuditLog[];
}

// ============================================================================
// SEARCH
// ============================================================================

export async function searchCertificates(query: string): Promise<CertSearchResult[]> {
  const results: CertSearchResult[] = [];
  const searchTerm = `%${query}%`;

  // Search customers
  const { data: customers } = await supabase
    .from('cert_customers')
    .select('id, razao_social, nome_fantasia, cnpj, cidade, uf')
    .or(`razao_social.ilike.${searchTerm},nome_fantasia.ilike.${searchTerm},cnpj.ilike.${searchTerm}`)
    .limit(10);

  if (customers) {
    for (const c of customers) {
      results.push({
        type: 'customer',
        id: c.id,
        title: c.nome_fantasia || c.razao_social,
        subtitle: [c.cnpj, c.cidade, c.uf].filter(Boolean).join(' | '),
      });
    }
  }

  // Search assets by code or IP
  const { data: assets } = await supabase
    .from('cert_assets')
    .select(`
      id, asset_code, hostname, customer_id,
      cert_customers(razao_social, nome_fantasia)
    `)
    .or(`asset_code.ilike.${searchTerm},hostname.ilike.${searchTerm}`)
    .limit(10);

  if (assets) {
    for (const a of assets) {
      const customer = a.cert_customers as { razao_social: string; nome_fantasia: string | null } | null;
      results.push({
        type: 'asset',
        id: a.id,
        title: a.asset_code,
        subtitle: customer?.nome_fantasia || customer?.razao_social || 'Cliente desconhecido',
        customer_id: a.customer_id,
      });
    }
  }

  // Search by IP
  const { data: networks } = await supabase
    .from('cert_asset_network')
    .select(`
      id, ip_address, asset_id,
      cert_assets(id, asset_code, customer_id, cert_customers(razao_social, nome_fantasia))
    `)
    .ilike('ip_address', searchTerm)
    .limit(10);

  if (networks) {
    for (const n of networks) {
      const asset = n.cert_assets as { 
        id: string; 
        asset_code: string; 
        customer_id: string;
        cert_customers: { razao_social: string; nome_fantasia: string | null } | null;
      } | null;
      if (asset && !results.some(r => r.id === asset.id)) {
        results.push({
          type: 'asset',
          id: asset.id,
          title: `${asset.asset_code} (${n.ip_address})`,
          subtitle: asset.cert_customers?.nome_fantasia || asset.cert_customers?.razao_social || '',
          customer_id: asset.customer_id,
        });
      }
    }
  }

  return results;
}
// ============================================================================
// PROPOSAL LINKS
// ============================================================================

export interface CertProposalLink {
  id: string;
  customer_id: string;
  asset_id: string | null;
  proposal_id: string;
  proposal_uuid: string | null;
  proposal_status: string | null;
  proposal_total: number | null;
  proposal_term_months: number | null;
  proposal_company: string | null;
  snapshot_json: unknown | null;
  descricao: string | null;
  imported_at: string;
  updated_at: string;
  is_active: boolean;
  created_at: string;
}

export async function getActiveProposalLink(assetId: string): Promise<CertProposalLink | null> {
  const { data, error } = await supabase
    .from('cert_proposal_links')
    .select('*')
    .eq('asset_id', assetId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  return data as CertProposalLink | null;
}

export async function getProposalLinksByCustomer(customerId: string): Promise<CertProposalLink[]> {
  const { data, error } = await supabase
    .from('cert_proposal_links')
    .select('*')
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data || []) as CertProposalLink[];
}

export async function getProposalLinkHistory(assetId: string): Promise<CertProposalLink[]> {
  const { data, error } = await supabase
    .from('cert_proposal_links')
    .select('*')
    .eq('asset_id', assetId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data || []) as CertProposalLink[];
}

export async function linkProposal(
  params: {
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
  },
  auditUser?: { id: string; name: string; level: number }
): Promise<CertProposalLink> {
  // Desativar link anterior se existir
  await supabase
    .from('cert_proposal_links')
    .update({ is_active: false })
    .eq('asset_id', params.asset_id)
    .eq('is_active', true);

  // Criar novo link
  const { data, error } = await supabase
    .from('cert_proposal_links')
    .insert([{
      customer_id: params.customer_id,
      asset_id: params.asset_id,
      proposal_id: params.proposal_id,
      proposal_uuid: params.proposal_uuid || null,
      proposal_status: params.proposal_status || null,
      proposal_total: params.proposal_total || null,
      proposal_term_months: params.proposal_term_months || null,
      proposal_company: params.proposal_company || null,
      snapshot_json: params.snapshot_json as any,
      descricao: params.descricao || null,
      is_active: true,
    }])
    .select()
    .single();

  if (error) throw error;

  await logAudit(
    'proposal_link',
    data.id,
    'LINK_PROPOSAL',
    { proposal_id: params.proposal_id, asset_id: params.asset_id },
    auditUser?.id,
    auditUser?.name,
    auditUser?.level
  );

  return data as CertProposalLink;
}

export async function updateProposalSnapshot(
  linkId: string,
  snapshot_json: unknown,
  additionalData?: {
    proposal_status?: string;
    proposal_total?: number;
    proposal_term_months?: number;
    proposal_company?: string;
  },
  auditUser?: { id: string; name: string; level: number }
): Promise<CertProposalLink> {
  const { data, error } = await supabase
    .from('cert_proposal_links')
    .update({
      snapshot_json: snapshot_json as any,
      ...additionalData,
    })
    .eq('id', linkId)
    .select()
    .single();

  if (error) throw error;

  await logAudit(
    'proposal_link',
    linkId,
    'UPDATE_PROPOSAL_SNAPSHOT',
    { updated: true },
    auditUser?.id,
    auditUser?.name,
    auditUser?.level
  );

  return data as CertProposalLink;
}

export async function unlinkProposal(
  linkId: string,
  auditUser?: { id: string; name: string; level: number }
): Promise<void> {
  const { error } = await supabase
    .from('cert_proposal_links')
    .update({ is_active: false })
    .eq('id', linkId);

  if (error) throw error;

  await logAudit(
    'proposal_link',
    linkId,
    'UNLINK_PROPOSAL',
    { is_active: false },
    auditUser?.id,
    auditUser?.name,
    auditUser?.level
  );
}

// Export service object
export const birthCertificateService = {
  // Customers
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  // Contacts
  getCustomerContacts,
  createCustomerContact,
  updateCustomerContact,
  deleteCustomerContact,
  // Assets
  getAssets,
  getAsset,
  createAsset,
  updateAsset,
  // Resources
  updateAssetResources,
  // Network
  createAssetNetwork,
  updateAssetNetwork,
  deleteAssetNetwork,
  // Disks
  createAssetDisk,
  updateAssetDisk,
  deleteAssetDisk,
  // Licenses
  createAssetLicense,
  updateAssetLicense,
  deleteAssetLicense,
  // Access
  createAssetAccess,
  updateAssetAccess,
  deleteAssetAccess,
  // Audit
  getAuditLogs,
  // Search
  searchCertificates,
  // Proposal Links
  getActiveProposalLink,
  getProposalLinksByCustomer,
  getProposalLinkHistory,
  linkProposal,
  updateProposalSnapshot,
  unlinkProposal,
};
