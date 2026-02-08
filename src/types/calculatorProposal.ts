/**
 * Types for Calculator Proposals stored in Supabase
 * These types are the source of truth for the local proposal system
 */

// ============================================================================
// DATABASE ROW TYPES (match Supabase schema)
// ============================================================================

export interface CalculatorProposalRow {
  id: string; // UUID
  external_id?: number | null;
  display_id?: string | null;
  name: string;
  company: string;
  phone: string;
  email: string;
  status: string;
  channel_type: 'PARCEIRO' | 'CLIENTE';
  reseller_name?: string | null;
  commission_value?: number | null;
  commission_reason?: string | null;
  observations?: string | null;
  fx: number;
  datacenter: string;
  contract_duration: number;
  discount_pct: number;
  total: number;
  due_at: string;
  currency: string;
  pdf_path?: string | null;
  pdf_generated_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalculatorProposalServerRow {
  id: string;
  proposal_id: string;
  server_type: 'vm' | 'bm' | 'storage';
  name: string;
  gpu?: string | null;
  gpu_qty: number;
  vcpu: number;
  ram_gb: number;
  nvme_tb: number;
  traffic_tb: number;
  ips: number;
  qty_servers: number;
  bm_cpu?: string | null;
  bm_ram?: string | null;
  disks?: any | null; // JSONB
  storage_type?: string | null;
  storage_region?: string | null;
  volume_tb?: number | null;
  unit_price: number;
  total_price: number;
  sort_order: number;
  specs?: any | null; // JSONB
  created_at: string;
}

export interface CalculatorProposalAddonRow {
  id: string;
  proposal_id: string;
  addon_key: string;
  label: string;
  enabled: boolean;
  quantity: number;
  unit_price: number;
  total_price: number;
  sort_order: number;
  metadata?: any | null; // JSONB
  created_at: string;
}

export interface CalculatorProposalFileRow {
  id: string;
  proposal_id: string;
  file_path: string;
  file_type: string;
  file_name?: string | null;
  created_at: string;
}

// ============================================================================
// COMPOSITE TYPES (for full proposal with relations)
// ============================================================================

export interface CalculatorProposalWithRelations extends CalculatorProposalRow {
  servers?: CalculatorProposalServerRow[];
  addons?: CalculatorProposalAddonRow[];
  files?: CalculatorProposalFileRow[];
}

// ============================================================================
// RPC PAYLOAD TYPES (for save_calculator_proposal function)
// ============================================================================

export interface SaveProposalPayload {
  proposal: {
    id?: string; // UUID for update, undefined for insert
    display_id?: string;
    name: string;
    company: string;
    phone: string;
    email: string;
    status?: string;
    channel_type: 'PARCEIRO' | 'CLIENTE';
    reseller_name?: string | null;
    commission_value?: number | null;
    commission_reason?: string | null;
    observations?: string | null;
    fx: number;
    datacenter: string;
    contract_duration: number;
    discount_pct: number;
    total: number;
    due_at: string;
    currency?: string;
  };
  servers: SaveProposalServer[];
  addons: SaveProposalAddon[];
}

export interface SaveProposalServer {
  server_type: 'vm' | 'bm' | 'storage';
  type?: string; // Alias for server_type (frontend compatibility)
  name?: string;
  gpu?: string | null;
  gpu_qty?: number;
  gpuQty?: number; // Alias
  vcpu?: number;
  ram_gb?: number;
  ramGb?: number; // Alias
  nvme_tb?: number;
  nvmeTb?: number; // Alias
  traffic_tb?: number;
  trafficTb?: number; // Alias
  ips?: number;
  qty_servers?: number;
  qtyServers?: number; // Alias
  bm_cpu?: string | null;
  bmCpu?: string; // Alias
  bm_ram?: string | null;
  bmRam?: string; // Alias
  disks?: any;
  storage_type?: string | null;
  storageType?: string; // Alias
  storage_region?: string | null;
  region?: string; // Alias
  volume_tb?: number | null;
  volumeTB?: number; // Alias
  unit_price?: number;
  total_price?: number;
  specs?: any;
}

export interface SaveProposalAddon {
  addon_key: string;
  key?: string; // Alias
  label: string;
  enabled: boolean;
  quantity: number;
  unit_price?: number;
  total_price?: number;
  metadata?: any;
}

// ============================================================================
// LIST/FILTER TYPES
// ============================================================================

export interface ProposalListFilters {
  status?: string;
  search?: string;
  channel_type?: 'PARCEIRO' | 'CLIENTE';
  created_by?: string;
  limit?: number;
  offset?: number;
}

export interface ProposalListResult {
  proposals: CalculatorProposalRow[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}
