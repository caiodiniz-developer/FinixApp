import { Request, Response } from "express";
import { z } from "zod";
import {
  signup,
  login,
} from "../services/authService";
import {
  accessTokenCookieOptions,
  refreshTokenCookieOptions,
  buildSafeUser,
} from "../services/tokenService";
import { AuthRequest } from "../middlewares/auth";

// With no e-mail confirmation step, this is the only check a new account gets.
const signupSchema = z.object({
  name: z.string({ required_error: "Informe seu nome" }).trim().min(2, "Nome muito curto").max(80),
  email: z.string({ required_error: "Informe seu e-mail" }).trim().email("E-mail inválido").max(254),
  password: z
    .string({ required_error: "Crie uma senha" })
    .min(6, "A senha precisa ter pelo menos 6 caracteres")
    .max(128),
});

export const signupController = async (req: Request, res: Response) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { email, password, name } = parsed.data;
    const result = await signup(email, password, name);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

const isProduction = process.env.NODE_ENV === "production";

export const loginController = async (req: Request, res: Response) => {
  try {
    const { email, password, remember = false } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email e senha são obrigatórios" });
    }
    const result = await login(email, password);
    if (remember && result.refreshToken) {
      res.cookie(
        "refresh_token",
        result.refreshToken,
        refreshTokenCookieOptions(isProduction),
      );
      res.cookie(
        "access_token",
        result.token,
        accessTokenCookieOptions(isProduction),
      );
    }
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const getMeController = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }
    // req.user is the raw Prisma row (passwordHash, verificationCode and all)
    // — never return it directly. buildSafeUser() is the sanctioned filter.
    res.json(await buildSafeUser(req.user));
  } catch (error: any) {
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};
