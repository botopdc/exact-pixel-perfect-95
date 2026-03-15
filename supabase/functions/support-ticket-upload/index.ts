// ============================================================================
// EDGE FUNCTION: support-ticket-upload
// Handles file upload to support-ticket-files bucket + get_url action
// ============================================================================

import { getSupabaseAdmin, validateExternalToken } from "../_shared/supabaseAdmin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/x-7z-compressed",
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, message: "Method not allowed" }, 405);
  }

  try {
    // Auth
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const authResult = await validateExternalToken(token);
    if (!authResult.valid) {
      return jsonResponse({ success: false, message: "Unauthorized" }, 401);
    }

    const db = getSupabaseAdmin();
    const contentType = req.headers.get("content-type") || "";

    // ── JSON action (get_url) ────────────────────────────────────────
    if (contentType.includes("application/json")) {
      const body = await req.json();
      if (body.action === "get_url") {
        const { attachment_id, ticket_id } = body;
        if (!attachment_id || !ticket_id) {
          return jsonResponse({ success: false, message: "attachment_id e ticket_id obrigatórios" }, 422);
        }

        // Fetch attachment
        const { data: att, error: attErr } = await db
          .from("support_ticket_attachments")
          .select("*")
          .eq("id", attachment_id)
          .eq("ticket_id", ticket_id)
          .single();

        if (attErr || !att) {
          return jsonResponse({ success: false, message: "Anexo não encontrado" }, 404);
        }

        // Generate signed URL (1 hour)
        const { data: urlData, error: urlErr } = await db.storage
          .from(att.bucket_name)
          .createSignedUrl(att.storage_path, 3600);

        if (urlErr || !urlData) {
          return jsonResponse({ success: false, message: "Erro ao gerar URL de download" }, 500);
        }

        return jsonResponse({
          success: true,
          data: { signed_url: urlData.signedUrl },
        });
      }

      return jsonResponse({ success: false, message: "Ação desconhecida" }, 422);
    }

    // ── Multipart upload ─────────────────────────────────────────────
    if (!contentType.includes("multipart/form-data")) {
      return jsonResponse({ success: false, message: "Content-Type deve ser multipart/form-data" }, 415);
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const ticketId = formData.get("ticket_id") as string | null;
    const isInternal = formData.get("is_internal") === "true";
    const uploaderName = formData.get("uploader_name") as string | null;
    const uploaderUserId = formData.get("uploader_user_id") as string | null;
    const uploaderLevel = parseInt(formData.get("uploader_level") as string || "1", 10);

    if (!file || !ticketId) {
      return jsonResponse({ success: false, message: "file e ticket_id obrigatórios" }, 422);
    }

    // Validate ticket exists
    const { data: ticket, error: ticketErr } = await db
      .from("support_tickets")
      .select("id, requester_user_id")
      .eq("id", ticketId)
      .is("deleted_at", null)
      .single();

    if (ticketErr || !ticket) {
      return jsonResponse({ success: false, message: "Ticket não encontrado" }, 404);
    }

    // Client can only upload to own tickets
    if (uploaderLevel < 600 && uploaderUserId && ticket.requester_user_id !== uploaderUserId) {
      return jsonResponse({ success: false, message: "Acesso negado" }, 403);
    }

    // Client cannot upload internal attachments
    if (uploaderLevel < 600 && isInternal) {
      return jsonResponse({ success: false, message: "Clientes não podem enviar anexos internos" }, 403);
    }

    // Validate mime type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return jsonResponse({ success: false, message: `Tipo de arquivo não permitido: ${file.type}` }, 422);
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      return jsonResponse({ success: false, message: `Arquivo muito grande. Máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB` }, 422);
    }

    // Generate storage path
    const ext = file.name.split('.').pop() || 'bin';
    const storagePath = `${ticketId}/${crypto.randomUUID()}.${ext}`;

    // Upload to storage
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadErr } = await db.storage
      .from("support-ticket-files")
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr) {
      console.error("Upload error:", uploadErr);
      return jsonResponse({ success: false, message: "Erro ao fazer upload do arquivo" }, 500);
    }

    // Persist in attachments table
    const { data: attachment, error: insertErr } = await db
      .from("support_ticket_attachments")
      .insert({
        ticket_id: ticketId,
        uploaded_by_user_id: uploaderUserId || null,
        uploaded_by_name: uploaderName || null,
        bucket_name: "support-ticket-files",
        storage_path: storagePath,
        original_filename: file.name,
        mime_type: file.type,
        file_size: file.size,
        is_internal: isInternal,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Insert attachment error:", insertErr);
      return jsonResponse({ success: false, message: "Erro ao registrar anexo" }, 500);
    }

    // Record event
    await db.from("support_ticket_events").insert({
      event_name: "ticket.attachment_uploaded",
      entity_type: "support_ticket",
      entity_id: ticketId,
      actor_type: uploaderLevel >= 900 ? "support" : uploaderLevel >= 775 ? "cs" : "client",
      actor_id: uploaderUserId || null,
      user_id: uploaderUserId || null,
      metadata: {
        attachment_id: attachment.id,
        filename: file.name,
        mime_type: file.type,
        file_size: file.size,
        is_internal: isInternal,
      },
      ip_address: req.headers.get("x-forwarded-for") || null,
      user_agent: req.headers.get("user-agent") || null,
    });

    return jsonResponse({
      success: true,
      data: attachment,
      message: "Anexo enviado com sucesso",
    }, 201);
  } catch (err) {
    console.error("support-ticket-upload error:", err);
    return jsonResponse({ success: false, message: "Erro interno", errors: [String(err)] }, 500);
  }
});
