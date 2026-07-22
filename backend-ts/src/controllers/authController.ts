import { Request, Response } from "express";
import {
  signup,
  login,
  verifyEmailCode,
  resendVerificationCode,
} from "../services/authService";
import {
  accessTokenCookieOptions,
  refreshTokenCookieOptions,
  buildSafeUser,
} from "../services/tokenService";
import { AuthRequest } from "../middlewares/auth";

export const signupController = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res
        .status(400)
        .json({ error: "Email, senha e nome são obrigatórios" });
    }
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

export const verifyEmailController = async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: "Email e código são obrigatórios" });
    }
    const result = await verifyEmailCode(email, code);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const resendCodeController = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email é obrigatório" });
    }
    const result = await resendVerificationCode(email);
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
    res.json(buildSafeUser(req.user));
  } catch (error: any) {
    res.status(500).json({ error: "Erro interno do servidor" });
  }
};
