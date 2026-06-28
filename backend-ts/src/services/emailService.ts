import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
// onboarding@resend.dev works without domain verification in the Resend free tier
const EMAIL_FROM = process.env.EMAIL_FROM?.trim() || "Finix <onboarding@resend.dev>";

if (!RESEND_API_KEY) {
  console.warn("[EMAIL] WARNING: RESEND_API_KEY is not set. Verification emails will NOT be sent.");
}

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim().toLowerCase());

const getVerificationTemplate = (code: string) => `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Finix – Codigo de Verificacao</title>
</head>
<body style="margin:0;padding:0;background:#07080f;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#07080f;padding:48px 16px;">
    <tr><td align="center">
    <table width="100%" style="max-width:580px;" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding-bottom:28px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:12px;vertical-align:middle;">
              <table cellpadding="0" cellspacing="0"><tr><td style="
                width:50px;height:50px;border-radius:14px;
                background:linear-gradient(135deg,#6d5afc,#3b82f6);
                text-align:center;vertical-align:middle;
                font-size:24px;font-weight:900;color:#fff;
                line-height:50px;">F</td></tr></table>
            </td>
            <td style="vertical-align:middle;">
              <span style="font-size:26px;font-weight:900;letter-spacing:.2em;color:#fff;">FINIX</span>
            </td>
          </tr></table>
        </td>
      </tr>
      <tr>
        <td style="background:#10121c;border:1px solid rgba(255,255,255,.07);border-radius:28px;overflow:hidden;box-shadow:0 40px 80px rgba(0,0,0,.6);">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:52px 48px 44px;text-align:center;border-bottom:1px solid rgba(255,255,255,.06);">
              <table cellpadding="0" cellspacing="0" align="center" style="margin-bottom:24px;">
                <tr><td style="background:rgba(109,90,252,.18);border:1px solid rgba(109,90,252,.38);border-radius:999px;padding:6px 18px;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#c4b5fd;">
                  Verificacao de identidade
                </td></tr>
              </table>
              <h1 style="margin:0 0 18px;font-size:38px;font-weight:900;line-height:1.1;letter-spacing:-.03em;color:#ffffff;">
                Seu codigo de<br/><span style="color:#818cf8;">acesso seguro</span>
              </h1>
              <p style="margin:0 auto;max-width:400px;font-size:15px;color:#94a3b8;line-height:1.8;">
                Use o codigo abaixo para verificar seu e-mail e acessar a plataforma Finix.
              </p>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:44px 48px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="background:rgba(109,90,252,.08);border:1px solid rgba(109,90,252,.22);border-radius:22px;padding:40px 20px;text-align:center;">
                  <div style="font-size:10px;font-weight:700;letter-spacing:.28em;text-transform:uppercase;color:#a78bfa;margin-bottom:20px;">
                    Codigo de verificacao
                  </div>
                  <table cellpadding="0" cellspacing="0" align="center">
                    <tr><td style="background:#1a1730;border:1.5px solid rgba(109,90,252,.45);border-radius:18px;padding:22px 40px;font-size:54px;font-weight:900;letter-spacing:16px;color:#ddd6fe;text-align:center;">
                      ${code}
                    </td></tr>
                  </table>
                  <p style="margin:20px 0 0;font-size:14px;color:#64748b;">
                    Valido por <strong style="color:#a78bfa;">10 minutos</strong> — nao compartilhe.
                  </p>
                </td></tr>
              </table>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:28px 48px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.18);border-left:3px solid #ef4444;border-radius:14px;padding:20px 22px;">
                  <div style="font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#fca5a5;margin-bottom:8px;">
                    Aviso de seguranca
                  </div>
                  <p style="margin:0;font-size:14px;color:#94a3b8;line-height:1.75;">
                    A Finix <strong style="color:#fca5a5;">jamais</strong> solicitara este codigo por WhatsApp ou telefone.
                    Se nao solicitou, ignore este e-mail.
                  </p>
                </td></tr>
              </table>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="border-top:1px solid rgba(255,255,255,.05);padding:26px 48px 38px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#334155;">
                2026 Finix - Controle financeiro inteligente.
              </p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
    </td></tr>
  </table>
</body>
</html>`;

export const sendVerificationEmail = async (rawEmail: string, code: string): Promise<void> => {
  const email = String(rawEmail || "").trim().toLowerCase();

  if (!isValidEmail(email)) {
    throw new Error(`Email invalido: "${email}"`);
  }

  if (!resend) {
    console.warn("[EMAIL] No Resend client — skipping email to:", email);
    console.warn("[EMAIL] Code for debugging:", code);
    return;
  }

  console.log("[EMAIL] Attempting send via Resend:", { to: email, from: EMAIL_FROM });

  // Resend SDK v2+ returns { data, error } — does NOT throw on API errors
  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: [email],
    subject: "Seu codigo de verificacao - Finix",
    html: getVerificationTemplate(code),
    text: `Codigo de verificacao Finix: ${code}\n\nValido por 10 minutos. Nao compartilhe.`,
  });

  if (error) {
    console.error("[EMAIL] Resend API returned error:", JSON.stringify(error));
    throw new Error(
      `Falha ao enviar e-mail via Resend: ${(error as any).message || JSON.stringify(error)}`
    );
  }

  console.log("[EMAIL] Email sent successfully. Resend ID:", data?.id);
};
