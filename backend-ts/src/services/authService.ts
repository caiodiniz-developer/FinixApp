import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";
import {
  createAccessToken,
  createRefreshTokenForUser,
  createTwoFactorPendingToken,
  buildSafeUser,
} from "./tokenService";

export const signup = async (email: string, password: string, name: string) => {
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedName = name.trim();

  // omit: photo/companyLogo can be multi-MB base64 data URIs (see
  // tokenService.SafeUser) — fetching them here just to check `if
  // (existingUser)` would drag that payload across the network for nothing.
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    omit: { photo: true, companyLogo: true },
  });
  if (existingUser) {
    throw new Error("Usuário já existe");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Accounts are usable right away — there is no e-mail confirmation step.
  // (isVerified is kept on the row, always true, for older code and data.)
  await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      name: normalizedName,
      isVerified: true,
    },
  });

  return {
    message: "Conta criada! Faça login para continuar.",
    email: normalizedEmail,
  };
};

export const login = async (email: string, password: string) => {
  const normalizedEmail = email.toLowerCase().trim();
  // This is the single hottest query in the app — every login pays for it.
  // Omitting photo/companyLogo (can be multi-MB base64 data URIs, see
  // tokenService.SafeUser) was the single biggest latency win found: a user
  // with a photo set was turning every login into a multi-megabyte fetch
  // over the wire to Neon for data that buildSafeUser() throws away anyway.
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    omit: { photo: true, companyLogo: true },
  });
  if (!user) throw new Error("Credenciais inválidas");

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) throw new Error("Credenciais inválidas");

  if (user.twoFactorEnabled) {
    return {
      requiresTwoFactor: true as const,
      pendingToken: createTwoFactorPendingToken(user.id),
      message: "Informe o código do seu aplicativo autenticador",
    };
  }

  const accessToken = createAccessToken(user);
  const refreshTokenResult = await createRefreshTokenForUser(user.id);

  return {
    user: await buildSafeUser(user),
    token: accessToken,
    refreshToken: refreshTokenResult.token,
    message: "Login realizado com sucesso",
  };
};

export const completeTwoFactorLogin = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    omit: { photo: true, companyLogo: true },
  });
  if (!user || user.blocked) throw new Error("Usuário não encontrado ou bloqueado");

  const accessToken = createAccessToken(user);
  const refreshTokenResult = await createRefreshTokenForUser(user.id);

  return {
    user: await buildSafeUser(user),
    token: accessToken,
    refreshToken: refreshTokenResult.token,
    message: "Login realizado com sucesso",
  };
};
