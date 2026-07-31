import { authenticator } from "otplib";
import QRCode from "qrcode";
import crypto from "crypto";
import bcrypt from "bcrypt";

authenticator.options = { window: 1 }; // accepts 1 step of clock drift (~30s) either side

export const generateSecret = () => authenticator.generateSecret();

export const buildOtpAuthUrl = (email: string, secret: string) =>
  authenticator.keyuri(email, "Finix", secret);

export const generateQrCodeDataUri = async (otpAuthUrl: string): Promise<string> =>
  QRCode.toDataURL(otpAuthUrl);

export const verifyToken = (token: string, secret: string): boolean => {
  try {
    return authenticator.check(token, secret);
  } catch {
    return false;
  }
};

/** 10 backup codes, shown once in plaintext; only bcrypt hashes are persisted. */
export const generateBackupCodes = (): string[] =>
  Array.from({ length: 10 }, () => crypto.randomBytes(5).toString("hex"));

export const hashBackupCodes = async (codes: string[]): Promise<string> => {
  const hashed = await Promise.all(codes.map((c) => bcrypt.hash(c, 10)));
  return JSON.stringify(hashed);
};

/** Returns the remaining (still-hashed) codes list if `code` matched one, so the
 * caller can persist it back and consume the code (each backup code is one-time use). */
export const consumeBackupCode = async (
  code: string,
  storedHashesJson: string | null,
): Promise<{ valid: boolean; remaining: string }> => {
  const hashes: string[] = storedHashesJson ? JSON.parse(storedHashesJson) : [];
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(code, hashes[i])) {
      const remaining = [...hashes.slice(0, i), ...hashes.slice(i + 1)];
      return { valid: true, remaining: JSON.stringify(remaining) };
    }
  }
  return { valid: false, remaining: storedHashesJson || "[]" };
};
