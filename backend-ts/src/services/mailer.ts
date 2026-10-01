import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import { OAuth2Client } from "google-auth-library";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * E-mail goes out from one Gmail account (GMAIL_USER), by one of two routes:
 *
 *  1. Gmail API over HTTPS — used when GMAIL_REFRESH_TOKEN is set. This is
 *     the one that works on hosts that block outbound SMTP ports (Render's
 *     free tier does). The token is obtained once at GET /google/gmail/connect.
 *  2. Gmail SMTP with an app password (GMAIL_APP_PASSWORD) — simpler to set
 *     up, but only works where ports 465/587 are open (local dev, paid hosts).
 */
const GMAIL_USER = process.env.GMAIL_USER?.trim();
// Google shows the app password in groups of four separated by spaces.
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN?.trim();
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

const from = `${process.env.EMAIL_FROM_NAME?.trim() || "Finix"} <${GMAIL_USER}>`;

// ── Route 1: Gmail API (HTTPS) ──────────────────────────────────────────────
const gmailApi =
  GMAIL_USER && GMAIL_REFRESH_TOKEN && GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
    ? new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
    : null;
gmailApi?.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });

const toBase64Url = (buffer: Buffer) =>
  buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const sendViaApi = async (email: OutgoingEmail) => {
  const mime = await new MailComposer({ from, ...email }).compile().build();
  // OAuth2Client.request refreshes the short-lived access token on its own.
  await gmailApi!.request({
    url: "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    method: "POST",
    data: { raw: toBase64Url(mime) },
    timeout: 20_000,
  });
};

// ── Route 2: Gmail SMTP ─────────────────────────────────────────────────────
const smtp =
  !gmailApi && GMAIL_USER && GMAIL_APP_PASSWORD
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

export const emailRoute: "gmail-api" | "gmail-smtp" | null = gmailApi
  ? "gmail-api"
  : smtp
    ? "gmail-smtp"
    : null;
export const isEmailConfigured = emailRoute !== null;

/**
 * Coarse, non-sensitive state of the e-mail channel, shown in GET /health so
 * a delivery problem can be diagnosed without access to the server logs:
 *  - not_configured:    no Gmail credentials set
 *  - checking:          boot-time test still running
 *  - ok:                Gmail accepted the credentials
 *  - auth_failed:       Gmail refused them (wrong app password, or the
 *                       refresh token was revoked/expired)
 *  - connection_failed: could not reach Gmail (host blocks SMTP ports?)
 */
export type EmailStatus = "not_configured" | "checking" | "ok" | "auth_failed" | "connection_failed";

let status: EmailStatus = isEmailConfigured ? "checking" : "not_configured";
export const getEmailStatus = (): EmailStatus => status;

const classify = (err: any): EmailStatus => {
  const httpStatus = err?.response?.status ?? err?.status;
  const refused =
    err?.code === "EAUTH" ||
    err?.responseCode === 535 ||
    httpStatus === 400 ||
    httpStatus === 401 ||
    httpStatus === 403 ||
    /invalid_grant|unauthorized/i.test(String(err?.message));
  return refused ? "auth_failed" : "connection_failed";
};

const selfTest = async () => {
  if (gmailApi) await gmailApi.getAccessToken();
  else if (smtp) await smtp.verify();
};

if (isEmailConfigured) {
  selfTest()
    .then(() => {
      status = "ok";
      console.log(`[EMAIL] Gmail pronto para enviar (${emailRoute})`);
    })
    .catch((err: any) => {
      status = classify(err);
      console.error(`[EMAIL] Gmail indisponível via ${emailRoute} (${status}):`, err.message);
    });
} else {
  console.warn(
    "[EMAIL] Gmail não configurado (GMAIL_USER + GMAIL_REFRESH_TOKEN ou GMAIL_APP_PASSWORD) — " +
      "os e-mails NÃO serão enviados.",
  );
}

/**
 * Sends one e-mail through Gmail. Returns false when Gmail isn't configured
 * (nothing was sent); throws if the send itself fails.
 */
export const deliverEmail = async (email: OutgoingEmail): Promise<boolean> => {
  if (!isEmailConfigured) return false;
  try {
    if (gmailApi) await sendViaApi(email);
    else await smtp!.sendMail({ from, ...email });
    status = "ok";
    return true;
  } catch (err: any) {
    status = classify(err);
    console.error(`[EMAIL] Falha ao enviar pelo Gmail (${emailRoute}):`, err.message);
    throw new Error(`Falha ao enviar e-mail: ${err.message}`);
  }
};
