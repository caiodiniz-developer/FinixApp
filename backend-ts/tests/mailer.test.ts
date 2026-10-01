import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMail = vi.fn();
const resendSend = vi.fn();
const createTransport = vi.fn(() => ({ sendMail }));

vi.mock("nodemailer", () => ({ default: { createTransport } }));
vi.mock("resend", () => ({
  Resend: vi.fn(() => ({ emails: { send: resendSend } })),
}));

const email = { to: "ana@example.com", subject: "Código", html: "<b>123456</b>", text: "123456" };

// The mailer reads its configuration when the module loads, so each test
// sets the environment first and then imports a fresh copy.
const loadMailer = async (env: Record<string, string>) => {
  vi.resetModules();
  for (const key of ["GMAIL_USER", "GMAIL_APP_PASSWORD", "RESEND_API_KEY", "EMAIL_FROM"]) {
    vi.stubEnv(key, env[key] ?? "");
  }
  return import("../src/services/mailer");
};

beforeEach(() => {
  sendMail.mockReset().mockResolvedValue({ messageId: "1" });
  resendSend.mockReset().mockResolvedValue({ data: { id: "1" }, error: null });
  createTransport.mockClear();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("deliverEmail", () => {
  it("sends through Gmail when it is configured", async () => {
    const { deliverEmail } = await loadMailer({
      GMAIL_USER: "finix@gmail.com",
      GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop",
    });

    expect(await deliverEmail(email)).toBe("gmail");
    expect(sendMail).toHaveBeenCalledWith({ from: "Finix <finix@gmail.com>", ...email });
    // the spaces Google shows in the app password are stripped
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ auth: { user: "finix@gmail.com", pass: "abcdefghijklmnop" } }),
    );
    expect(resendSend).not.toHaveBeenCalled();
  });

  it("falls back to Resend when Gmail fails", async () => {
    sendMail.mockRejectedValue(new Error("Connection timeout"));
    const { deliverEmail } = await loadMailer({
      GMAIL_USER: "finix@gmail.com",
      GMAIL_APP_PASSWORD: "abcdefghijklmnop",
      RESEND_API_KEY: "re_test",
      EMAIL_FROM: "Finix <noreply@finixapp.com.br>",
    });

    expect(await deliverEmail(email)).toBe("resend");
    expect(resendSend).toHaveBeenCalledWith(
      expect.objectContaining({ from: "Finix <noreply@finixapp.com.br>", to: ["ana@example.com"] }),
    );
  });

  it("uses Resend alone when Gmail is not configured", async () => {
    const { deliverEmail, mailProviders } = await loadMailer({ RESEND_API_KEY: "re_test" });
    expect(mailProviders).toEqual(["resend"]);
    expect(await deliverEmail(email)).toBe("resend");
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("throws when every configured provider fails", async () => {
    sendMail.mockRejectedValue(new Error("Invalid login"));
    resendSend.mockResolvedValue({ data: null, error: { message: "domain not verified" } });
    const { deliverEmail } = await loadMailer({
      GMAIL_USER: "finix@gmail.com",
      GMAIL_APP_PASSWORD: "abcdefghijklmnop",
      RESEND_API_KEY: "re_test",
    });

    await expect(deliverEmail(email)).rejects.toThrow(/gmail: Invalid login; resend: domain not verified/);
  });

  it("reports 'none' instead of failing when nothing is configured", async () => {
    const { deliverEmail, mailProviders } = await loadMailer({});
    expect(mailProviders).toEqual([]);
    expect(await deliverEmail(email)).toBe("none");
  });
});
