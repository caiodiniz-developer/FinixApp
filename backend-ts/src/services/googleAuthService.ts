import { OAuth2Client } from "google-auth-library";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";
import {
  createAccessToken,
  createRefreshTokenForUser,
  buildSafeUser,
} from "./tokenService";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || "http://localhost:8000/google/callback";

const oauthClient = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
);

console.log("[GoogleAuthService] Config:", {
  clientId: GOOGLE_CLIENT_ID ? GOOGLE_CLIENT_ID.slice(0, 20) + "..." : "MISSING",
  clientSecret: GOOGLE_CLIENT_SECRET ? "SET (" + GOOGLE_CLIENT_SECRET.length + " chars)" : "MISSING (empty!)",
  redirectUri: GOOGLE_REDIRECT_URI,
});

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.warn(
    "[GoogleAuthService] Faltando GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET. Configure o .env.",
  );
}

export const getGoogleAuthUrl = (state: string) => {
  return oauthClient.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["openid", "email", "profile"],
    state,
  });
};

export interface GoogleProfile {
  email: string;
  verified_email: boolean;
  name: string;
  picture?: string;
  sub: string;
}

export const verifyGoogleCode = async (
  code: string,
): Promise<GoogleProfile> => {
  const { tokens } = await oauthClient.getToken(code);
  if (!tokens.id_token) {
    throw new Error("Falha ao obter o ID token do Google");
  }

  const ticket = await oauthClient.verifyIdToken({
    idToken: tokens.id_token,
    audience: GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email || !payload.sub) {
    throw new Error("Dados de perfil do Google incompletos");
  }

  return {
    email: payload.email.toLowerCase(),
    verified_email: !!payload.email_verified,
    name: payload.name || "Usuário Google",
    picture: payload.picture,
    sub: payload.sub,
  };
};

export const findOrCreateGoogleUser = async (profile: GoogleProfile) => {
  const normalizedEmail = profile.email.toLowerCase().trim();

  let user = await prisma.user.findUnique({ where: { googleId: profile.sub } });
  if (!user) {
    user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  }

  if (user) {
    const updates: any = {
      name: profile.name,
      photo: profile.picture,
      isVerified: true,
      authProvider: "google",
      googleId: profile.sub,
    };

    user = await prisma.user.update({
      where: { id: user.id },
      data: updates,
    });
    return user;
  }

  const randomSecret = crypto.randomBytes(48).toString("hex");
  const passwordHash = await bcrypt.hash(randomSecret, 10);

  user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: profile.name,
      passwordHash,
      photo: profile.picture,
      isVerified: true,
      authProvider: "google",
      googleId: profile.sub,
    },
  });

  return user;
};

export const buildGoogleAuthResponse = async (user: any) => {
  const accessToken = createAccessToken(user);
  const refreshTokenResult = await createRefreshTokenForUser(user.id);

  return {
    accessToken,
    refreshToken: refreshTokenResult.token,
    user: await buildSafeUser(user),
  };
};
