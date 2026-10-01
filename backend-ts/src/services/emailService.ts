import { deliverEmail } from "./mailer";

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim().toLowerCase());

export const sendAlertEmail = async (
  rawEmail: string,
  alert: { title: string; description?: string | null; amount?: number | null; daysUntilDue?: number | null },
): Promise<void> => {
  const email = String(rawEmail || "").trim().toLowerCase();
  if (!isValidEmail(email)) return;

  const amountText =
    typeof alert.amount === "number"
      ? alert.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : null;
  const dueText =
    typeof alert.daysUntilDue === "number"
      ? alert.daysUntilDue <= 0
        ? "vence hoje"
        : `vence em ${alert.daysUntilDue} dia${alert.daysUntilDue === 1 ? "" : "s"}`
      : "";

  const html = `<!DOCTYPE html>
<html lang="pt-BR"><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
        <tr><td style="height:4px;background:linear-gradient(90deg,#f97316,#f59e0b);"></td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#f97316;">Alerta financeiro Finix</p>
          <h1 style="margin:0 0 12px;font-size:22px;color:#111827;">${alert.title}</h1>
          ${alert.description ? `<p style="margin:0 0 12px;font-size:14px;color:#4b5563;">${alert.description}</p>` : ""}
          <p style="margin:0;font-size:14px;color:#374151;">${amountText ? `<strong>${amountText}</strong> · ` : ""}${dueText}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  // Reminders are best-effort: a delivery problem must not break the daily job.
  await deliverEmail({
    to: email,
    subject: `Finix — ${alert.title}`,
    html,
    text: `${alert.title}
${alert.description || ""}
${amountText || ""} ${dueText}`,
  }).catch((err: any) => console.error("[EMAIL] Falha ao enviar alerta:", err.message));
};
