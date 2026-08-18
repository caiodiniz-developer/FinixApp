import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";
import {
  createAccessToken,
  createRefreshTokenForUser,
  createTwoFactorPendingToken,
  buildSafeUser,
} from "./tokenService";
import { sendVerificationEmail } from "./emailService";

const generateCode = () =>
  String(Math.floor(100000 + Math.random() * 900000));

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
  const code = generateCode();
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      name: normalizedName,
      isVerified: false,
      verificationCode: code,
      verificationExpires: expires,
    },
  });

  // The Resend API round-trip is the single slowest part of signup (often
  // 1-3s) and the frontend never actually reads emailSent/emailError from
  // this response — it just shows the same "verifique seu e-mail" message
  // either way, with a "reenviar código" button as the fallback. So there's
  // nothing gained by making the user wait for it: respond as soon as the
  // account exists, send the e-mail in the background.
  sendVerificationEmail(normalizedEmail, code).catch((err) => {
    console.error("[AUTH] Failed to send verification email:", err.message);
  });

  return {
    message: "Conta criada! Verifique seu e-mail para ativar a conta.",
    email: normalizedEmail,
    emailSent: true,
  };
};

export const verifyEmailCode = async (email: string, code: string) => {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    omit: { photo: true, companyLogo: true },
  });

  if (!user) throw new Error("Usuário não encontrado");
  if (user.isVerified) throw new Error("E-mail já verificado");
  if (!user.verificationCode || !user.verificationExpires) {
    throw new Error("Nenhum código pendente. Solicite um novo código.");
  }
  if (new Date() > user.verificationExpires) {
    throw new Error("Código expirado. Solicite um novo código.");
  }
  if (user.verificationCode !== code.trim()) {
    throw new Error("Código inválido");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      isVerified: true,
      verificationCode: null,
      verificationExpires: null,
    },
  });

  return { message: "E-mail verificado com sucesso!" };
};

export const resendVerificationCode = async (email: string) => {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    omit: { photo: true, companyLogo: true },
  });

  if (!user) throw new Error("Usuário não encontrado");
  if (user.isVerified) throw new Error("E-mail já verificado");

  const code = generateCode();
  const expires = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { verificationCode: code, verificationExpires: expires },
  });

  await sendVerificationEmail(normalizedEmail, code);
  return { message: "Novo código enviado para seu e-mail." };
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

  if (!user.isVerified) {
    throw new Error(
      "E-mail não verificado. Verifique seu e-mail antes de fazer login.",
    );
  }

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
