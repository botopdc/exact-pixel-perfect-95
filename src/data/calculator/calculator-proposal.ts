/** Status enum for calculator proposals */
export type ProposalStatus =
  | "Rascunho"
  | "Enviado"
  | "Aprovado"
  | "Recusado"
  | "Expirado"
  | "Cancelado";

/** Channel type for proposals */
export type ChannelType = "PARCEIRO" | "CLIENTE";

/** Server spec item in the API format */
export interface ServerSpec {
  /** ID from calculator_configs table */
  config_id: number;
  /** Quantity/value for this spec (e.g., vCPU count, RAM GB, etc.) */
  value?: number;
  /** Optional label for reference (cached from config) */
  label?: string;
  /** Optional unit price for reference */
  unit_price?: number;
  /** Optional total for reference */
  total?: number;
  /** Optional category for reference */
  category?: string;
  quantity?: number;
}

/** Server configuration in the API format */
export interface CalculatorProposalServer {
  /** Server name/description */
  name: string;
  /** Array of specs (resources) for this server */
  specs: ServerSpec[];
  /** Quantity of servers with this configuration */
  quantity: number;
  /** Calculated price (optional, backend calculates) */
  price?: number;
  /** Server type */
  type: "vm" | "baremetal";
}

/** Addon item in the API format */
export interface AddonItem {
  /** ID from calculator_configs table */
  config_id: number;
  /** Quantity of this addon */
  quantity: number;
  /** Calculated price (optional, backend calculates) */
  price?: number;
  /** Optional label for reference (cached from config) */
  label?: string;
}

/** User reference (minimal) */
export interface UserRef {
  id: number;
  name: string;
  email: string;
  level: number;
}

/** Calculator Proposal File */
export interface CalculatorProposalFile {
  id: number;
  proposal_id: number;
  file_path: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  created_at: string;
  updated_at: string;
}

/** Calculator Proposal - Full API response format */
export interface CalculatorProposal {
  /** Proposal ID (primary key) */
  id: number;

  /** Client information */
  name: string;
  company: string;
  phone: string;
  email: string;

  /** Proposal status */
  status: ProposalStatus;
  proposal_notes?: string;

  /** Channel information */
  channel_type: ChannelType;
  reseller_name?: string;
  commission_value?: number;
  commission_reason?: string;
  observations?: string;

  /** Pricing information */
  fx: number;
  datacenter: string;
  contract_duration: number;
  discount_pct: number;
  total: number;

  /** Configuration */
  addons?: AddonItem[];
  servers:  CalculatorProposalServer[];

  /** File information */
  file_path?: string;
  file_access_token?: string;

  /** Dates */
  due_at: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;

  /** Relationships */
  architect_id?: number;
  architect?: UserRef;
  created_by?: number;
  creator?: UserRef;
  files?: CalculatorProposalFile[];

}

/** Request format for creating a proposal */
export interface CreateProposalRequest {
  name: string;
  company: string;
  phone: string;
  email: string;
  channel_type: ChannelType;
  reseller_name?: string;
  commission_value?: number;
  commission_reason?: string;
  observations?: string;
  fx: number;
  datacenter: string;
  contract_duration: number;
  discount_pct: number;
  total: number;
  addons?: AddonItem[];
  servers: CalculatorProposalServer[];
  due_at: string;
  file?: File | Blob;
}
