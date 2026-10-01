import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middlewares/auth";

const router = Router();

// ============================================================================
// DESAFIOS EM GRUPO
// ============================================================================
router.get("/api/challenges", authenticate, async (req, res) => {
  const user = req.user;
  const challenges = await prisma.challenge.findMany({
    where: { OR: [{ creatorId: user.id }, { participants: { some: { userId: user.id } } }] },
    include: {
      participants: { include: { user: { select: { id: true, name: true } } }, orderBy: { progressAmount: "desc" } },
      creator: { select: { id: true, name: true } },
    },
    orderBy: { startDate: "desc" },
  });
  res.json(challenges);
});

router.post("/api/challenges", authenticate, async (req, res) => {
  const user = req.user;
  const data = z
    .object({
      title: z.string().min(1).max(120),
      targetAmount: z.number().positive(),
      startDate: z.string().transform((s) => new Date(s)),
      endDate: z.string().transform((s) => new Date(s)),
    })
    .parse(req.body);
  const challenge = await prisma.challenge.create({
    data: { ...data, creatorId: user.id, participants: { create: { userId: user.id } } },
    include: { participants: true },
  });
  res.status(201).json(challenge);
});

router.post("/api/challenges/:id/join", authenticate, async (req, res) => {
  const user = req.user;
  const challenge = await prisma.challenge.findUnique({ where: { id: String(req.params.id) } });
  if (!challenge) return res.status(404).json({ error: "Desafio não encontrado" });
  const participant = await prisma.challengeParticipant.upsert({
    where: { challengeId_userId: { challengeId: challenge.id, userId: user.id } },
    create: { challengeId: challenge.id, userId: user.id },
    update: {},
  });
  res.status(201).json(participant);
});

router.put("/api/challenges/:id/progress", authenticate, async (req, res) => {
  const user = req.user;
  const { amount } = z.object({ amount: z.number() }).parse(req.body);
  const updated = await prisma.challengeParticipant.updateMany({
    where: { challengeId: String(req.params.id), userId: user.id },
    data: { progressAmount: { increment: amount } },
  });
  if (updated.count === 0) return res.status(404).json({ error: "Você não participa deste desafio" });
  res.json({ ok: true });
});

router.delete("/api/challenges/:id", authenticate, async (req, res) => {
  const user = req.user;
  const deleted = await prisma.challenge.deleteMany({ where: { id: String(req.params.id), creatorId: user.id } });
  if (deleted.count === 0) return res.status(404).json({ error: "Desafio não encontrado" });
  res.json({ ok: true });
});

export default router;
