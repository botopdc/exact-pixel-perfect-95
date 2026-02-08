/**
 * Supabase Full Proposal Fetcher
 * 
 * Fetches a proposal with all relations (servers, addons, files) from Supabase.
 * Used by the unified PDF generator to ensure complete data.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  CalculatorProposalRow,
  CalculatorProposalServerRow,
  CalculatorProposalAddonRow,
  CalculatorProposalFileRow,
  CalculatorProposalWithRelations,
} from '@/types/calculatorProposal';

export interface ProposalFull extends CalculatorProposalWithRelations {
  // Explicit arrays for type safety
  servers: CalculatorProposalServerRow[];
  addons: CalculatorProposalAddonRow[];
  files: CalculatorProposalFileRow[];
}

/**
 * Fetch a complete proposal with all relations from Supabase
 * 
 * @param proposalId - UUID of the proposal
 * @returns ProposalFull with servers, addons, and files arrays (never undefined)
 * @throws Error if proposal not found or fetch fails
 */
export async function fetchFullProposal(proposalId: string): Promise<ProposalFull> {
  console.log('[fetchFullProposal] Fetching proposal:', proposalId);

  // 1. Fetch the main proposal
  const { data: proposal, error: proposalError } = await supabase
    .from('calculator_proposals')
    .select('*')
    .eq('id', proposalId)
    .maybeSingle();

  if (proposalError) {
    console.error('[fetchFullProposal] Error fetching proposal:', proposalError);
    throw new Error(`Erro ao buscar proposta: ${proposalError.message}`);
  }

  if (!proposal) {
    console.error('[fetchFullProposal] Proposal not found:', proposalId);
    throw new Error('Proposta não encontrada');
  }

  // 2. Fetch servers
  const { data: servers, error: serversError } = await supabase
    .from('calculator_proposal_servers')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('sort_order', { ascending: true });

  if (serversError) {
    console.error('[fetchFullProposal] Error fetching servers:', serversError);
    throw new Error(`Erro ao buscar servidores: ${serversError.message}`);
  }

  // 3. Fetch addons
  const { data: addons, error: addonsError } = await supabase
    .from('calculator_proposal_addons')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('sort_order', { ascending: true });

  if (addonsError) {
    console.error('[fetchFullProposal] Error fetching addons:', addonsError);
    throw new Error(`Erro ao buscar add-ons: ${addonsError.message}`);
  }

  // 4. Fetch files (non-critical, don't throw on error)
  const { data: files, error: filesError } = await supabase
    .from('calculator_proposal_files')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: false });

  if (filesError) {
    console.warn('[fetchFullProposal] Warning fetching files:', filesError);
  }

  const result: ProposalFull = {
    ...(proposal as CalculatorProposalRow),
    servers: (servers || []) as CalculatorProposalServerRow[],
    addons: (addons || []) as CalculatorProposalAddonRow[],
    files: (files || []) as CalculatorProposalFileRow[],
  };

  console.log('[fetchFullProposal] Result:', {
    id: result.id,
    company: result.company,
    total: result.total,
    serversCount: result.servers.length,
    addonsCount: result.addons.length,
    filesCount: result.files.length,
  });

  return result;
}

/**
 * Check if a proposal has complete data for PDF generation
 */
export function hasCompleteData(proposal: ProposalFull): boolean {
  // Must have at least servers OR addons OR a total > 0
  const hasServers = proposal.servers.length > 0;
  const hasAddons = proposal.addons.filter(a => a.enabled).length > 0;
  const hasTotal = (proposal.total ?? 0) > 0;

  return hasServers || hasAddons || hasTotal;
}
