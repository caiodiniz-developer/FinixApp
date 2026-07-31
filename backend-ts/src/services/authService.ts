import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import {
  createAccessToken,
  createRefreshTokenForUser,
  createTwoFactorPendingToken,
  buildSafeUser,
} from "./tokenService";
import { sendVerificationEmail } from "./emailService";

const prisma = new PrismaClient();

const generateCode = () =>
  String(Math.floor(100000 + Math.random() * 900000));

export const signup = async (email: string, password: string, name: string) => {
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedName = name.trim();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
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

  let emailSent = false;
  let emailError: string | null = null;
  try {
    await sendVerificationEmail(normalizedEmail, code);
    emailSent = true;
  } catch (err: any) {
    emailError = err.message;
    console.error("[AUTH] Failed to send verification email:", err.message);
  }

  return {
    message: emailSent
      ? "Conta criada! Verifique seu e-mail para ativar a conta."
      : "Conta criada! Nao foi possivel enviar o e-mail automaticamente. Use 'Reenviar codigo' na pagina de verificacao.",
    email: normalizedEmail,
    emailSent,
    emailError: process.env.NODE_ENV !== "production" ? emailError : undefined,
  };
};

export const verifyEmailCode = async (email: string, code: string) => {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
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
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
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
    user: buildSafeUser(user),
    token: accessToken,
    refreshToken: refreshTokenResult.token,
    message: "Login realizado com sucesso",
  };
};

export const completeTwoFactorLogin = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.blocked) throw new Error("Usuário não encontrado ou bloqueado");

  const accessToken = createAccessToken(user);
  const refreshTokenResult = await createRefreshTokenForUser(user.id);

  return {
    user: buildSafeUser(user),
    token: accessToken,
    refreshToken: refreshTokenResult.token,
    message: "Login realizado com sucesso",
  };
};
