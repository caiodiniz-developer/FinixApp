import nodemailer from "nodemailer";
import { Resend } from "resend";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type MailProvider = "gmail" | "resend" | "none";

// ── Gmail (SMTP) ────────────────────────────────────────────────────────────
// Sends from a regular Gmail account using an "app password" (Google account →
// Security → 2-step verification → App passwords). No domain needed; Google
// caps a personal account at roughly 500 e-mails per day.
const GMAIL_USER = process.env.GMAIL_USER?.trim();
// Google shows the app password in groups of four separated by spaces.
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");

const gmail =
  GMAIL_USER && GMAIL_APP_PASSWORD
    ? nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
        // Some hosts block outbound SMTP: fail fast so the fallback below
        // still delivers within the request instead of hanging for minutes.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      })
    : null;

// ── Resend (HTTPS API) ──────────────────────────────────────────────────────
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const displayName = process.env.EMAIL_FROM_NAME?.trim() || "Finix";
// Gmail always sends as the authenticated account, whatever EMAIL_FROM says.
const gmailFrom = `${displayName} <${GMAIL_USER}>`;
const resendFrom = process.env.EMAIL_FROM?.trim() || "Finix <onboarding@resend.dev>";

export const mailProviders: MailProvider[] = [
  ...(gmail ? (["gmail"] as const) : []),
  ...(resend ? (["resend"] as const) : []),
];

if (mailProviders.length === 0) {
  console.warn(
    "[EMAIL] Nenhum provedor configurado (GMAIL_USER + GMAIL_APP_PASSWORD ou RESEND_API_KEY). " +
      "Os e-mails NÃO serão enviados.",
  );
} else {
  console.log(`[EMAIL] Provedores de e-mail: ${mailProviders.join(" → ")}`);
}

const sendWithGmail = async (email: OutgoingEmail) => {
  await gmail!.sendMail({ from: gmailFrom, ...email });
};

const sendWithResend = async (email: OutgoingEmail) => {
  // The Resend SDK returns { error } instead of throwing on API errors.
  const { error } = await resend!.emails.send({
    from: resendFrom,
    to: [email.to],
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
  if (error) throw new Error(error.message || JSON.stringify(error));
};

/**
 * Sends one e-mail through the first configured provider that accepts it:
 * Gmail first, then Resend. Returns which one delivered, or "none" when no
 * provider is configured. Throws only if every configured provider failed.
 */
export const deliverEmail = async (email: OutgoingEmail): Promise<MailProvider> => {
  const failures: string[] = [];
  for (const provider of mailProviders) {
    try {
      if (provider === "gmail") await sendWithGmail(email);
      else await sendWithResend(email);
      return provider;
    } catch (err: any) {
      console.error(`[EMAIL] Falha ao enviar via ${provider}:`, err.message);
      failures.push(`${provider}: ${err.message}`);
    }
  }
  if (failures.length) {
    throw new Error(`Falha ao enviar e-mail (${failures.join("; ")})`);
  }
  return "none";
};
