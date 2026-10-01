import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middlewares/auth";
import { prioritizeDebts, simulatePayoff } from "../services/debtService";

const router = Router();

// ============================================================================
// DÍVIDAS — priorização avalanche/snowball
// ============================================================================
const debtSchema = z.object({
  creditor: z.string().min(1).max(120),
  totalAmount: z.number().positive(),
  remainingAmount: z.number().min(0),
  interestRate: z.number().min(0).optional().default(0),
  minPayment: z.number().min(0).optional().default(0),
  dueDay: z.number().min(1).max(31).optional().nullable(),
  negotiationUrl: z.string().url().optional().nullable(),
});

router.get("/api/debts", authenticate, async (req, res) => {
  const user = req.user;
  const debts = await prisma.debt.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  res.json(debts);
});

router.post("/api/debts", authenticate, async (req, res) => {
  const user = req.user;
  const data = debtSchema.parse(req.body);
  const debt = await prisma.debt.create({ data: { ...data, userId: user.id } });
  res.status(201).json(debt);
});

router.put("/api/debts/:id", authenticate, async (req, res) => {
  const user = req.user;
  const data = debtSchema.partial().parse(req.body);
  const updated = await prisma.debt.updateMany({
    where: { id: String(req.params.id), userId: user.id },
    data: { ...data, paidOff: data.remainingAmount === 0 ? true : undefined },
  });
  if (updated.count === 0) return res.status(404).json({ error: "Dívida não encontrada" });
  res.json({ ok: true });
});

router.delete("/api/debts/:id", authenticate, async (req, res) => {
  const user = req.user;
  const deleted = await prisma.debt.deleteMany({ where: { id: String(req.params.id), userId: user.id } });
  if (deleted.count === 0) return res.status(404).json({ error: "Dívida não encontrada" });
  res.json({ ok: true });
});

router.get("/api/debts/strategy", authenticate, async (req, res) => {
  const user = req.user;
  const method = req.query.method === "snowball" ? "snowball" : "avalanche";
  const extraPayment = Math.max(0, Number(req.query.extraPayment) || 0);
  const debts = await prisma.debt.findMany({ where: { userId: user.id, paidOff: false } });
  const order = prioritizeDebts(debts, method);
  const payoff = simulatePayoff(debts, method, extraPayment);
  res.json({ method, order: order.map((d) => d.id), payoff });
});

export default router;
