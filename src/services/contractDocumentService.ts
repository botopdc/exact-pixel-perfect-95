/**
 * Contract Document Generation Service
 * Calls edge function to generate DOCX + Annex I PDF
 */

import { supabase } from '@/integrations/supabase/client';

export interface GenerateDocumentResult {
  success: boolean;
  contract_id: string;
  docx_path: string | null;
  annex_pdf_path: string | null;
  proposal_pdf_source_path: string | null;
  generation_strategy: string;
  error?: string;
}

export async function generateContractDocument(contractId: string): Promise<GenerateDocumentResult> {
  const { data, error } = await supabase.functions.invoke('contract-generate-document', {
    body: { contract_id: contractId },
  });

  if (error) {
    throw new Error(error.message || 'Erro ao gerar documento do contrato');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Falha na geração do documento');
  }

  return data as GenerateDocumentResult;
}

export async function getContractFileUrl(bucket: string, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600); // 1 hour

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export const contractDocumentService = {
  generate: generateContractDocument,
  getFileUrl: getContractFileUrl,
};
