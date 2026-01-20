import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendProposalEmailRequest {
  clientName: string;
  clientEmail: string;
  proposalId: string;
  proposalLink: string;
  totalValue: string;
  validityDate: string;
  senderEmail?: string;
  senderName?: string;
  isAcceptance?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("[send-proposal-email] Received request");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      clientName,
      clientEmail,
      proposalId,
      proposalLink,
      totalValue,
      validityDate,
      senderEmail = "comercial@opendata.center",
      senderName = "OPEN Data Center",
      isAcceptance = false,
    }: SendProposalEmailRequest = await req.json();

    console.log(
      `[send-proposal-email] Sending to: ${clientEmail}, proposal: ${proposalId}, isAcceptance: ${isAcceptance}`,
    );

    // Validate required fields
    if (!clientEmail || !clientName || !proposalId) {
      console.error("[send-proposal-email] Missing required fields");
      return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // CANONICAL LINK FORMAT: /proposta/aprovar?proposalId=X&token=Y
    // If the link already contains token param, it's the canonical format - use as-is
    // Otherwise, it's a legacy format that needs /aceite suffix (for backward compatibility only)
    const isCanonicalFormat = proposalLink.includes('proposalId=') && proposalLink.includes('token=');
    
    let linkToUse: string;
    if (isAcceptance) {
      // For acceptance notification emails (sent to comercial@), use the original link
      linkToUse = proposalLink;
    } else if (isCanonicalFormat) {
      // Canonical format already includes token - use as-is
      linkToUse = proposalLink;
      console.log("[send-proposal-email] Using canonical link format (with token)");
    } else {
      // Legacy format without token - add /aceite suffix (deprecated path)
      console.log("[send-proposal-email] WARN: Using legacy link format, should migrate to canonical");
      linkToUse = proposalLink.replace(/\/?$/, '/aceite');
    }

    const emailHtml = isAcceptance
      ? `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proposta Aceita - OPEN Data Center</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 0;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">✓ Proposta Aceita</h1>
              <p style="color: #a7f3d0; margin: 10px 0 0 0; font-size: 14px;">OPEN Data Center</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1e3a5f; margin: 0 0 20px 0; font-size: 22px;">Nova proposta aceita!</h2>
              
              <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                O cliente <strong>${clientName}</strong> aceitou a proposta comercial.
              </p>
              
              <!-- Proposal Details Box -->
              <table role="presentation" style="width: 100%; background-color: #f0fdf4; border-radius: 8px; margin: 25px 0; border: 1px solid #bbf7d0;">
                <tr>
                  <td style="padding: 25px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #bbf7d0;">
                          <span style="color: #64748b; font-size: 14px;">Número da Proposta</span>
                          <p style="color: #1e3a5f; font-size: 18px; font-weight: 600; margin: 5px 0 0 0;">#${proposalId}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #bbf7d0;">
                          <span style="color: #64748b; font-size: 14px;">Valor Total Mensal</span>
                          <p style="color: #059669; font-size: 24px; font-weight: 700; margin: 5px 0 0 0;">${totalValue}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0;">
                          <span style="color: #64748b; font-size: 14px;">Data de Aceite</span>
                          <p style="color: #1e3a5f; font-size: 18px; font-weight: 600; margin: 5px 0 0 0;">${new Date().toLocaleDateString("pt-BR")}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="color: #555555; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                Por favor, entre em contato com o cliente para dar continuidade ao processo.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 25px 40px; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; font-size: 11px; margin: 0; text-align: center;">
                © ${new Date().getFullYear()} OPEN Data Center. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `
      : `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proposta Comercial - OPEN Data Center</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 0;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">OPEN Data Center</h1>
              <p style="color: #a0c4e8; margin: 10px 0 0 0; font-size: 14px;">Proposta Comercial</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1e3a5f; margin: 0 0 20px 0; font-size: 22px;">Olá, ${clientName}!</h2>
              
              <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Temos o prazer de apresentar nossa proposta comercial personalizada para atender às necessidades da sua empresa.
              </p>
              
              <!-- Proposal Details Box -->
              <table role="presentation" style="width: 100%; background-color: #f8fafc; border-radius: 8px; margin: 25px 0;">
                <tr>
                  <td style="padding: 25px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                          <span style="color: #64748b; font-size: 14px;">Número da Proposta</span>
                          <p style="color: #1e3a5f; font-size: 18px; font-weight: 600; margin: 5px 0 0 0;">#${proposalId}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                          <span style="color: #64748b; font-size: 14px;">Valor Total Mensal</span>
                          <p style="color: #059669; font-size: 24px; font-weight: 700; margin: 5px 0 0 0;">${totalValue}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0;">
                          <span style="color: #64748b; font-size: 14px;">Válida até</span>
                          <p style="color: #1e3a5f; font-size: 18px; font-weight: 600; margin: 5px 0 0 0;">${validityDate}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin: 30px 0;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${linkToUse}" style="display: inline-block; background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(30, 58, 95, 0.4);">
                      Ver Proposta Completa
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #555555; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                Caso tenha alguma dúvida ou precise de mais informações, nossa equipe está à disposição para ajudá-lo.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 25px 40px; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 12px; margin: 0; text-align: center;">
                Este e-mail foi enviado automaticamente pelo sistema de propostas do OPEN Data Center.<br>
                Em caso de dúvidas, entre em contato conosco.
              </p>
              <p style="color: #94a3b8; font-size: 11px; margin: 15px 0 0 0; text-align: center;">
                © ${new Date().getFullYear()} OPEN Data Center. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const emailSubject = isAcceptance
      ? `✓ Proposta #${proposalId} ACEITA - ${clientName}`
      : `Proposta Comercial #${proposalId} - OPEN Data Center`;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${senderName} <${senderEmail}>`,
        to: [clientEmail],
        subject: emailSubject,
        html: emailHtml,
      }),
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("[send-proposal-email] Resend API error:", emailData);
      return new Response(JSON.stringify({ success: false, error: emailData.message || "Failed to send email" }), {
        status: emailResponse.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("[send-proposal-email] Email sent successfully:", emailData);

    return new Response(JSON.stringify({ success: true, data: emailData }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[send-proposal-email] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
