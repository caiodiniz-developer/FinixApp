import nodemailer from "nodemailer";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// Sends from a regular Gmail account over SMTP using an "app password"
// (Google account → Security → 2-step verification → App passwords). No
// domain needed; Google caps a personal account at roughly 500 e-mails/day.
const GMAIL_USER = process.env.GMAIL_USER?.trim();
// Google shows the app password in groups of four separated by spaces.
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");

const transport =
  GMAIL_USER && GMAIL_APP_PASSWORD
    ? nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
        // Some hosts block outbound SMTP: fail in seconds with a clear error
        // instead of leaving the request hanging for minutes.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      })
    : null;

export const isEmailConfigured = !!transport;

/**
 * Coarse, non-sensitive state of the e-mail channel, shown in GET /health so
 * a delivery problem can be diagnosed without access to the server logs:
 *  - not_configured:    GMAIL_USER / GMAIL_APP_PASSWORD are missing
 *  - checking:          boot-time connection test still running
 *  - ok:                Gmail accepted the login
 *  - auth_failed:       Gmail refused the user / app password
 *  - connection_failed: could not reach smtp.gmail.com (host blocks SMTP?)
 */
export type EmailStatus = "not_configured" | "checking" | "ok" | "auth_failed" | "connection_failed";

let status: EmailStatus = transport ? "checking" : "not_configured";
export const getEmailStatus = (): EmailStatus => status;

const classify = (err: any): EmailStatus =>
  err?.code === "EAUTH" || err?.responseCode === 535 ? "auth_failed" : "connection_failed";

if (transport) {
  transport
    .verify()
    .then(() => {
      status = "ok";
      console.log("[EMAIL] Gmail pronto para enviar");
    })
    .catch((err: any) => {
      status = classify(err);
      console.error(`[EMAIL] Gmail indisponível (${status}):`, err.message);
    });
}

// Gmail always sends as the authenticated account.
const from = `${process.env.EMAIL_FROM_NAME?.trim() || "Finix"} <${GMAIL_USER}>`;

if (!isEmailConfigured) {
  console.warn(
    "[EMAIL] GMAIL_USER/GMAIL_APP_PASSWORD não definidos — os e-mails NÃO serão enviados.",
  );
}

/**
 * Sends one e-mail through Gmail. Returns false when Gmail isn't configured
 * (nothing was sent); throws if the send itself fails.
 */
export const deliverEmail = async (email: OutgoingEmail): Promise<boolean> => {
  if (!transport) return false;
  try {
    await transport.sendMail({ from, ...email });
    status = "ok";
    return true;
  } catch (err: any) {
    status = classify(err);
    console.error("[EMAIL] Falha ao enviar pelo Gmail:", err.message);
    throw new Error(`Falha ao enviar e-mail: ${err.message}`);
  }
};
