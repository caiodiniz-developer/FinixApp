import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { roundMoney } from "../lib/money";
import { authenticate, requireAdmin } from "../middlewares/auth";
import { userUpdateSchema } from "../schemas";
import { userPublic } from "../lib/userPublic";

const router = Router();

// ============================================================================
// ADMIN
// ============================================================================
router.get("/api/users", authenticate, requireAdmin, async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const where: Prisma.UserWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};
  // Never select photo/companyLogo here: they are base64 images of up to
  // several MB *per user*, and this is a list of every account. Whether each
  // one has an image is answered by a cheap IS NOT NULL check instead.
  const [users, flags] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      omit: { photo: true, companyLogo: true },
    }),
    prisma.$queryRaw<{ id: string; hasPhoto: boolean; hasCompanyLogo: boolean }[]>`
      SELECT "id", ("photo" IS NOT NULL) AS "hasPhoto", ("companyLogo" IS NOT NULL) AS "hasCompanyLogo"
      FROM "users"
    `,
  ]);
  const flagsById = new Map(flags.map((f) => [f.id, f]));
  res.json(
    users.map((u) => ({
      ...userPublic(u),
      hasPhoto: flagsById.get(u.id)?.hasPhoto ?? false,
      hasCompanyLogo: flagsById.get(u.id)?.hasCompanyLogo ?? false,
    })),
  );
});

router.get("/api/users/:id", authenticate, requireAdmin, async (req, res) => {
  const userId = String(req.params.id);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
  // Latest 500 — enough for the admin view without shipping years of history.
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: 500,
  });
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
  const admin = req.user;
  if (req.params.id === admin.id)
    return res.status(400).json({ error: "Não é possível deletar a si mesmo" });
  await prisma.user.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});

router.get("/api/admin/stats", authenticate, requireAdmin, async (_req, res) => {
  const [byPlan, byRole, totalBlocked, totalTx, totalGoals, revenue, byType] = await Promise.all([
    prisma.user.groupBy({ by: ["plan"], _count: true }),
    prisma.user.groupBy({ by: ["role"], _count: true }),
    prisma.user.count({ where: { blocked: true } }),
    prisma.transaction.count(),
    prisma.goal.count(),
    prisma.paymentTransaction.aggregate({
      where: { paymentStatus: "paid" },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({ by: ["type"], _sum: { amount: true } }),
  ]);
  const usersOnPlan = (plan: string) => byPlan.find((p) => p.plan === plan)?._count ?? 0;
  const totalUsers = byPlan.reduce((n, p) => n + p._count, 0);
  const totalAdmins = byRole.find((r) => r.role === "ADMIN")?._count ?? 0;
  const freeUsers = usersOnPlan("FREE");
  const basicUsers = usersOnPlan("BASIC");
  const proUsers = usersOnPlan("PRO");
  const totalRevenue = roundMoney(revenue._sum.amount);
  const income = roundMoney(byType.find((a) => a.type === "INCOME")?._sum.amount);
  const expense = roundMoney(byType.find((a) => a.type === "EXPENSE")?._sum.amount);
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
