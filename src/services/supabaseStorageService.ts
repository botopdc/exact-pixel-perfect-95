import { supabase } from '@/integrations/supabase/client';

/**
 * Upload de PDF de proposta para o Storage.
 * Retorna o próprio path (fonte de verdade para persistência no banco).
 */
export async function uploadProposalPdf(path: string, file: Blob): Promise<string> {
  const { error } = await supabase.storage
    .from('proposal-files')
    .upload(path, file, {
      upsert: true,
      contentType: 'application/pdf',
    });

  if (error) {
    throw new Error('Falha ao enviar PDF para o Storage: ' + error.message);
  }

  return path;
}

/**
 * Gera uma URL assinada para download do PDF.
 */
export async function createSignedPdfUrl(path: string, expiresSeconds: number): Promise<string> {
  const { data, error } = await supabase.storage
    .from('proposal-files')
    .createSignedUrl(path, expiresSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Falha ao gerar link assinado para o PDF');
  }

  return data.signedUrl;
}
