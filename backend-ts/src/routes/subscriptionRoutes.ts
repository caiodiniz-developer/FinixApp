import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middlewares/auth";
import { computeNextRunDate } from "../services/recurringService";
import { detectZombieSubscriptions } from "../services/subscriptionDetectorService";

const router = Router();

// ============================================================================
// CAÇA-FANTASMA DE ASSINATURAS
// ============================================================================
router.get("/api/subscriptions/detected", authenticate, async (req, res) => {
  const user = req.user;
  const detected = await detectZombieSubscriptions(user.id);
  res.json(detected);
});

router.post("/api/subscriptions/dismiss", authenticate, async (req, res) => {
  const user = req.user;
  const { signature } = z.object({ signature: z.string() }).parse(req.body);
  await prisma.subscriptionInsightDismissal.upsert({
    where: { userId_signature: { userId: user.id, signature } },
    create: { userId: user.id, signature },
    update: {},
  });
  res.json({ ok: true });
});

router.post("/api/subscriptions/convert", authenticate, async (req, res) => {
  const user = req.user;
  const data = z
    .object({ title: z.string().min(1), amount: z.number().positive(), category: z.string().min(1) })
    .parse(req.body);
  const rule = await prisma.recurringTransaction.create({
    data: {
      userId: user.id,
      title: data.title,
      amount: data.amount,
      type: "EXPENSE",
      category: data.category,
      frequency: "monthly",
      startDate: new Date(),
      nextRunDate: computeNextRunDate(new Date(), "monthly"),
    },
  });
  res.status(201).json(rule);
});

export default router;
