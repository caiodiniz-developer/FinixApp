import express from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";
import { PLANS } from "../config/plans";
import { currentMonthKey, resetMonthlyIfNeeded } from "../services/usageService";
import { JWT_SECRET } from "../config/env";

// ============================================================================
// MIDDLEWARE
// ============================================================================
// Accepts either a JWT bearer token (normal frontend session) or an
// `X-Api-Key` header (external integrations — Zapier, scripts, spreadsheets;
// see POST /api/api-keys). Both paths converge on the same `req.user`, so
// every route below works unmodified with either credential.
export const authenticateApiKey = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  const rawKey = req.headers["x-api-key"] as string | undefined;
  if (!rawKey) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  try {
    const fingerprint = crypto.createHash("sha256").update(rawKey).digest("hex");
    const apiKey = await prisma.apiKey.findUnique({ where: { keyFingerprint: fingerprint } });
    if (!apiKey || !(await bcrypt.compare(rawKey, apiKey.keyHash))) {
      res.status(401).json({ error: "API key inválida" });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: apiKey.userId },
      omit: { photo: true, companyLogo: true },
    });
    if (!user || user.blocked) {
      res.status(401).json({ error: "Usuário não encontrado ou bloqueado" });
      return;
    }
    prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    (req as any).user = user;
    (req as any).authMethod = "apikey";
    next();
  } catch {
    res.status(401).json({ error: "API key inválida" });
  }
};

export const authenticate = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  if (req.headers["x-api-key"]) {
    return authenticateApiKey(req, res, next);
  }
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  const token = auth.substring(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    // This runs on nearly every request in the app — never fetch
    // photo/companyLogo here (can be multi-MB base64 data URIs). The one
    // route that needs the real image (GET /api/auth/photo) fetches it
    // itself with an explicit `select`, on demand.
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      omit: { photo: true, companyLogo: true },
    });
    if (!user || user.blocked) {
      return res
        .status(401)
        .json({ error: "Usuário não encontrado ou bloqueado" });
    }
    const reset = await resetMonthlyIfNeeded(user.id, user.transactionsMonth);
    if (reset !== null) {
      user.transactionsUsed = 0;
      user.transactionsMonth = currentMonthKey();
    }
    (req as any).user = user;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
};

export const requireAdmin = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const user = (req as any).user;
  if (user.role !== "ADMIN") {
    return res.status(403).json({ error: "Acesso negado (admin)" });
  }
  next();
};

export type PlanFeature =
  | "hasAI"
  | "hasAdvancedAI"
  | "hasPDF"
  | "hasExcel"
  | "hasCalendar"
  | "canUseTransactions"
  | "canUseCards"
  | "canUseReports"
  | "canUseAlerts";

export const requireFeature =
  (feature: PlanFeature) =>
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user;
    const plan = PLANS[user.plan] || PLANS.FREE;
    if (!plan[feature]) {
      return res.status(403).json({
        error: "Recurso não disponível no seu plano",
        requiredFeature: feature,
        currentPlan: user.plan,
        upgrade: true,
      });
    }
    next();
  };
