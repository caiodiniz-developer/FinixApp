import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../lib/prisma";
import { planFor } from "../config/plans";
import { authenticate, requireFeature } from "../middlewares/auth";
import { creditCardSchema } from "../schemas";
import { getSafeDueDay, cardStatementWindow, currentStatementMonth } from "../lib/dates";

const router = Router();

// ============================================================================
// CREDIT CARDS (fatura computada on-the-fly, nunca armazenada)
// ============================================================================
router.get(
  "/api/cards",
  authenticate,
  requireFeature("canUseCards"),
  async (req, res) => {
    const user = req.user;
    const cards = await prisma.creditCard.findMany({
      where: { userId: user.id, archived: false },
      orderBy: { createdAt: "asc" },
    });
    const now = new Date();
    const result = await Promise.all(
      cards.map(async (c) => {
        const { year, month0 } = currentStatementMonth(c.closingDay, now);
        const { start, end } = cardStatementWindow(c.closingDay, year, month0);
        const txs = await prisma.transaction.findMany({
          where: {
            userId: user.id,
            cardId: c.id,
            paymentMethod: "credito",
            date: { gte: start, lte: end },
          },
        });
        const total = txs.reduce((s, t) => s + t.amount, 0);
        const dueDate = new Date(year, month0, getSafeDueDay(year, month0, c.dueDay));
        return {
          ...c,
          currentStatement: {
            referenceMonth: `${year}-${String(month0 + 1).padStart(2, "0")}`,
            total,
            closingDate: end,
            dueDate,
            transactionsCount: txs.length,
          },
        };
      }),
    );
    res.json(result);
  },
);

router.post(
  "/api/cards",
  authenticate,
  requireFeature("canUseCards"),
  async (req, res) => {
    const user = req.user;
    const data = creditCardSchema.parse(req.body);
    const plan = planFor(user);
    const count = await prisma.creditCard.count({
      where: { userId: user.id, archived: false },
    });
    if (count >= plan.cardsLimit)
      return res.status(403).json({
        error: `Plano ${plan.name} permite até ${plan.cardsLimit} cartões. Faça upgrade.`,
        upgrade: true,
      });
    const card = await prisma.creditCard.create({
      data: { ...data, id: uuidv4(), userId: user.id },
    });
    res.json(card);
  },
);

router.put(
  "/api/cards/:id",
  authenticate,
  requireFeature("canUseCards"),
  async (req, res) => {
    const user = req.user;
    const data = creditCardSchema.parse(req.body);
    const updated = await prisma.creditCard.updateMany({
      where: { id: String(req.params.id), userId: user.id },
      data,
    });
    if (updated.count === 0)
      return res.status(404).json({ error: "Cartão não encontrado" });
    const card = await prisma.creditCard.findUnique({
      where: { id: String(req.params.id) },
    });
    res.json(card);
  },
);

router.delete(
  "/api/cards/:id",
  authenticate,
  requireFeature("canUseCards"),
  async (req, res) => {
    const user = req.user;
    const deleted = await prisma.creditCard.deleteMany({
      where: { id: String(req.params.id), userId: user.id },
    });
    if (deleted.count === 0)
      return res.status(404).json({ error: "Cartão não encontrado" });
    res.json({ ok: true });
  },
);

router.get(
  "/api/cards/:id/statements/:month",
  authenticate,
  requireFeature("canUseCards"),
  async (req, res) => {
    const user = req.user;
    const card = await prisma.creditCard.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!card || card.userId !== user.id)
      return res.status(404).json({ error: "Cartão não encontrado" });
    const [yearStr, monthStr] = String(req.params.month).split("-");
    const year = Number(yearStr);
    const month0 = Number(monthStr) - 1;
    if (!Number.isInteger(year) || !Number.isInteger(month0))
      return res.status(400).json({ error: "Mês inválido, use o formato AAAA-MM" });
    const { start, end } = cardStatementWindow(card.closingDay, year, month0);
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        cardId: card.id,
        paymentMethod: "credito",
        date: { gte: start, lte: end },
      },
      orderBy: { date: "asc" },
    });
    const total = transactions.reduce((s, t) => s + t.amount, 0);
    const dueDate = new Date(year, month0, getSafeDueDay(year, month0, card.dueDay));
    res.json({
      referenceMonth: `${year}-${String(month0 + 1).padStart(2, "0")}`,
      closingDate: end,
      dueDate,
      total,
      transactions,
    });
  },
);

export default router;
