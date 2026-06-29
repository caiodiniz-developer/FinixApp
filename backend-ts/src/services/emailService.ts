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
      <td style="padding:0 4px;">
        <div style="
          width:50px;height:62px;
          background:#ffffff;
          border:2px solid #d1fae5;
          border-radius:12px;
          font-size:30px;font-weight:900;color:#111827;
          text-align:center;line-height:62px;
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,monospace;
          box-shadow:0 2px 8px rgba(16,185,129,0.1);
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
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px 56px;">
    <tr><td align="center">
    <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">

      <!-- LOGO -->
      <tr>
        <td align="center" style="padding-bottom:24px;">
          <table cellpadding="0" cellspacing="0"><tr><td>
            <div style="display:inline-flex;align-items:center;gap:10px;">
              <div style="
                width:36px;height:36px;border-radius:10px;
                background:linear-gradient(135deg,#10b981,#059669);
                text-align:center;line-height:36px;
                font-size:18px;font-weight:900;color:#fff;
              ">F</div>
              <span style="font-size:20px;font-weight:900;letter-spacing:.1em;color:#111827;">FINIX</span>
            </div>
          </td></tr></table>
        </td>
      </tr>

      <!-- CARD -->
      <tr>
        <td style="
          background:#ffffff;
          border:1px solid #e5e7eb;
          border-radius:20px;
          overflow:hidden;
          box-shadow:0 4px 24px rgba(0,0,0,0.06);
        ">
          <table width="100%" cellpadding="0" cellspacing="0">

            <!-- TOP BAR -->
            <tr>
              <td style="height:4px;background:linear-gradient(90deg,#10b981,#38bdf8,#10b981);" />
            </tr>

            <!-- HEADER -->
            <tr>
              <td style="padding:44px 44px 32px;text-align:center;">
                <div style="
                  width:60px;height:60px;margin:0 auto 20px;
                  background:#ecfdf5;
                  border:1.5px solid #a7f3d0;
                  border-radius:18px;
                  text-align:center;line-height:60px;
                  font-size:28px;
                ">🔐</div>

                <div style="
                  display:inline-block;
                  background:#ecfdf5;
                  border:1px solid #6ee7b7;
                  border-radius:999px;
                  padding:4px 14px;
                  font-size:10px;font-weight:700;
                  letter-spacing:.14em;text-transform:uppercase;
                  color:#059669;margin-bottom:18px;
                ">Verificação de conta</div>

                <h1 style="margin:0 0 10px;font-size:28px;font-weight:900;line-height:1.2;color:#111827;letter-spacing:-.02em;">
                  Confirme seu e-mail
                </h1>
                <p style="margin:0 auto;max-width:380px;font-size:14px;color:#6b7280;line-height:1.75;">
                  Use o código abaixo para ativar sua conta Finix.
                  Válido por <strong style="color:#111827;">10 minutos</strong>.
                </p>
              </td>
            </tr>

            <!-- DIGIT BOXES -->
            <tr>
              <td style="padding:0 44px 40px;">
                <div style="
                  background:#f9fafb;
                  border:1px solid #e5e7eb;
                  border-radius:16px;
                  padding:28px 16px;
                  text-align:center;
                ">
                  <p style="margin:0 0 18px;font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#9ca3af;">
                    Código de verificação
                  </p>
                  <table cellpadding="0" cellspacing="0" align="center">
                    <tr>${digitBoxes}</tr>
                  </table>
                  <p style="margin:18px 0 0;font-size:12px;color:#9ca3af;">
                    Não compartilhe este código com ninguém.
                  </p>
                </div>
              </td>
            </tr>

            <!-- STEPS -->
            <tr>
              <td style="padding:0 44px 36px;">
                <p style="margin:0 0 14px;font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#9ca3af;">
                  Como usar
                </p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  ${[
                    ["1", "Acesse o Finix", "Vá para a página de verificação"],
                    ["2", "Digite o código", "Insira os 6 dígitos acima"],
                    ["3", "Conta ativada!", "Acesso liberado imediatamente"],
                  ].map(([n, t, d]) => `
                  <tr>
                    <td style="padding:6px 12px 6px 0;vertical-align:middle;width:36px;">
                      <div style="width:28px;height:28px;background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;text-align:center;line-height:28px;font-size:12px;font-weight:900;color:#059669;">${n}</div>
                    </td>
                    <td style="padding:6px 0;vertical-align:middle;border-bottom:1px solid #f3f4f6;">
                      <div style="font-size:13px;font-weight:700;color:#111827;">${t}</div>
                      <div style="font-size:12px;color:#6b7280;">${d}</div>
                    </td>
                  </tr>
                  `).join("")}
                </table>
              </td>
            </tr>

            <!-- SECURITY NOTICE -->
            <tr>
              <td style="padding:0 44px 36px;">
                <div style="
                  background:#fff7ed;
                  border:1px solid #fed7aa;
                  border-left:3px solid #f97316;
                  border-radius:10px;
                  padding:14px 18px;
                ">
                  <p style="margin:0 0 4px;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#ea580c;">
                    ⚠ Aviso de segurança
                  </p>
                  <p style="margin:0;font-size:12px;color:#7c3205;line-height:1.65;">
                    A Finix <strong>jamais</strong> solicitará este código por WhatsApp ou telefone. Se você não criou uma conta, ignore esta mensagem.
                  </p>
                </div>
              </td>
            </tr>

            <!-- FOOTER -->
            <tr>
              <td style="
                background:#f9fafb;
                border-top:1px solid #e5e7eb;
                padding:20px 44px 28px;
                text-align:center;
              ">
                <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#9ca3af;">
                  © 2026 Finix · Controle financeiro inteligente
                </p>
                <p style="margin:0;font-size:11px;color:#d1d5db;">
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
