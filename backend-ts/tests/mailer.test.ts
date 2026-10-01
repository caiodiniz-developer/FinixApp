import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMail = vi.fn();
const verify = vi.fn();
const createTransport = vi.fn(() => ({ sendMail, verify }));

vi.mock("nodemailer", () => ({ default: { createTransport } }));

const email = { to: "ana@example.com", subject: "Código", html: "<b>123456</b>", text: "123456" };

// The mailer reads its configuration when the module loads, so each test
// sets the environment first and then imports a fresh copy.
const loadMailer = async (env: Record<string, string>) => {
  vi.resetModules();
  for (const key of ["GMAIL_USER", "GMAIL_APP_PASSWORD", "EMAIL_FROM_NAME"]) {
    vi.stubEnv(key, env[key] ?? "");
  }
  return import("../src/services/mailer");
};

beforeEach(() => {
  sendMail.mockReset().mockResolvedValue({ messageId: "1" });
  verify.mockReset().mockResolvedValue(true);
  vi.spyOn(console, "log").mockImplementation(() => {});
  createTransport.mockClear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("deliverEmail", () => {
  it("sends through Gmail as the authenticated account", async () => {
    const { deliverEmail, isEmailConfigured } = await loadMailer({
      GMAIL_USER: "finix@gmail.com",
      GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop",
    });

    expect(isEmailConfigured).toBe(true);
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

  it("uses the configured sender name", async () => {
    const { deliverEmail } = await loadMailer({
      GMAIL_USER: "finix@gmail.com",
      GMAIL_APP_PASSWORD: "abcdefghijklmnop",
      EMAIL_FROM_NAME: "Finix App",
    });
    await deliverEmail(email);
    expect(sendMail.mock.calls[0][0].from).toBe("Finix App <finix@gmail.com>");
  });

  it("throws when Gmail rejects the send", async () => {
    sendMail.mockRejectedValue(new Error("Invalid login"));
    const { deliverEmail } = await loadMailer({
      GMAIL_USER: "finix@gmail.com",
      GMAIL_APP_PASSWORD: "abcdefghijklmnop",
    });
    await expect(deliverEmail(email)).rejects.toThrow(/Invalid login/);
  });

  it("returns false, without sending, when Gmail is not configured", async () => {
    const { deliverEmail, isEmailConfigured } = await loadMailer({});
    expect(isEmailConfigured).toBe(false);
    expect(await deliverEmail(email)).toBe(false);
    expect(createTransport).not.toHaveBeenCalled();
  });
});
