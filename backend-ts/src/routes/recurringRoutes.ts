import { Router } from "express";
import { assertOwnedRefs } from "../services/ownershipService";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, requireAdmin } from "../middlewares/auth";
import { runDueRecurringTransactions } from "../services/recurringService";

const router = Router();

// ============================================================================
// RECURRING TRANSACTIONS
// ============================================================================
const recurringSchema = z.object({
  title: z.string().min(1).max(120),
  amount: z.number().positive(),
  type: z.enum(["INCOME", "EXPENSE"]),
  category: z.string().min(1),
  frequency: z.enum(["weekly", "monthly", "yearly"]),
  startDate: z.coerce.date(),
  accountId: z.string().optional(),
  cardId: z.string().optional(),
});

router.get("/api/recurring", authenticate, async (req, res) => {
  const user = req.user;
  const rules = await prisma.recurringTransaction.findMany({
    where: { userId: user.id },
    orderBy: { nextRunDate: "asc" },
  });
  res.json(rules);
});

router.post("/api/recurring", authenticate, async (req, res) => {
  const user = req.user;
  const data = recurringSchema.parse(req.body);
  await assertOwnedRefs(user.id, { accountId: data.accountId, cardId: data.cardId });
  const rule = await prisma.recurringTransaction.create({
    data: { ...data, userId: user.id, nextRunDate: data.startDate },
  });
  res.status(201).json(rule);
});

router.put("/api/recurring/:id", authenticate, async (req, res) => {
  const user = req.user;
  const data = z
    .object({ active: z.boolean().optional(), amount: z.number().positive().optional() })
    .parse(req.body);
  const updated = await prisma.recurringTransaction.updateMany({
    where: { id: String(req.params.id), userId: user.id },
    data,
  });
  if (updated.count === 0) return res.status(404).json({ error: "Recorrência não encontrada" });
  res.json({ ok: true });
});

router.delete("/api/recurring/:id", authenticate, async (req, res) => {
  const user = req.user;
  const deleted = await prisma.recurringTransaction.deleteMany({
    where: { id: String(req.params.id), userId: user.id },
  });
  if (deleted.count === 0) return res.status(404).json({ error: "Recorrência não encontrada" });
  res.json({ ok: true });
});

// Manual trigger for the daily job (also runs automatically — see
// startRecurringJobs below). Admin-only: it processes every user's rules.
router.post("/api/admin/run-recurring", authenticate, requireAdmin, async (_req, res) => {
  const result = await runDueRecurringTransactions();
  res.json(result);
});

export default router;
