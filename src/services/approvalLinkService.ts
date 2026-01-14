/**
 * Approval Link Service
 * 
 * Centralized service for building approval links with robust error handling.
 * Validates proposal existence before fetching token, handles identifier fallback,
 * and provides detailed error messages for debugging.
 */

import { openApi } from '@/lib/openApi';
import { ROUTES } from '@/config/routes';

// Re-export API_BASE_URL for debug purposes
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://apiv2.opendata.center/api';

export interface BuildApprovalLinkOptions {
  /** The proposal object with id and/or uuid */
  proposal: {
    id?: number | string;
    uuid?: string;
  };
}

export interface BuildApprovalLinkResult {
  link: string;
  identifier: string;
  token: string;
}

export class ApprovalLinkError extends Error {
  public readonly debugInfo: {
    baseUrl: string;
    primaryIdentifier: string | null;
    secondaryIdentifier: string | null;
    stage: 'identifier' | 'validation' | 'token';
  };

  constructor(
    message: string,
    debugInfo: ApprovalLinkError['debugInfo']
  ) {
    super(message);
    this.name = 'ApprovalLinkError';
    this.debugInfo = debugInfo;
  }
}

/**
 * Resolve primary and secondary identifiers from proposal
 */
function resolveIdentifiers(proposal: BuildApprovalLinkOptions['proposal']): {
  primary: string | null;
  secondary: string | null;
} {
  const hasUuid = typeof proposal.uuid === 'string' && proposal.uuid.trim() !== '';
  const hasId = proposal.id !== undefined && proposal.id !== null;

  let primary: string | null = null;
  let secondary: string | null = null;

  if (hasUuid) {
    primary = proposal.uuid!.trim();
    if (hasId) {
      secondary = String(proposal.id);
    }
  } else if (hasId) {
    primary = String(proposal.id);
    // No secondary if only id exists
  }

  return { primary, secondary };
}

/**
 * Attempt to fetch a proposal by identifier to validate it exists
 * Returns the proposal data or null if not found
 */
async function validateProposalExists(identifier: string): Promise<{ id: number; uuid?: string } | null> {
  try {
    console.log('[approvalLinkService] Validating proposal existence:', identifier);
    const proposal = await openApi.getProposal(identifier) as { id: number; uuid?: string } | null;
    if (!proposal || typeof proposal.id !== 'number') {
      console.log('[approvalLinkService] Invalid proposal response');
      return null;
    }
    console.log('[approvalLinkService] Proposal found:', proposal.id);
    return { 
      id: proposal.id, 
      uuid: typeof proposal.uuid === 'string' ? proposal.uuid : undefined 
    };
  } catch (err: any) {
    if (err.response?.status === 404) {
      console.log('[approvalLinkService] Proposal not found for identifier:', identifier);
      return null;
    }
    // Re-throw other errors (network issues, etc.)
    throw err;
  }
}

/**
 * Attempt to fetch approval token for a given identifier
 * Returns the token or null if endpoint returns 404
 */
async function fetchApprovalToken(identifier: string): Promise<string | null> {
  try {
    console.log('[approvalLinkService] Fetching approval token for:', identifier);
    const { token } = await openApi.getProposalApprovalToken(identifier);
    console.log('[approvalLinkService] Got token:', token.substring(0, 8) + '...');
    return token;
  } catch (err: any) {
    if (err.response?.status === 404) {
      console.log('[approvalLinkService] Token endpoint 404 for identifier:', identifier);
      return null;
    }
    // Re-throw other errors
    throw err;
  }
}

/**
 * Build approval link with full validation and fallback logic
 * 
 * Flow:
 * 1. Resolve identifiers (uuid preferred, fallback to id)
 * 2. Validate proposal exists with primary identifier
 * 3. If 404, try secondary identifier (if available)
 * 4. Fetch approval token for the working identifier
 * 5. If 404, try alternative identifier (if available)
 * 6. Construct full URL with token
 * 
 * @throws ApprovalLinkError with detailed debug info on failure
 */
export async function buildApprovalLink(
  options: BuildApprovalLinkOptions
): Promise<BuildApprovalLinkResult> {
  const { primary, secondary } = resolveIdentifiers(options.proposal);

  // Stage: identifier - Check if we have at least one identifier
  if (!primary) {
    throw new ApprovalLinkError(
      'Proposta sem id/uuid no objeto',
      {
        baseUrl: API_BASE_URL,
        primaryIdentifier: null,
        secondaryIdentifier: null,
        stage: 'identifier',
      }
    );
  }

  console.log('[approvalLinkService] Starting buildApprovalLink:', {
    primary,
    secondary,
    baseUrl: API_BASE_URL,
  });

  // Stage: validation - Validate proposal exists
  let workingIdentifier: string = primary;
  let validatedProposal = await validateProposalExists(primary);

  if (!validatedProposal && secondary) {
    console.log('[approvalLinkService] Trying secondary identifier for validation:', secondary);
    validatedProposal = await validateProposalExists(secondary);
    if (validatedProposal) {
      workingIdentifier = secondary;
    }
  }

  if (!validatedProposal) {
    throw new ApprovalLinkError(
      `Proposta não encontrada neste ambiente (identificador: ${primary}${secondary ? ` / ${secondary}` : ''})`,
      {
        baseUrl: API_BASE_URL,
        primaryIdentifier: primary,
        secondaryIdentifier: secondary,
        stage: 'validation',
      }
    );
  }

  // Stage: token - Fetch approval token
  let token = await fetchApprovalToken(workingIdentifier);

  // If token failed with working identifier, try the other one
  if (!token && secondary && workingIdentifier === primary) {
    console.log('[approvalLinkService] Trying secondary identifier for token:', secondary);
    // First validate secondary exists
    const secondaryProposal = await validateProposalExists(secondary);
    if (secondaryProposal) {
      token = await fetchApprovalToken(secondary);
      if (token) {
        workingIdentifier = secondary;
        validatedProposal = secondaryProposal;
      }
    }
  } else if (!token && secondary && workingIdentifier === secondary) {
    // Try primary for token
    console.log('[approvalLinkService] Trying primary identifier for token:', primary);
    token = await fetchApprovalToken(primary);
    if (token) {
      workingIdentifier = primary;
    }
  }

  if (!token) {
    throw new ApprovalLinkError(
      `Endpoint approval-token indisponível ou rota não publicada neste ambiente (BASE_URL: ${API_BASE_URL}, identifier: ${workingIdentifier})`,
      {
        baseUrl: API_BASE_URL,
        primaryIdentifier: primary,
        secondaryIdentifier: secondary,
        stage: 'token',
      }
    );
  }

  // Build the full URL
  const baseUrl = window.location.origin;
  // Use numeric ID in the link for consistency with define-acceptance which requires integer
  const linkIdentifier = String(validatedProposal.id);
  const relativePath = ROUTES.public.proposalApprove(linkIdentifier, token);
  const fullUrl = `${baseUrl}${relativePath}`;

  console.log('[approvalLinkService] Built approval link:', {
    identifier: linkIdentifier,
    tokenPrefix: token.substring(0, 8) + '...',
  });

  return {
    link: fullUrl,
    identifier: linkIdentifier,
    token,
  };
}

/**
 * Convenience function to build link from just id or uuid
 */
export async function buildApprovalLinkFromId(
  idOrUuid: string | number
): Promise<BuildApprovalLinkResult> {
  // Determine if it's a UUID (contains dashes) or numeric ID
  const strValue = String(idOrUuid);
  const isUuid = strValue.includes('-');

  return buildApprovalLink({
    proposal: isUuid
      ? { uuid: strValue }
      : { id: idOrUuid },
  });
}
