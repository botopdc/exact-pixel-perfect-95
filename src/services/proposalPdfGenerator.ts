import type { CalculationResult, ResellerState } from '@/lib/calculatorConfig';
import { generateOpenPDFBlob } from '@/lib/pdfGenerator';

type ClientShape = { name: string; company: string; phone: string; email: string };
type ProposalShape = { id?: string; validityDays?: number; createdAt?: string };

export async function generateProposalPdfBlobFromCalculatorState(input: {
  displayId?: string;
  client: ClientShape;
  proposal: ProposalShape;
  result: CalculationResult;
  selectedTerm: string;
  datacenter: string;
  reseller: ResellerState;
  includeCommission?: boolean;
  observacao?: string;
}): Promise<Blob> {
  const proposalMeta = {
    id: input.displayId || input.proposal.id || 'OPEN',
    createdAt: input.proposal.createdAt || new Date().toISOString(),
    validityDays: input.proposal.validityDays || 7,
  };

  const { blob } = await generateOpenPDFBlob({
    client: input.client,
    proposal: proposalMeta,
    result: input.result,
    selectedTerm: input.selectedTerm,
    datacenter: input.datacenter,
    reseller: input.reseller,
    includeCommission: input.includeCommission ?? true,
    observacao: input.observacao,
    attachments: [],
  });

  return blob;
}
