/**
 * Contract Document Generation Service
 * Calls edge function to generate DOCX + Annex I PDF
 */

import { supabase } from '@/integrations/supabase/client';

export interface GenerateDocumentResult {
  success: boolean;
  contract_id: string;
  proposal_id?: string;
  docx_path: string | null;
  annex_pdf_path: string | null;
  proposal_pdf_source_path: string | null;
  annex_strategy?: string;
  annex_generated?: boolean;
  annex_skip_reason?: string;
  contract_docx_generated?: boolean;
  generation_strategy?: string;
  snapshot_created?: boolean;
  pdf_auto_generated?: boolean;
  code?: string;
  message?: string;
  error?: string;
  documents?: Array<{ type: string; name: string; path: string }>;
  debug?: Record<string, unknown>;
}

// Map error codes to user-friendly messages
const ERROR_MESSAGES: Record<string, string> = {
  contract_id_required: 'ID do contrato é obrigatório.',
  contract_not_found: 'Contrato não encontrado.',
  contract_without_proposal_id: 'Contrato sem proposta vinculada.',
  contract_documents_locked: 'Documentos bloqueados — contrato já assinado ou finalizado.',
  proposal_not_found: 'Proposta vinculada não encontrada.',
  proposal_pdf_path_missing: 'A proposta vinculada não possui PDF oficial gerado.',
  proposal_pdf_file_not_found: 'PDF oficial da proposta não encontrado no storage.',
  proposal_pdf_invalid_format: 'O arquivo da proposta não é um PDF válido. Regenere o PDF.',
  proposal_pdf_page_count_invalid: 'O PDF da proposta possui 7 ou menos páginas. Impossível gerar Anexo I.',
  contract_annex_trim_empty: 'O recorte do PDF resultou em zero páginas.',
  contract_annex_trim_not_executed: 'O recorte do PDF da proposta não foi executado.',
  proposal_pdf_trim_failed: 'Erro ao processar o PDF da proposta.',
  proposal_pdf_auto_generation_failed: 'Não foi possível gerar automaticamente o PDF da proposta.',
  proposal_pdf_storage_failed: 'Falha ao salvar o PDF gerado da proposta.',
  contract_annex_pdf_storage_failed: 'Erro ao salvar o Anexo I no storage.',
  contract_annex_pdf_generation_failed: 'Erro ao gerar o Anexo I.',
  contract_documents_incomplete: 'Geração de documentos incompleta — Anexo I não foi gerado.',
  annex_upload_failed: 'Erro ao salvar o Anexo I.',
  internal_error: 'Erro interno inesperado. Tente novamente.',
};

export async function generateContractDocument(contractId: string): Promise<GenerateDocumentResult> {
  const { data, error } = await supabase.functions.invoke('contract-generate-document', {
    body: { contract_id: contractId },
  });

  // supabase.functions.invoke sets error for non-2xx but still returns the body in data
  if (error) {
    if (data && typeof data === 'object' && data.success === false) {
      const friendlyMessage = (data.code && ERROR_MESSAGES[data.code])
        || data.message
        || data.error
        || 'Erro ao gerar documento do contrato';
      throw new Error(friendlyMessage);
    }
    const ctx = (error as any)?.context;
    if (ctx && typeof ctx === 'object' && ctx.success === false) {
      const friendlyMessage = (ctx.code && ERROR_MESSAGES[ctx.code])
        || ctx.message
        || ctx.error
        || 'Erro ao gerar documento do contrato';
      throw new Error(friendlyMessage);
    }
    throw new Error(error.message || 'Erro ao gerar documento do contrato');
  }

  if (!data?.success) {
    const friendlyMessage = (data?.code && ERROR_MESSAGES[data.code])
      || data?.message
      || data?.error
      || 'Falha na geração do documento';
    throw new Error(friendlyMessage);
  }

  return data as GenerateDocumentResult;
}

export async function getContractFileUrl(bucket: string, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export const contractDocumentService = {
  generate: generateContractDocument,
  getFileUrl: getContractFileUrl,
};
