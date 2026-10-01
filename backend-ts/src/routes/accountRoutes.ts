import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../lib/prisma";
import { PLANS } from "../config/plans";
import { authenticate } from "../middlewares/auth";
import { accountSchema } from "../schemas";

const router = Router();

// ============================================================================
// ACCOUNTS
// ============================================================================
router.get("/api/accounts", authenticate, async (req, res) => {
  const user = req.user;
  const accounts = await prisma.account.findMany({
    where: { userId: user.id, archived: false },
    orderBy: { createdAt: "asc" },
  });
  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id, accountId: { in: accounts.map((a) => a.id) } },
    select: { accountId: true, amount: true, type: true },
  });
  const balanceByAccount: Record<string, number> = {};
  transactions.forEach((t) => {
    const delta = t.type === "INCOME" ? t.amount : -t.amount;
    balanceByAccount[t.accountId as string] =
      (balanceByAccount[t.accountId as string] || 0) + delta;
  });
  res.json(accounts.map((a) => ({ ...a, balance: balanceByAccount[a.id] || 0 })));
});

router.post("/api/accounts", authenticate, async (req, res) => {
  const user = req.user;
  const data = accountSchema.parse(req.body);
  const plan = PLANS[user.plan] || PLANS.FREE;
  const count = await prisma.account.count({
    where: { userId: user.id, archived: false },
  });
  if (count >= plan.accountsLimit)
    return res.status(403).json({
      error: `Plano ${plan.name} permite até ${plan.accountsLimit} contas. Faça upgrade.`,
      upgrade: true,
    });
  const account = await prisma.account.create({
    data: { ...data, id: uuidv4(), userId: user.id },
  });
  res.json(account);
});

router.put("/api/accounts/:id", authenticate, async (req, res) => {
  const user = req.user;
  const data = accountSchema.parse(req.body);
  const updated = await prisma.account.updateMany({
    where: { id: String(req.params.id), userId: user.id },
    data,
  });
  if (updated.count === 0)
    return res.status(404).json({ error: "Conta não encontrada" });
  const account = await prisma.account.findUnique({
    where: { id: String(req.params.id) },
  });
  res.json(account);
});

router.delete("/api/accounts/:id", authenticate, async (req, res) => {
  const user = req.user;
  const deleted = await prisma.account.deleteMany({
    where: { id: String(req.params.id), userId: user.id },
  });
  if (deleted.count === 0)
    return res.status(404).json({ error: "Conta não encontrada" });
  res.json({ ok: true });
});

export default router;
