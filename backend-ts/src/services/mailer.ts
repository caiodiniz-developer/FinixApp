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
    return true;
  } catch (err: any) {
    console.error("[EMAIL] Falha ao enviar pelo Gmail:", err.message);
    throw new Error(`Falha ao enviar e-mail: ${err.message}`);
  }
};
