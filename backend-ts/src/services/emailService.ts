import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM?.trim() || "Finix <onboarding@resend.dev>";

if (!RESEND_API_KEY) {
  console.warn("[EMAIL] WARNING: RESEND_API_KEY is not set. Verification emails will NOT be sent.");
}

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim().toLowerCase());

const getVerificationTemplate = (code: string) => {
  const digits = code.split("");
  const digitBoxes = digits
    .map(d => `
      <td style="padding:0 5px;">
        <div style="
          width:52px;height:68px;
          background:rgba(255,255,255,0.05);
          border:1.5px solid rgba(16,185,129,0.35);
          border-radius:16px;
          display:flex;align-items:center;justify-content:center;
          font-size:32px;font-weight:900;color:#ecfdf5;
          text-align:center;line-height:68px;
          font-feature-settings:'tnum';
          box-shadow:0 0 20px rgba(16,185,129,0.08);
        ">${d}</div>
      </td>
    `)
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Finix — Verificação de conta</title>
</head>
<body style="margin:0;padding:0;background:#040406;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#040406;padding:48px 16px 64px;">
    <tr><td align="center">
    <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">

      <!-- LOGO -->
      <tr>
        <td align="center" style="padding-bottom:32px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td>
              <div style="
                display:inline-flex;align-items:center;gap:10px;
                background:rgba(255,255,255,0.04);
                border:1px solid rgba(255,255,255,0.08);
                border-radius:14px;
                padding:10px 18px;
              ">
                <div style="
                  width:32px;height:32px;border-radius:8px;
                  background:linear-gradient(135deg,#10b981,#059669);
                  text-align:center;line-height:32px;
                  font-size:16px;font-weight:900;color:#fff;
                ">F</div>
                <span style="font-size:18px;font-weight:900;letter-spacing:.12em;color:#fff;">FINIX</span>
              </div>
            </td>
          </tr></table>
        </td>
      </tr>

      <!-- CARD -->
      <tr>
        <td style="
          background:#0a0a0d;
          border:1px solid rgba(255,255,255,0.07);
          border-radius:24px;
          overflow:hidden;
          box-shadow:0 40px 80px rgba(0,0,0,0.7);
        ">
          <table width="100%" cellpadding="0" cellspacing="0">

            <!-- TOP GLOW BAR -->
            <tr>
              <td style="height:3px;background:linear-gradient(90deg,#10b981,#38bdf8,#10b981);" />
            </tr>

            <!-- HEADER SECTION -->
            <tr>
              <td style="padding:48px 48px 36px;text-align:center;">
                <!-- Shield icon -->
                <div style="
                  width:56px;height:56px;margin:0 auto 20px;
                  background:rgba(16,185,129,0.1);
                  border:1.5px solid rgba(16,185,129,0.25);
                  border-radius:16px;
                  text-align:center;line-height:56px;
                  font-size:26px;
                ">🔐</div>

                <div style="
                  display:inline-block;
                  background:rgba(16,185,129,0.08);
                  border:1px solid rgba(16,185,129,0.2);
                  border-radius:999px;
                  padding:4px 14px;
                  font-size:10px;font-weight:700;
                  letter-spacing:.16em;text-transform:uppercase;
                  color:#34d399;margin-bottom:20px;
                ">Verificação de conta</div>

                <h1 style="margin:0 0 12px;font-size:30px;font-weight:900;line-height:1.15;color:#ffffff;letter-spacing:-.02em;">
                  Confirme seu e-mail
                </h1>
                <p style="margin:0 auto;max-width:380px;font-size:14px;color:rgba(255,255,255,0.4);line-height:1.75;">
                  Use o código abaixo para ativar sua conta Finix.
                  <br/>Válido por <strong style="color:rgba(255,255,255,0.65);">10 minutos</strong>.
                </p>
              </td>
            </tr>

            <!-- DIGIT BOXES -->
            <tr>
              <td style="padding:0 48px 44px;">
                <div style="
                  background:rgba(255,255,255,0.02);
                  border:1px solid rgba(255,255,255,0.06);
                  border-radius:18px;
                  padding:32px 20px;
                  text-align:center;
                ">
                  <p style="margin:0 0 20px;font-size:10px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,0.3);">
                    Código de verificação
                  </p>
                  <table cellpadding="0" cellspacing="0" align="center">
                    <tr>${digitBoxes}</tr>
                  </table>
                  <p style="margin:20px 0 0;font-size:13px;color:rgba(255,255,255,0.25);">
                    Não compartilhe este código com ninguém.
                  </p>
                </div>
              </td>
            </tr>

            <!-- STEPS -->
            <tr>
              <td style="padding:0 48px 40px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td colspan="3" style="padding-bottom:16px;">
                      <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,0.25);">
                        Como usar
                      </p>
                    </td>
                  </tr>
                  ${[
                    ["1", "Acesse o Finix", "Vá para a página de verificação"],
                    ["2", "Digite o código", "Insira os 6 dígitos acima"],
                    ["3", "Conta ativada", "Acesso liberado imediatamente"],
                  ].map(([n, t, d]) => `
                  <tr>
                    <td style="padding:8px 12px 8px 0;vertical-align:top;width:32px;">
                      <div style="width:28px;height:28px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:8px;text-align:center;line-height:28px;font-size:12px;font-weight:900;color:#34d399;">${n}</div>
                    </td>
                    <td style="padding:8px 0;vertical-align:top;">
                      <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.7);margin-bottom:2px;">${t}</div>
                      <div style="font-size:12px;color:rgba(255,255,255,0.3);">${d}</div>
                    </td>
                  </tr>
                  `).join("")}
                </table>
              </td>
            </tr>

            <!-- SECURITY NOTICE -->
            <tr>
              <td style="padding:0 48px 40px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="
                      background:rgba(239,68,68,0.05);
                      border:1px solid rgba(239,68,68,0.15);
                      border-left:3px solid #ef4444;
                      border-radius:12px;
                      padding:16px 20px;
                    ">
                      <p style="margin:0 0 4px;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#fca5a5;">
                        ⚠ Aviso de segurança
                      </p>
                      <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.4);line-height:1.65;">
                        A Finix <strong style="color:rgba(255,255,255,0.6);">jamais</strong> solicitará este código por WhatsApp, telefone ou e-mail adicional. Se você não criou uma conta, ignore esta mensagem.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td style="
                border-top:1px solid rgba(255,255,255,0.05);
                padding:24px 48px 32px;
                text-align:center;
              ">
                <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:rgba(255,255,255,0.25);">
                  © 2026 Finix · Controle financeiro inteligente
                </p>
                <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.15);">
                  Este e-mail foi enviado automaticamente. Por favor, não responda.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>

    </table>
    </td></tr>
  </table>
</body>
</html>`;
};

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
    subject: "Seu código de verificação — Finix",
    html: getVerificationTemplate(code),
    text: `Código de verificação Finix: ${code}\n\nVálido por 10 minutos. Não compartilhe.`,
  });

  if (error) {
    console.error("[EMAIL] Resend API returned error:", JSON.stringify(error));
    throw new Error(
      `Falha ao enviar e-mail via Resend: ${(error as any).message || JSON.stringify(error)}`
    );
  }

  console.log("[EMAIL] Email sent successfully. Resend ID:", data?.id);
};
