import { Request, Response } from "express";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { GMAIL_SEND_SCOPE } from "../services/mailer";

// One-time setup flow that lets the API send e-mail as the Finix Gmail
// account over HTTPS (see services/mailer.ts):
//
//   GET /google/gmail/connect   → Google consent screen asking for "send mail"
//   GET /google/gmail/callback  → shows the refresh token to copy into the
//                                 GMAIL_REFRESH_TOKEN environment variable
//
// Nothing is stored here. The page only ever shows a token for the account
// that just authorized, and only if that account is GMAIL_USER.

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GMAIL_USER = (process.env.GMAIL_USER || "").trim().toLowerCase();
const isProduction = process.env.NODE_ENV === "production";

// Same host as the login callback, different path — both must be listed as
// "Authorized redirect URIs" on the OAuth client in Google Cloud Console.
const LOGIN_REDIRECT = process.env.GOOGLE_REDIRECT_URI || "http://localhost:8000/google/callback";
export const GMAIL_REDIRECT_URI = LOGIN_REDIRECT.replace(/\/google\/callback\/?$/, "/google/gmail/callback");

const client = () => new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GMAIL_REDIRECT_URI);

const STATE_COOKIE = "gmail_connect_state";

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const page = (title: string, body: string) => `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111827;">
<div style="max-width:640px;margin:48px auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:16px;">
<h1 style="margin:0 0 16px;font-size:22px;">${escapeHtml(title)}</h1>
${body}
</div></body></html>`;

export const gmailConnectController = (_req: Request, res: Response) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GMAIL_USER) {
    return res
      .status(501)
      .send(page("Configuração incompleta", "<p>Defina GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GMAIL_USER no servidor.</p>"));
  }
  const state = crypto.randomBytes(24).toString("hex");
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
    path: "/google/gmail",
  });
  res.redirect(
    client().generateAuthUrl({
      // offline + consent = Google returns a refresh token every time.
      access_type: "offline",
      prompt: "consent",
      scope: ["openid", "email", GMAIL_SEND_SCOPE],
      login_hint: GMAIL_USER,
      state,
    }),
  );
};

export const gmailCallbackController = async (req: Request, res: Response) => {
  const { code, state, error } = req.query;
  const expected = req.cookies?.[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE, { path: "/google/gmail" });

  if (typeof error === "string") {
    return res.status(400).send(page("Autorização cancelada", `<p>${escapeHtml(error)}</p>`));
  }
  if (typeof code !== "string" || typeof state !== "string" || !expected || state !== expected) {
    return res
      .status(400)
      .send(page("Link inválido ou expirado", '<p>Comece de novo em <a href="/google/gmail/connect">/google/gmail/connect</a>.</p>'));
  }

  try {
    const oauth = client();
    const { tokens } = await oauth.getToken(code);
    const ticket = tokens.id_token
      ? await oauth.verifyIdToken({ idToken: tokens.id_token, audience: GOOGLE_CLIENT_ID })
      : null;
    const email = ticket?.getPayload()?.email?.toLowerCase();

    if (email !== GMAIL_USER) {
      return res
        .status(403)
        .send(
          page(
            "Conta diferente da configurada",
            `<p>Você autorizou <b>${escapeHtml(email || "outra conta")}</b>, mas o servidor envia como <b>${escapeHtml(GMAIL_USER)}</b>. Entre com essa conta e tente de novo.</p>`,
          ),
        );
    }
    if (!tokens.scope?.includes(GMAIL_SEND_SCOPE)) {
      return res
        .status(400)
        .send(page("Permissão não concedida", "<p>Marque a permissão de <b>enviar e-mails</b> na tela do Google e tente de novo.</p>"));
    }
    if (!tokens.refresh_token) {
      return res
        .status(400)
        .send(page("O Google não devolveu o token", '<p>Tente de novo em <a href="/google/gmail/connect">/google/gmail/connect</a>.</p>'));
    }

    // Never cache a page that contains a credential.
    res.setHeader("Cache-Control", "no-store");
    res.send(
      page(
        "Gmail conectado",
        `<p>Copie o valor abaixo e crie a variável de ambiente <b>GMAIL_REFRESH_TOKEN</b> no servidor (Render → Environment). Depois salve para o serviço reiniciar.</p>
<textarea readonly onclick="this.select()" style="width:100%;height:110px;padding:12px;font-family:monospace;font-size:13px;border:1px solid #d1d5db;border-radius:10px;box-sizing:border-box;">${escapeHtml(tokens.refresh_token)}</textarea>
<p style="font-size:13px;color:#6b7280;">Trate esse valor como uma senha: ele permite enviar e-mails como ${escapeHtml(GMAIL_USER)}. Para revogar, acesse myaccount.google.com/permissions.</p>`,
      ),
    );
  } catch (err: any) {
    console.error("[GMAIL CONNECT] Falha ao trocar o código:", err.message);
    res.status(400).send(page("Não foi possível conectar", `<p>${escapeHtml(err.message || "Erro desconhecido")}</p>`));
  }
};
