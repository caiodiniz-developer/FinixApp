import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticate, requireAdmin } from "../middlewares/authenticate";
import { userUpdateSchema } from "../schemas";
import { userPublic } from "../lib/userPublic";

const router = Router();

// ============================================================================
// ADMIN
// ============================================================================
router.get("/api/users", authenticate, requireAdmin, async (req, res) => {
  const { search } = req.query;
  const where: any = {};
  if (search)
    where.OR = [
      { name: { contains: search as string } },
      { email: { contains: search as string } },
    ];
  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  res.json(users.map(userPublic));
});

router.get("/api/users/:id", authenticate, requireAdmin, async (req, res) => {
  const userId = String(req.params.id);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
  const transactions = await prisma.transaction.findMany({ where: { userId } });
  const goals = await prisma.goal.findMany({ where: { userId } });
  const categories = await prisma.category.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });
  // Admin's single-user edit view needs the actual image to preview/replace
  // it — unlike the hot auth paths, this is a one-off fetch, so the size is fine.
  res.json({
    user: { ...userPublic(user), photo: user.photo, companyLogo: user.companyLogo },
    transactions,
    goals,
    categories,
  });
});

router.put("/api/users/:id", authenticate, requireAdmin, async (req, res) => {
  const data = userUpdateSchema.parse(req.body);
  const userId = String(req.params.id);
  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser)
    return res.status(404).json({ error: "Usuário não encontrado" });
  const { categories, ...updateData } = data;
  if (
    data.plan === "PRO" &&
    targetUser.plan !== "PRO" &&
    data.hasCompletedOnboarding === undefined
  )
    updateData.hasCompletedOnboarding = false;
  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });
  if (categories) {
    const uniqueCategories = Array.from(
      new Set(categories.map((name) => name.trim()).filter(Boolean)),
    );
    await prisma.category.deleteMany({ where: { userId } });
    if (uniqueCategories.length)
      await prisma.category.createMany({
        data: uniqueCategories.map((name) => ({ userId, name })),
      });
  }
  res.json(userPublic(updated));
});

router.delete("/api/users/:id", authenticate, requireAdmin, async (req, res) => {
  const admin = (req as any).user;
  if (req.params.id === admin.id)
    return res.status(400).json({ error: "Não é possível deletar a si mesmo" });
  await prisma.user.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});

router.get("/api/admin/stats", authenticate, requireAdmin, async (_req, res) => {
  const totalUsers = await prisma.user.count();
  const totalAdmins = await prisma.user.count({ where: { role: "ADMIN" } });
  const totalBlocked = await prisma.user.count({ where: { blocked: true } });
  const totalTx = await prisma.transaction.count();
  const totalGoals = await prisma.goal.count();
  const freeUsers = await prisma.user.count({ where: { plan: "FREE" } });
  const basicUsers = await prisma.user.count({ where: { plan: "BASIC" } });
  const proUsers = await prisma.user.count({ where: { plan: "PRO" } });
  const paidTxs = await prisma.paymentTransaction.findMany({
    where: { paymentStatus: "paid" },
  });
  const totalRevenue = paidTxs.reduce((s, t) => s + t.amount, 0);
  const agg = await prisma.transaction.groupBy({
    by: ["type"],
    _sum: { amount: true },
  });
  const income = agg.find((a) => a.type === "INCOME")?._sum.amount || 0;
  const expense = agg.find((a) => a.type === "EXPENSE")?._sum.amount || 0;
  res.json({
    totalUsers,
    totalAdmins,
    blockedUsers: totalBlocked,
    totalTransactions: totalTx,
    totalGoals,
    globalIncome: income,
    globalExpense: expense,
    freeUsers,
    basicUsers,
    proUsers,
    totalRevenue,
  });
});

export default router;
