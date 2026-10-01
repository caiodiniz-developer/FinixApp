import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middlewares/authenticate";
import { sendPushToUser, getVapidPublicKey, isPushConfigured } from "../services/pushService";

const router = Router();

// ============================================================================
// SHARED-GOAL CONTRIBUTIONS (webhook on completion is handled in PUT /api/goals/:id)
// PUSH NOTIFICATIONS (Web Push — self-hosted, VAPID)
// ============================================================================
router.get("/api/push/vapid-public-key", (_req, res) => {
  const key = getVapidPublicKey();
  if (!key) return res.status(501).json({ error: "Push não configurado no servidor" });
  res.json({ publicKey: key });
});

const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

router.post("/api/push/subscribe", authenticate, async (req, res) => {
  if (!isPushConfigured) return res.status(501).json({ error: "Push não configurado no servidor" });
  const user = (req as any).user;
  const data = pushSubscribeSchema.parse(req.body);
  await prisma.pushSubscription.upsert({
    where: { endpoint: data.endpoint },
    create: { userId: user.id, endpoint: data.endpoint, p256dh: data.keys.p256dh, auth: data.keys.auth },
    update: { userId: user.id, p256dh: data.keys.p256dh, auth: data.keys.auth },
  });
  res.status(201).json({ ok: true });
});

router.post("/api/push/unsubscribe", authenticate, async (req, res) => {
  const { endpoint } = z.object({ endpoint: z.string() }).parse(req.body);
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  res.json({ ok: true });
});

router.post("/api/push/test", authenticate, async (req, res) => {
  const user = (req as any).user;
  await sendPushToUser(user.id, { title: "Finix", body: "Notificação de teste — tudo funcionando!" });
  res.json({ ok: true });
});

export default router;
