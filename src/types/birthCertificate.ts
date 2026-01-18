// ============================================================================
// BIRTH CERTIFICATE (Certidão de Nascimento) - Types
// Infrastructure documentation for support team (level >= 900)
// ============================================================================

// Enums matching database
export type CertAssetType = 'VM' | 'BAREMETAL' | 'GPU' | 'KUBERNETES' | 'STORAGE' | 'FIREWALL' | 'LOAD_BALANCER';
export type CertAssetStatus = 'ATIVO' | 'MANUTENCAO' | 'DESLIGADO' | 'PROVISIONANDO';
export type CertDatacenter = 'DC1_SP' | 'DC2_SP' | 'DC3_RJ' | 'CLOUD_AWS' | 'CLOUD_GCP' | 'CLOUD_AZURE';

// Labels for UI display
export const CERT_ASSET_TYPE_LABELS: Record<CertAssetType, string> = {
  VM: 'Máquina Virtual',
  BAREMETAL: 'Bare Metal',
  GPU: 'GPU Server',
  KUBERNETES: 'Kubernetes',
  STORAGE: 'Storage',
  FIREWALL: 'Firewall',
  LOAD_BALANCER: 'Load Balancer',
};

export const CERT_ASSET_STATUS_LABELS: Record<CertAssetStatus, string> = {
  ATIVO: 'Ativo',
  MANUTENCAO: 'Em Manutenção',
  DESLIGADO: 'Desligado',
  PROVISIONANDO: 'Provisionando',
};

export const CERT_ASSET_STATUS_COLORS: Record<CertAssetStatus, string> = {
  ATIVO: 'bg-green-500/20 text-green-400 border-green-500/30',
  MANUTENCAO: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  DESLIGADO: 'bg-red-500/20 text-red-400 border-red-500/30',
  PROVISIONANDO: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

export const CERT_DATACENTER_LABELS: Record<CertDatacenter, string> = {
  DC1_SP: 'DC1 São Paulo',
  DC2_SP: 'DC2 São Paulo',
  DC3_RJ: 'DC3 Rio de Janeiro',
  CLOUD_AWS: 'AWS Cloud',
  CLOUD_GCP: 'Google Cloud',
  CLOUD_AZURE: 'Azure Cloud',
};

// Customer entity
export interface CertCustomer {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  segmento: string | null;
  cidade: string | null;
  uf: string | null;
  tem_suporte: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  // Computed/joined
  contacts?: CertCustomerContact[];
  assets?: CertAsset[];
  asset_count?: number;
}

// Customer contact
export interface CertCustomerContact {
  id: string;
  customer_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cargo: string | null;
  is_primary: boolean;
  created_at: string;
}

// Asset entity
export interface CertAsset {
  id: string;
  customer_id: string;
  asset_code: string;
  tipo: CertAssetType;
  datacenter: CertDatacenter;
  sistema_operacional: string | null;
  status: CertAssetStatus;
  hostname: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  customer?: CertCustomer;
  resources?: CertAssetResources;
  network?: CertAssetNetwork[];
  disks?: CertAssetDisk[];
  licenses?: CertAssetLicense[];
  access?: CertAssetAccess[];
}

// Asset resources (CPU, RAM, backup)
export interface CertAssetResources {
  id: string;
  asset_id: string;
  vcpu: number;
  ram_gb: number;
  backup_ativo: boolean;
  backup_retencao_dias: number | null;
  backup_janela: string | null;
  firewall_ativo: boolean;
  servicos_adicionais: string[] | null;
  created_at: string;
  updated_at: string;
}

// Asset network/IPs
export interface CertAssetNetwork {
  id: string;
  asset_id: string;
  ip_address: string;
  tipo: string;
  is_primary: boolean;
  vlan: string | null;
  descricao: string | null;
  created_at: string;
}

// Asset disks
export interface CertAssetDisk {
  id: string;
  asset_id: string;
  tamanho_gb: number;
  tipo: string;
  mount_point: string | null;
  label: string | null;
  created_at: string;
}

// Asset licenses
export interface CertAssetLicense {
  id: string;
  asset_id: string;
  descricao: string;
  quantidade: number;
  validade: string | null;
  created_at: string;
}

// Asset access credentials
export interface CertAssetAccess {
  id: string;
  asset_id: string;
  tipo: string;
  host: string | null;
  porta: number | null;
  usuario: string | null;
  senha_ref: string | null;
  instrucoes: string | null;
  created_at: string;
  updated_at: string;
}

// Proposal links
export interface CertProposalLink {
  id: string;
  customer_id: string;
  proposal_id: string;
  descricao: string | null;
  created_at: string;
}

// Audit logs
export interface CertAuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  changes: Record<string, unknown> | null;
  user_id: string | null;
  user_name: string | null;
  user_level: number | null;
  created_at: string;
}

// Search result for unified search
export interface CertSearchResult {
  type: 'customer' | 'asset';
  id: string;
  title: string;
  subtitle: string;
  customer_id?: string;
}

// Access type options
export const CERT_ACCESS_TYPES = [
  { value: 'SSH', label: 'SSH' },
  { value: 'RDP', label: 'Remote Desktop (RDP)' },
  { value: 'VNC', label: 'VNC' },
  { value: 'CONSOLE', label: 'Console (IPMI/iLO)' },
  { value: 'API', label: 'API' },
  { value: 'WEB', label: 'Web Panel' },
  { value: 'OUTRO', label: 'Outro' },
];

// Disk type options
export const CERT_DISK_TYPES = [
  { value: 'SSD', label: 'SSD' },
  { value: 'NVMe', label: 'NVMe' },
  { value: 'HDD', label: 'HDD' },
  { value: 'SAN', label: 'SAN' },
  { value: 'NFS', label: 'NFS' },
];
