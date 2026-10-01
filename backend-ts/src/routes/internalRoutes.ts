import { Router } from "express";
import express from "express";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../lib/prisma";
import { PLANS } from "../config/plans";
import { userPublic } from "../lib/userPublic";
import { JWT_SECRET } from "../config/env";

const router = Router();

// ============================================================================
// INTERNAL API
// ============================================================================
const INTERNAL_SECRET = process.env.JWT_SECRET || "finix-dev-secret";

// Constant-time compare — a plain `!==` leaks timing information proportional
// to how many leading bytes match, which is enough to brute-force a secret
// byte-by-byte. These routes have no user-level auth at all (they're the
// gateway's server-to-server trust boundary), so this header is the only gate.
const verifyInternalSecret = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const provided = String(req.headers["x-internal-secret"] || "");
  const expected = INTERNAL_SECRET;
  const ok =
    provided.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!ok) return res.status(401).json({ error: "unauthorized" });
  next();
};

router.post("/internal/update-user-plan", verifyInternalSecret, async (req, res) => {
  const {
    userId,
    plan,
    stripeCustomerId,
    stripeSubscriptionId,
    planExpiresAt,
  } = req.body;
  if (!userId) return res.status(400).json({ error: "userId obrigatório" });
  const updates: any = {};
  if (plan) {
    if (!PLANS[plan]) return res.status(400).json({ error: "plano inválido" });
    updates.plan = plan;
  }
  if (stripeCustomerId !== undefined)
    updates.stripeCustomerId = stripeCustomerId;
  if (stripeSubscriptionId !== undefined)
    updates.stripeSubscriptionId = stripeSubscriptionId;
  if (planExpiresAt !== undefined)
    updates.planExpiresAt = planExpiresAt ? new Date(planExpiresAt) : null;
  const user = await prisma.user.update({
    where: { id: userId },
    data: updates,
  });
  res.json(userPublic(user));
});

router.post("/internal/create-payment-tx", verifyInternalSecret, async (req, res) => {
  const { userId, userEmail, sessionId, amount, currency, plan, metadata } =
    req.body;
  const tx = await prisma.paymentTransaction.create({
    data: {
      id: uuidv4(),
      userId,
      userEmail,
      sessionId,
      amount,
      currency: currency || "brl",
      plan,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
  res.json(tx);
});

router.post("/internal/update-payment-tx", verifyInternalSecret, async (req, res) => {
  const { sessionId, paymentStatus, status, stripePaymentId } = req.body;
  const existing = await prisma.paymentTransaction.findUnique({
    where: { sessionId },
  });
  if (!existing) return res.status(404).json({ error: "not found" });
  const tx = await prisma.paymentTransaction.update({
    where: { sessionId },
    data: {
      paymentStatus: paymentStatus || existing.paymentStatus,
      status: status || existing.status,
      stripePaymentId: stripePaymentId || existing.stripePaymentId,
    },
  });
  res.json({ ...tx, previousStatus: existing.paymentStatus });
});

router.get("/internal/user-by-id/:id", verifyInternalSecret, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: String(req.params.id) },
  });
  if (!user) return res.status(404).json({ error: "not found" });
  res.json(userPublic(user));
});

router.get("/internal/payment-tx/:sessionId", verifyInternalSecret, async (req, res) => {
  const tx = await prisma.paymentTransaction.findUnique({
    where: { sessionId: String(req.params.sessionId) },
  });
  if (!tx) return res.status(404).json({ error: "not found" });
  res.json(tx);
});

export default router;
