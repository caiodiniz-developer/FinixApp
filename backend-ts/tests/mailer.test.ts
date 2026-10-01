import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMail = vi.fn();
const verify = vi.fn();
const createTransport = vi.fn(() => ({ sendMail, verify }));

const apiRequest = vi.fn();
const getAccessToken = vi.fn();
const setCredentials = vi.fn();

vi.mock("nodemailer", () => ({ default: { createTransport } }));
vi.mock("google-auth-library", () => ({
  OAuth2Client: vi.fn(() => ({ request: apiRequest, getAccessToken, setCredentials })),
}));

const email = { to: "ana@example.com", subject: "Seu codigo", html: "<b>123456</b>", text: "123456" };

const ENV_KEYS = [
  "GMAIL_USER",
  "GMAIL_APP_PASSWORD",
  "GMAIL_REFRESH_TOKEN",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "EMAIL_FROM_NAME",
];

// The mailer reads its configuration when the module loads, so each test
// sets the environment first and then imports a fresh copy.
const loadMailer = async (env: Record<string, string>) => {
  vi.resetModules();
  for (const key of ENV_KEYS) vi.stubEnv(key, env[key] ?? "");
  const mailer = await import("../src/services/mailer");
  await new Promise((resolve) => setTimeout(resolve, 0)); // let the boot self-test settle
  return mailer;
};

const SMTP_ENV = { GMAIL_USER: "finix@gmail.com", GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop" };
const API_ENV = {
  GMAIL_USER: "finix@gmail.com",
  GMAIL_REFRESH_TOKEN: "1//refresh",
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_CLIENT_SECRET: "client-secret",
};

beforeEach(() => {
  sendMail.mockReset().mockResolvedValue({ messageId: "1" });
  verify.mockReset().mockResolvedValue(true);
  apiRequest.mockReset().mockResolvedValue({ data: { id: "msg-1" } });
  getAccessToken.mockReset().mockResolvedValue({ token: "access" });
  setCredentials.mockClear();
  createTransport.mockClear();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Gmail API route (HTTPS)", () => {
  it("is used when a refresh token is configured", async () => {
    const { deliverEmail, emailRoute, getEmailStatus } = await loadMailer(API_ENV);

    expect(emailRoute).toBe("gmail-api");
    expect(setCredentials).toHaveBeenCalledWith({ refresh_token: "1//refresh" });
    expect(getEmailStatus()).toBe("ok");

    expect(await deliverEmail(email)).toBe(true);
    expect(createTransport).not.toHaveBeenCalled();

    const call = apiRequest.mock.calls[0][0];
    expect(call.url).toBe("https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    expect(call.method).toBe("POST");
    // `raw` is the full MIME message, base64url-encoded
    expect(call.data.raw).toMatch(/^[A-Za-z0-9_-]+$/);
    const mime = Buffer.from(call.data.raw, "base64url").toString("utf8");
    expect(mime).toContain("From: Finix <finix@gmail.com>");
    expect(mime).toContain("To: ana@example.com");
    expect(mime).toContain("Subject: Seu codigo");
  });

  it("wins over SMTP when both are configured", async () => {
    const { emailRoute } = await loadMailer({ ...SMTP_ENV, ...API_ENV });
    expect(emailRoute).toBe("gmail-api");
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("reports auth_failed when Google rejects the refresh token", async () => {
    getAccessToken.mockRejectedValue(new Error("invalid_grant"));
    const { getEmailStatus } = await loadMailer(API_ENV);
    expect(getEmailStatus()).toBe("auth_failed");
  });

  it("throws and records the failure when a send is refused", async () => {
    apiRequest.mockRejectedValue(Object.assign(new Error("Forbidden"), { response: { status: 403 } }));
    const { deliverEmail, getEmailStatus } = await loadMailer(API_ENV);
    await expect(deliverEmail(email)).rejects.toThrow(/Forbidden/);
    expect(getEmailStatus()).toBe("auth_failed");
  });
});

describe("Gmail SMTP route", () => {
  it("is used when only the app password is configured", async () => {
    const { deliverEmail, emailRoute } = await loadMailer(SMTP_ENV);

    expect(emailRoute).toBe("gmail-smtp");
    expect(await deliverEmail(email)).toBe(true);
    expect(sendMail).toHaveBeenCalledWith({ from: "Finix <finix@gmail.com>", ...email });
    // the spaces Google shows in the app password are stripped
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.gmail.com",
        auth: { user: "finix@gmail.com", pass: "abcdefghijklmnop" },
      }),
    );
  });

  it("reports connection_failed when the host blocks SMTP", async () => {
    verify.mockRejectedValue(Object.assign(new Error("Connection timeout"), { code: "ETIMEDOUT" }));
    const { getEmailStatus } = await loadMailer(SMTP_ENV);
    expect(getEmailStatus()).toBe("connection_failed");
  });

  it("reports auth_failed for a wrong app password", async () => {
    verify.mockRejectedValue(Object.assign(new Error("Invalid login"), { code: "EAUTH" }));
    const { getEmailStatus } = await loadMailer(SMTP_ENV);
    expect(getEmailStatus()).toBe("auth_failed");
  });
});

describe("no configuration", () => {
  it("returns false without sending anything", async () => {
    const { deliverEmail, isEmailConfigured, getEmailStatus } = await loadMailer({});
    expect(isEmailConfigured).toBe(false);
    expect(getEmailStatus()).toBe("not_configured");
    expect(await deliverEmail(email)).toBe(false);
    expect(apiRequest).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });
});
