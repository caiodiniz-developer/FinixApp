import { Request, Response } from "express";
import {
  getGoogleAuthUrl,
  verifyGoogleCode,
  findOrCreateGoogleUser,
  buildGoogleAuthResponse,
} from "../services/googleAuthService";
import {
  createAccessToken,
  verifyRefreshToken,
  revokeRefreshToken,
  refreshTokenCookieOptions,
  accessTokenCookieOptions,
  buildSafeUser,
} from "../services/tokenService";
import { prisma } from "../lib/prisma";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const isProduction = process.env.NODE_ENV === "production";

export const googleRedirectController = async (req: Request, res: Response) => {
  try {
    const state = Math.random().toString(36).substring(2, 15);
    const authUrl = getGoogleAuthUrl(state);

    res.cookie("google_oauth_state", state, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 5 * 60 * 1000,
      path: "/",
    });

    return res.redirect(authUrl);
  } catch (error: any) {
    console.error("[OAuth] googleRedirectController error:", error);
    return res.status(500).json({ error: "Falha ao iniciar login com Google" });
  }
};

export const googleCallbackController = async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    const storedState = req.cookies?.google_oauth_state;

    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "Código OAuth não foi fornecido" });
    }

    if (
      !state ||
      typeof state !== "string" ||
      !storedState ||
      state !== storedState
    ) {
      console.warn("[OAuth] invalid state", { state, storedState });
      return res.status(400).json({ error: "Estado OAuth inválido" });
    }

    res.clearCookie("google_oauth_state", { path: "/" });

    const profile = await verifyGoogleCode(code);
    const user = await findOrCreateGoogleUser(profile);
    const authResponse = await buildGoogleAuthResponse(user);

    res.cookie(
      "refresh_token",
      authResponse.refreshToken,
      refreshTokenCookieOptions(isProduction),
    );
    res.cookie(
      "access_token",
      authResponse.accessToken,
      accessTokenCookieOptions(isProduction),
    );

    // Tokens travel in the URL fragment: it never reaches a server or its
    // access logs, and the callback page wipes it from the address bar.
    const fragment = new URLSearchParams({
      token: authResponse.accessToken,
      refreshToken: authResponse.refreshToken,
    }).toString();
    return res.redirect(`${FRONTEND_URL}/oauth-callback#${fragment}`);
  } catch (error: any) {
    console.error("[OAuth] googleCallbackController error:", {
      message: error.message,
      status: error.status,
      response: error.response?.data,
      code: error.code,
    });
    return res.redirect(
      `${FRONTEND_URL}/oauth-callback?success=false&message=${encodeURIComponent(error.message || "Erro ao autenticar")}`,
    );
  }
};

export const refreshTokenController = async (req: Request, res: Response) => {
  try {
    // The SPA and the API live on different sites, so the browser does not
    // send the SameSite cookie on XHR — the client sends the token in the body.
    const token = req.body?.refreshToken || req.cookies?.refresh_token;
    if (!token || typeof token !== "string") {
      return res.status(401).json({ error: "Refresh token não fornecido" });
    }

    const refreshRecord = await verifyRefreshToken(token);
    if (!refreshRecord || !refreshRecord.user || refreshRecord.user.blocked) {
      return res
        .status(401)
        .json({ error: "Refresh token inválido ou expirado" });
    }

    const accessToken = createAccessToken(refreshRecord.user);
    res.cookie(
      "access_token",
      accessToken,
      accessTokenCookieOptions(isProduction),
    );

    return res.json({
      token: accessToken,
      user: await buildSafeUser(refreshRecord.user),
    });
  } catch (error: any) {
    console.error("[OAuth] refreshTokenController error:", error);
    return res.status(500).json({ error: "Erro ao renovar sessão" });
  }
};

export const logoutController = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.body?.refreshToken || req.cookies?.refresh_token;
    if (refreshToken && typeof refreshToken === "string") {
      await revokeRefreshToken(refreshToken);
    }

    res.clearCookie("access_token", { path: "/" });
    res.clearCookie("refresh_token", { path: "/" });
    return res.json({ message: "Logout realizado com sucesso" });
  } catch (error: any) {
    console.error("[OAuth] logoutController error:", error);
    return res.status(500).json({ error: "Erro ao encerrar sessão" });
  }
};
