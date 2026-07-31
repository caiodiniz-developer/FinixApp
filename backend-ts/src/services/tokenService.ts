import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { PrismaClient, User, RefreshToken } from "@prisma/client";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "finix-dev-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
const REFRESH_TOKEN_EXPIRES_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: string;
  blocked: boolean;
  plan: string;
  transactionsUsed: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  planExpiresAt: Date | null;
  hasCompletedOnboarding: boolean;
  usageType: string | null;
  companyName: string | null;
  businessPurpose: string | null;
  primaryColor: string | null;
  isVerified: boolean;
  createdAt: Date;
  /** Data URIs can be multiple MB — never inline them in an auth response
   * (login/me/refresh-token). Fetch the real value once from GET /api/auth/photo. */
  hasPhoto: boolean;
  hasCompanyLogo: boolean;
  twoFactorEnabled: boolean;
}

// This is the single point every auth response (login, /me, refresh-token)
// funnels through — nothing sensitive (passwordHash, verification codes) or
// oversized (photo/companyLogo data URIs) may ever leave this function.
export const buildSafeUser = (user: User): SafeUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  blocked: user.blocked,
  plan: user.plan,
  transactionsUsed: user.transactionsUsed,
  stripeCustomerId: user.stripeCustomerId,
  stripeSubscriptionId: user.stripeSubscriptionId,
  planExpiresAt: user.planExpiresAt,
  hasCompletedOnboarding: user.hasCompletedOnboarding,
  usageType: user.usageType,
  companyName: user.companyName,
  businessPurpose: user.businessPurpose,
  primaryColor: user.primaryColor,
  isVerified: user.isVerified,
  createdAt: user.createdAt,
  hasPhoto: !!user.photo,
  hasCompanyLogo: !!user.companyLogo,
  twoFactorEnabled: (user as any).twoFactorEnabled ?? false,
});

/** Short-lived token issued after password check when 2FA is enabled — proves
 * the password step passed, but is NOT a valid access token on its own (no
 * `sub`-only claim collision risk: `authenticate` middlewares require a plain
 * `sub`, this carries `twoFactorPending` too and is only accepted by the
 * dedicated /api/auth/2fa/login route). */
export const createTwoFactorPendingToken = (userId: string): string => {
  return jwt.sign({ sub: userId, twoFactorPending: true }, JWT_SECRET, {
    expiresIn: "5m",
  } as jwt.SignOptions);
};

export const verifyTwoFactorPendingToken = (token: string): string | null => {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (!payload?.twoFactorPending || !payload?.sub) return null;
    return payload.sub as string;
  } catch {
    return null;
  }
};

export const createAccessToken = (user: User): string => {
  const secret = (JWT_SECRET || "finix-dev-secret") as any;
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      provider: (user as any).authProvider || "local",
    },
    secret,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions,
  );
};

const createTokenFingerprint = (token: string) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

export const createRefreshTokenForUser = async (
  userId: string,
): Promise<{ token: string; expiresAt: number }> => {
  const token = crypto.randomBytes(64).toString("hex");
  const tokenHash = await bcrypt.hash(token, 10);
  const tokenFingerprint = createTokenFingerprint(token);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_MS);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      tokenFingerprint,
      expiresAt,
    },
  });

  return { token, expiresAt: expiresAt.getTime() };
};

export const verifyRefreshToken = async (
  token: string,
): Promise<(RefreshToken & { user: User }) | null> => {
  const tokenFingerprint = createTokenFingerprint(token);
  const refreshToken = await prisma.refreshToken.findUnique({
    where: { tokenFingerprint },
    include: { user: true },
  });

  if (!refreshToken || refreshToken.expiresAt < new Date()) {
    return null;
  }

  const isValid = await bcrypt.compare(token, refreshToken.tokenHash);
  if (!isValid) {
    return null;
  }

  return refreshToken as RefreshToken & { user: User };
};

export const revokeRefreshToken = async (token: string) => {
  const tokenFingerprint = createTokenFingerprint(token);
  await prisma.refreshToken.deleteMany({ where: { tokenFingerprint } });
};

export const revokeUserRefreshTokens = async (userId: string) => {
  await prisma.refreshToken.deleteMany({ where: { userId } });
};

export const parseJwtPayload = (token: string) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

export const refreshTokenCookieOptions = (secure: boolean) => ({
  httpOnly: true,
  secure,
  sameSite: "lax" as const,
  maxAge: REFRESH_TOKEN_EXPIRES_MS,
  path: "/",
});

export const accessTokenCookieOptions = (secure: boolean) => ({
  httpOnly: true,
  secure,
  sameSite: "lax" as const,
  maxAge: 15 * 60 * 1000,
  path: "/",
});
