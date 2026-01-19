import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
  portalName: string; // "Portal do Parceiro" or "OPEN Academy"
  resetLink: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("[send-password-reset] Received request");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, portalName, resetLink }: PasswordResetRequest = await req.json();

    console.log(`[send-password-reset] Sending reset email to: ${email} for ${portalName}`);

    // Validate required fields
    if (!email || !portalName || !resetLink) {
      console.error("[send-password-reset] Missing required fields");
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redefinição de Senha - OPEN Datacenter</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 0;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); padding: 30px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">OPEN Datacenter</h1>
              <p style="color: #a0c4e8; margin: 10px 0 0 0; font-size: 14px;">Redefinição de Senha</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1e3a5f; margin: 0 0 20px 0; font-size: 22px;">Olá!</h2>
              
              <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Recebemos uma solicitação para redefinir a senha de acesso ao <strong>${portalName}</strong> da OPEN.
              </p>
              
              <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                Clique no botão abaixo para criar uma nova senha.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; margin: 30px 0;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(30, 58, 95, 0.4);">
                      Redefinir Minha Senha
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Warning Box -->
              <table role="presentation" style="width: 100%; background-color: #fef3c7; border-radius: 8px; margin: 25px 0; border: 1px solid #fcd34d;">
                <tr>
                  <td style="padding: 15px 20px;">
                    <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.5;">
                      <strong>⏱ Este link é válido por 60 minutos</strong> e pode ser usado apenas uma vez.
                    </p>
                  </td>
                </tr>
              </table>
              
              <p style="color: #888888; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                Se você não solicitou esta redefinição, ignore este e-mail. Sua senha permanecerá inalterada.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 25px 40px; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 12px; margin: 0; text-align: center;">
                Este e-mail foi enviado automaticamente pelo sistema da OPEN Datacenter.<br>
                Em caso de dúvidas, entre em contato conosco.
              </p>
              <p style="color: #94a3b8; font-size: 11px; margin: 15px 0 0 0; text-align: center;">
                © ${new Date().getFullYear()} OPEN Datacenter. Todos os direitos reservados.
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

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "OPEN Datacenter <noreply@opendata.center>",
        to: [email],
        subject: "Redefinição de senha — OPEN Datacenter",
        html: emailHtml,
      }),
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("[send-password-reset] Resend API error:", emailData);
      return new Response(
        JSON.stringify({ success: false, error: emailData.message || "Failed to send email" }),
        {
          status: emailResponse.status,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("[send-password-reset] Email sent successfully:", emailData);

    return new Response(JSON.stringify({ success: true, data: emailData }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[send-password-reset] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
