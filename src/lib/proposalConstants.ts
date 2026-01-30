/**
 * Proposal Constants - Centralized enum values per OpenAPI spec
 * 
 * CRITICAL: All status values MUST match exactly what the API expects.
 * Source: api-docs-29-jan-26.json (DefineProposalAcceptanceRequest, CalculatorProposal schemas)
 */

// ============================================================================
// STATUS ENUMS - Per OpenAPI DefineProposalAcceptanceRequest schema
// ============================================================================

/**
 * Acceptance status values for define-acceptance endpoint
 * CRITICAL: Use "Recusado" NOT "Reprovado" per API spec
 */
export const PROPOSAL_ACCEPTANCE_STATUS = {
  APPROVED: 'Aprovado' as const,
  REJECTED: 'Recusado' as const, // NOT "Reprovado"!
} as const;

export type ProposalAcceptanceStatus = typeof PROPOSAL_ACCEPTANCE_STATUS[keyof typeof PROPOSAL_ACCEPTANCE_STATUS];

/**
 * All valid proposal statuses per CalculatorProposal schema
 */
export const PROPOSAL_STATUS = {
  DRAFT: 'Rascunho' as const,
  SENT: 'Enviado' as const,
  APPROVED: 'Aprovado' as const,
  REJECTED: 'Recusado' as const, // NOT "Reprovado"!
  EXPIRED: 'Expirado' as const,
  CANCELLED: 'Cancelado' as const,
} as const;

export type ProposalStatus = typeof PROPOSAL_STATUS[keyof typeof PROPOSAL_STATUS];

/**
 * Channel types for proposals
 */
export const CHANNEL_TYPE = {
  PARTNER: 'PARCEIRO' as const,
  CLIENT: 'CLIENTE' as const,
} as const;

export type ChannelType = typeof CHANNEL_TYPE[keyof typeof CHANNEL_TYPE];

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Check if a status is a valid acceptance status
 */
export function isValidAcceptanceStatus(status: string): status is ProposalAcceptanceStatus {
  return status === PROPOSAL_ACCEPTANCE_STATUS.APPROVED || 
         status === PROPOSAL_ACCEPTANCE_STATUS.REJECTED;
}

/**
 * Normalize status for backwards compatibility
 * Converts legacy "Reprovado" to correct "Recusado"
 */
export function normalizeAcceptanceStatus(status: string): ProposalAcceptanceStatus {
  // Handle legacy "Reprovado" → "Recusado"
  if (status === 'Reprovado') {
    console.warn('[normalizeAcceptanceStatus] Converting legacy "Reprovado" to "Recusado"');
    return PROPOSAL_ACCEPTANCE_STATUS.REJECTED;
  }
  
  if (status === 'Aprovado') {
    return PROPOSAL_ACCEPTANCE_STATUS.APPROVED;
  }
  
  // Default to rejected for safety
  return PROPOSAL_ACCEPTANCE_STATUS.REJECTED;
}

// ============================================================================
// SERVER VALIDATION - Per OpenAPI spec requirements
// ============================================================================

/**
 * Minimum requirements for virtual servers per OpenAPI spec
 */
export const SERVER_MINIMUMS = {
  VCPU: 1,
  RAM_GB: 1,
  MIN_SERVERS: 1,
} as const;

/**
 * Validates a server item meets minimum requirements
 * Returns an object with validated values (enforcing minimums)
 */
export function validateServerMinimums(server: {
  vcpu?: number;
  ram?: number;
  type?: 'vm' | 'bm';
}): { vcpu: number; ram: number; isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  // Only enforce minimums for VMs, not BareMetal
  if (server.type === 'bm') {
    return { vcpu: 0, ram: 0, isValid: true, warnings: [] };
  }
  
  const vcpu = Math.max(SERVER_MINIMUMS.VCPU, server.vcpu || 0);
  const ram = Math.max(SERVER_MINIMUMS.RAM_GB, server.ram || 0);
  
  if ((server.vcpu || 0) < SERVER_MINIMUMS.VCPU) {
    warnings.push(`vCPU must be at least ${SERVER_MINIMUMS.VCPU}, got ${server.vcpu}`);
  }
  
  if ((server.ram || 0) < SERVER_MINIMUMS.RAM_GB) {
    warnings.push(`RAM must be at least ${SERVER_MINIMUMS.RAM_GB}GB, got ${server.ram}`);
  }
  
  return {
    vcpu,
    ram,
    isValid: warnings.length === 0,
    warnings,
  };
}

/**
 * Validates that a proposal has at least one server
 * (required by API - use virtual servers for independent products)
 */
export function validateServersArray(servers: unknown[]): boolean {
  return Array.isArray(servers) && servers.length >= SERVER_MINIMUMS.MIN_SERVERS;
}
