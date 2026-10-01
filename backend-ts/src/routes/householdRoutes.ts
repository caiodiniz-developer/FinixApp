import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middlewares/auth";
import { buildHouseholdSummary } from "../services/householdService";

const router = Router();

// ============================================================================
// MODO CASAL/FAMÍLIA (HOUSEHOLD)
// ============================================================================
router.get("/api/household", authenticate, async (req, res) => {
  const user = req.user;
  const membership = await prisma.householdMember.findFirst({ where: { userId: user.id } });
  const owned = await prisma.household.findUnique({ where: { ownerId: user.id } });
  const householdId = owned?.id || membership?.householdId;
  if (!householdId) return res.json(null);
  const summary = await buildHouseholdSummary(householdId);
  res.json(summary);
});

router.post("/api/household", authenticate, async (req, res) => {
  const user = req.user;
  const { name } = z.object({ name: z.string().min(1).max(80) }).parse(req.body);
  const existing = await prisma.household.findUnique({ where: { ownerId: user.id } });
  if (existing) return res.status(400).json({ error: "Você já tem um household" });
  const household = await prisma.household.create({ data: { ownerId: user.id, name } });
  res.status(201).json(household);
});

router.post("/api/household/invite", authenticate, async (req, res) => {
  const user = req.user;
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const household = await prisma.household.findUnique({ where: { ownerId: user.id } });
  if (!household) return res.status(404).json({ error: "Crie um household primeiro" });
  const invite = await prisma.householdInvite.create({
    data: { householdId: household.id, senderId: user.id, receiverEmail: email.toLowerCase().trim() },
  });
  res.status(201).json(invite);
});

router.get("/api/household/invites", authenticate, async (req, res) => {
  const user = req.user;
  const invites = await prisma.householdInvite.findMany({
    where: { receiverEmail: user.email.toLowerCase(), status: "pending" },
    include: { household: true, sender: { select: { id: true, name: true } } },
  });
  res.json(invites);
});

router.post("/api/household/invites/:id/accept", authenticate, async (req, res) => {
  const user = req.user;
  const invite = await prisma.householdInvite.findUnique({ where: { id: String(req.params.id) } });
  if (!invite || invite.receiverEmail !== user.email.toLowerCase() || invite.status !== "pending") {
    return res.status(404).json({ error: "Convite não encontrado" });
  }
  await prisma.$transaction([
    prisma.householdInvite.update({ where: { id: invite.id }, data: { status: "accepted", respondedAt: new Date() } }),
    prisma.householdMember.upsert({
      where: { householdId_userId: { householdId: invite.householdId, userId: user.id } },
      create: { householdId: invite.householdId, userId: user.id },
      update: {},
    }),
  ]);
  res.json({ ok: true });
});

router.post("/api/household/invites/:id/decline", authenticate, async (req, res) => {
  const user = req.user;
  const invite = await prisma.householdInvite.findUnique({ where: { id: String(req.params.id) } });
  if (!invite || invite.receiverEmail !== user.email.toLowerCase() || invite.status !== "pending") {
    return res.status(404).json({ error: "Convite não encontrado" });
  }
  await prisma.householdInvite.update({ where: { id: invite.id }, data: { status: "declined", respondedAt: new Date() } });
  res.json({ ok: true });
});

export default router;
