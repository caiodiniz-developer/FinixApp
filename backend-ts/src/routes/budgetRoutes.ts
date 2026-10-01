import { Router } from "express";
import { appNow } from "../lib/dates";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middlewares/auth";
import { budgetSchema } from "../schemas";

const router = Router();

// ============================================================================
// BUDGETS
// ============================================================================
router.get("/api/budgets", authenticate, async (req, res) => {
  const user = req.user;
  const budgets = await prisma.budget.findMany({ where: { userId: user.id } });
  const now = appNow();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id, type: "EXPENSE", date: { gte: monthStart } },
  });
  const spentByCategory: Record<string, number> = {};
  transactions.forEach((t) => {
    spentByCategory[t.category] = (spentByCategory[t.category] || 0) + t.amount;
  });
  const result = budgets.map((b) => ({
    ...b,
    spent: spentByCategory[b.category] || 0,
    percentage:
      b.limit > 0 ? ((spentByCategory[b.category] || 0) / b.limit) * 100 : 0,
  }));
  res.json(result);
});

router.post("/api/budgets", authenticate, async (req, res) => {
  const user = req.user;
  const data = budgetSchema.parse(req.body);
  try {
    const budget = await prisma.budget.create({
      data: { ...data, id: uuidv4(), userId: user.id },
    });
    res.json(budget);
  } catch {
    res
      .status(400)
      .json({ error: "Já existe um orçamento para esta categoria" });
  }
});

router.put("/api/budgets/:id", authenticate, async (req, res) => {
  const user = req.user;
  const data = budgetSchema.parse(req.body);
  const budget = await prisma.budget.updateMany({
    where: { id: String(req.params.id), userId: user.id },
    data,
  });
  if (budget.count === 0)
    return res.status(404).json({ error: "Orçamento não encontrado" });
  const updated = await prisma.budget.findUnique({
    where: { id: String(req.params.id) },
  });
  res.json(updated);
});

router.delete("/api/budgets/:id", authenticate, async (req, res) => {
  const user = req.user;
  const deleted = await prisma.budget.deleteMany({
    where: { id: String(req.params.id), userId: user.id },
  });
  if (deleted.count === 0)
    return res.status(404).json({ error: "Orçamento não encontrado" });
  res.json({ ok: true });
});

export default router;
