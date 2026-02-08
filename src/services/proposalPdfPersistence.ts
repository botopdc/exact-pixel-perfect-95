import { supabase } from '@/integrations/supabase/client';
import { uploadProposalPdf } from '@/services/supabaseStorageService';

export async function persistProposalPdf(params: {
  proposalId: string;
  displayId: string;
  pdfBlob: Blob;
}): Promise<{ id: string; pdf_path: string | null; pdf_generated_at: string | null }> {
  const date = new Date();
  const yyyymmdd = date.toISOString().slice(0, 10).replace(/-/g, '');

  const displayIdSafe = params.displayId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const storagePath = `proposals/${params.proposalId}/OPEN_${displayIdSafe}_${yyyymmdd}.pdf`;

  console.log('[PDF PIPELINE] upload start', {
    proposalId: params.proposalId,
    storagePath,
    bytes: params.pdfBlob.size,
  });

  await uploadProposalPdf(storagePath, params.pdfBlob);

  const { data: updated, error: updErr } = await supabase
    .from('calculator_proposals')
    .update({
      pdf_path: storagePath,
      pdf_generated_at: new Date().toISOString(),
    })
    .eq('id', params.proposalId)
    .select('id,pdf_path,pdf_generated_at')
    .single();

  if (updErr) {
    console.error('[PDF PIPELINE] db update failed', updErr);
    throw new Error('Falha ao atualizar pdf_path no banco: ' + updErr.message);
  }

  if (!updated?.pdf_path) {
    console.error('[PDF PIPELINE] db update returned empty pdf_path', updated);
    throw new Error('pdf_path não foi gravado (id incorreto ou update não aplicou).');
  }

  console.log('[PDF PIPELINE] done', updated);

  return updated;
}
