import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { PLANS } from "../config/plans";
import { authenticate } from "../middlewares/auth";
import { goalSchema } from "../schemas";
import { dispatchWebhook } from "../services/webhookService";

const router = Router();

// ============================================================================
// GOALS
// ============================================================================
// A goal is visible/editable by its owner (userId) OR any accepted
// GoalMember — the `OR` below is what makes goals "shared" without touching
// every existing query that assumed single ownership.
router.get("/api/goals", authenticate, async (req, res) => {
  const user = req.user;
  const goals = await prisma.goal.findMany({
    where: { OR: [{ userId: user.id }, { members: { some: { userId: user.id } } }] },
    include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
    orderBy: { deadline: "asc" },
  });
  res.json(goals);
});

router.post("/api/goals", authenticate, async (req, res) => {
  const user = req.user;
  const data = goalSchema.parse(req.body);
  const plan = PLANS[user.plan] || PLANS.FREE;
  if (plan.goalsLimit !== -1) {
    const count = await prisma.goal.count({ where: { userId: user.id } });
    if (count >= plan.goalsLimit)
      return res.status(403).json({
        error: `Plano ${plan.name} permite até ${plan.goalsLimit} metas. Faça upgrade.`,
        upgrade: true,
      });
  }
  const goal = await prisma.goal.create({
    data: { ...data, id: uuidv4(), userId: user.id },
  });
  dispatchWebhook(user.id, "goal.created", { id: goal.id, title: goal.title, targetAmount: goal.targetAmount });
  res.json(goal);
});

const canAccessGoal = async (goalId: string, userId: string) => {
  const goal = await prisma.goal.findFirst({
    where: { id: goalId, OR: [{ userId }, { members: { some: { userId } } }] },
  });
  return goal;
};

router.put("/api/goals/:id", authenticate, async (req, res) => {
  const user = req.user;
  const data = goalSchema.parse(req.body);
  const existing = await canAccessGoal(String(req.params.id), user.id);
  if (!existing) return res.status(404).json({ error: "Meta não encontrada" });

  const updated = await prisma.goal.update({
    where: { id: String(req.params.id) },
    data,
  });
  if (updated.currentAmount >= updated.targetAmount) {
    dispatchWebhook(existing.userId, "goal.completed", { id: updated.id, title: updated.title });
  }
  res.json(updated);
});

router.delete("/api/goals/:id", authenticate, async (req, res) => {
  const user = req.user;
  // Only the owner can delete — members can contribute/view, not tear it down.
  const deleted = await prisma.goal.deleteMany({
    where: { id: String(req.params.id), userId: user.id },
  });
  if (deleted.count === 0)
    return res.status(404).json({ error: "Meta não encontrada" });
  res.json({ ok: true });
});

// ── Shared goals: invite another Finix user by e-mail, they accept/decline ──
router.post("/api/goals/:id/invite", authenticate, async (req, res) => {
  const user = req.user;
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const goal = await prisma.goal.findFirst({ where: { id: String(req.params.id), userId: user.id } });
  if (!goal) return res.status(404).json({ error: "Meta não encontrada" });

  const normalizedEmail = email.toLowerCase().trim();
  if (normalizedEmail === user.email) {
    return res.status(400).json({ error: "Você já é dono desta meta" });
  }
  const receiver = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  const invite = await prisma.goalInvite.create({
    data: {
      goalId: goal.id,
      senderId: user.id,
      receiverEmail: normalizedEmail,
      receiverId: receiver?.id || null,
    },
  });
  res.status(201).json(invite);
});

router.get("/api/goals/invites", authenticate, async (req, res) => {
  const user = req.user;
  const invites = await prisma.goalInvite.findMany({
    where: { receiverEmail: user.email.toLowerCase(), status: "pending" },
    include: { goal: true, sender: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(invites);
});

router.post("/api/goals/invites/:id/accept", authenticate, async (req, res) => {
  const user = req.user;
  const invite = await prisma.goalInvite.findUnique({ where: { id: String(req.params.id) } });
  if (!invite || invite.receiverEmail !== user.email.toLowerCase() || invite.status !== "pending") {
    return res.status(404).json({ error: "Convite não encontrado" });
  }
  await prisma.$transaction([
    prisma.goalInvite.update({
      where: { id: invite.id },
      data: { status: "accepted", receiverId: user.id, respondedAt: new Date() },
    }),
    prisma.goalMember.upsert({
      where: { goalId_userId: { goalId: invite.goalId, userId: user.id } },
      create: { goalId: invite.goalId, userId: user.id, role: "member" },
      update: {},
    }),
  ]);
  res.json({ ok: true });
});

router.post("/api/goals/invites/:id/decline", authenticate, async (req, res) => {
  const user = req.user;
  const invite = await prisma.goalInvite.findUnique({ where: { id: String(req.params.id) } });
  if (!invite || invite.receiverEmail !== user.email.toLowerCase() || invite.status !== "pending") {
    return res.status(404).json({ error: "Convite não encontrado" });
  }
  await prisma.goalInvite.update({
    where: { id: invite.id },
    data: { status: "declined", respondedAt: new Date() },
  });
  res.json({ ok: true });
});

export default router;
