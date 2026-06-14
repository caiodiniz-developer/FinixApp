import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import {
  createAccessToken,
  createRefreshTokenForUser,
  buildSafeUser,
} from "./tokenService";

const prisma = new PrismaClient();

export const signup = async (email: string, password: string, name: string) => {
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedName = name.trim();

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existingUser) {
    throw new Error("Usuário já existe");
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Create user
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      name: normalizedName,
      isVerified: true,
    },
  });

  return {
    userId: user.id,
    message: "Usuário criado com sucesso. Faça login.",
  };
};

export const login = async (email: string, password: string) => {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (!user) {
    throw new Error("Credenciais inválidas");
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new Error("Credenciais inválidas");
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
