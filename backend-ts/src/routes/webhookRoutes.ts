import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middlewares/authenticate";
import { generateWebhookSecret } from "../services/webhookService";

const router = Router();

// ============================================================================
// OUTBOUND WEBHOOKS
// ============================================================================
const webhookSchema = z.object({
  url: z.string().url(),
  events: z.array(
    z.enum([
      "transaction.created",
      "transaction.deleted",
      "goal.created",
      "goal.completed",
      "installment.created",
      "alert.due_soon",
      "alert.anomaly_detected",
    ]),
  ).min(1),
});

router.get("/api/webhooks", authenticate, async (req, res) => {
  const user = (req as any).user;
  const webhooks = await prisma.webhookSubscription.findMany({ where: { userId: user.id } });
  res.json(webhooks.map((w) => ({ ...w, events: JSON.parse(w.events) })));
});

router.post("/api/webhooks", authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = webhookSchema.parse(req.body);
  const secret = generateWebhookSecret();
  const webhook = await prisma.webhookSubscription.create({
    data: { userId: user.id, url: data.url, events: JSON.stringify(data.events), secret },
  });
  // The signing secret is only ever returned here, at creation time.
  res.status(201).json({ ...webhook, events: data.events });
});

router.delete("/api/webhooks/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const deleted = await prisma.webhookSubscription.deleteMany({
    where: { id: String(req.params.id), userId: user.id },
  });
  if (deleted.count === 0) return res.status(404).json({ error: "Webhook não encontrado" });
  res.json({ ok: true });
});

export default router;
