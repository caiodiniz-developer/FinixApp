import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middlewares/authenticate";

const router = Router();

// ============================================================================
// EMPRÉSTIMOS ENTRE PESSOAS
// ============================================================================
const personalLoanSchema = z.object({
  contactId: z.string(),
  direction: z.enum(["LENT", "BORROWED"]),
  principal: z.number().positive(),
  remaining: z.number().min(0),
  installments: z.number().min(1).max(60).optional().default(1),
  dueDay: z.number().min(1).max(31).optional().nullable(),
  note: z.string().max(200).optional().nullable(),
});

router.get("/api/personal-loans", authenticate, async (req, res) => {
  const user = (req as any).user;
  const loans = await prisma.personalLoan.findMany({
    where: { userId: user.id },
    include: { contact: { select: { id: true, name: true, color: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(loans);
});

router.post("/api/personal-loans", authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = personalLoanSchema.parse(req.body);
  const loan = await prisma.personalLoan.create({ data: { ...data, userId: user.id } });
  res.status(201).json(loan);
});

router.put("/api/personal-loans/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = personalLoanSchema.partial().parse(req.body);
  const updated = await prisma.personalLoan.updateMany({
    where: { id: String(req.params.id), userId: user.id },
    data: { ...data, settled: data.remaining === 0 ? true : undefined },
  });
  if (updated.count === 0) return res.status(404).json({ error: "Empréstimo não encontrado" });
  res.json({ ok: true });
});

router.delete("/api/personal-loans/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const deleted = await prisma.personalLoan.deleteMany({ where: { id: String(req.params.id), userId: user.id } });
  if (deleted.count === 0) return res.status(404).json({ error: "Empréstimo não encontrado" });
  res.json({ ok: true });
});

export default router;
