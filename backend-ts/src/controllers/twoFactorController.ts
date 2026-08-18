import { Response } from "express";
import { prisma } from "../lib/prisma";
import bcrypt from "bcrypt";
import { AuthRequest } from "../middlewares/auth";
import {
  generateSecret,
  buildOtpAuthUrl,
  generateQrCodeDataUri,
  verifyToken,
  generateBackupCodes,
  hashBackupCodes,
  consumeBackupCode,
} from "../services/twoFactorService";
import {
  verifyTwoFactorPendingToken,
} from "../services/tokenService";
import { completeTwoFactorLogin } from "../services/authService";

// Step 1: generate a secret + QR code, but DON'T enable 2FA yet — the user
// must prove they scanned it correctly via POST /api/2fa/verify first.
// Otherwise a typo while setting up would permanently lock them out.
export const setupTwoFactor = async (req: AuthRequest, res: Response) => {
  const user = req.user;
  if (user.twoFactorEnabled) {
    return res.status(400).json({ error: "2FA já está ativado nesta conta" });
  }
  const secret = generateSecret();
  const otpAuthUrl = buildOtpAuthUrl(user.email, secret);
  const qrCode = await generateQrCodeDataUri(otpAuthUrl);

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorSecret: secret }, // stored, but twoFactorEnabled stays false until verified
  });

  res.json({ secret, qrCode });
};

export const verifyAndEnableTwoFactor = async (req: AuthRequest, res: Response) => {
  const user = req.user;
  const { token } = req.body;
  if (!user.twoFactorSecret) {
    return res.status(400).json({ error: "Rode /api/2fa/setup primeiro" });
  }
  if (!token || !verifyToken(String(token), user.twoFactorSecret)) {
    return res.status(400).json({ error: "Código inválido" });
  }

  const backupCodes = generateBackupCodes();
  const backupCodesHash = await hashBackupCodes(backupCodes);

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: true, twoFactorBackupCodes: backupCodesHash },
  });

  // Backup codes are shown exactly once — only bcrypt hashes are persisted.
  res.json({ enabled: true, backupCodes });
};

export const disableTwoFactor = async (req: AuthRequest, res: Response) => {
  const user = req.user;
  const { password, token } = req.body;
  if (!password || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Senha incorreta" });
  }
  if (user.twoFactorEnabled && (!token || !verifyToken(String(token), user.twoFactorSecret || ""))) {
    return res.status(400).json({ error: "Código 2FA inválido" });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: null },
  });
  res.json({ enabled: false });
};

// Step 2 of login when the account has 2FA enabled: exchange the short-lived
// pendingToken (proves the password step already passed) + a TOTP code (or a
// one-time backup code) for real access/refresh tokens.
export const completeTwoFactorLoginController = async (req: AuthRequest, res: Response) => {
  try {
    const { pendingToken, token, backupCode } = req.body;
    const userId = verifyTwoFactorPendingToken(pendingToken);
    if (!userId) {
      return res.status(401).json({ error: "Sessão de login expirada, faça login novamente" });
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      omit: { photo: true, companyLogo: true },
    });
    if (!user || !user.twoFactorEnabled) {
      return res.status(401).json({ error: "2FA não está ativo para esta conta" });
    }

    let ok = false;
    if (token && user.twoFactorSecret) {
      ok = verifyToken(String(token), user.twoFactorSecret);
    } else if (backupCode) {
      const result = await consumeBackupCode(String(backupCode), user.twoFactorBackupCodes);
      ok = result.valid;
      if (ok) {
        await prisma.user.update({
          where: { id: user.id },
          data: { twoFactorBackupCodes: result.remaining },
        });
      }
    }

    if (!ok) return res.status(400).json({ error: "Código inválido" });

    const result = await completeTwoFactorLogin(userId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Falha ao completar login" });
  }
};
