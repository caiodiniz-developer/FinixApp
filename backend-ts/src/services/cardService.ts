import { v4 as uuidv4 } from "uuid";
import { prisma } from "../lib/prisma";
import { cardStatementWindow, currentStatementMonth } from "../lib/dates";

export const CARD_LIMIT_THRESHOLDS = [1, 0.9, 0.8]; // checked highest-first so only one alert fires per crossing
export const checkCardLimitAlert = async (userId: string, cardId: string) => {
  const card = await prisma.creditCard.findUnique({ where: { id: cardId } });
  if (!card || card.limit <= 0) return;

  const now = new Date();
  const { year, month0 } = currentStatementMonth(card.closingDay, now);
  const { start, end } = cardStatementWindow(card.closingDay, year, month0);
  const agg = await prisma.transaction.aggregate({
    where: { userId, cardId, type: "EXPENSE", date: { gte: start, lte: end } },
    _sum: { amount: true },
  });
  const used = agg._sum.amount || 0;
  const pct = used / card.limit;

  const crossed = CARD_LIMIT_THRESHOLDS.find((t) => pct >= t);
  if (!crossed) return;

  // Title is keyed off the fixed threshold (80/90/100), not the live
  // percentage — so "already alerted for this card+statement+threshold"
  // can be checked by an exact title match instead of a hidden dedup key.
  const thresholdPct = Math.round(crossed * 100);
  const title = `Cartão ${card.name}: ${thresholdPct}% do limite usado`;
  const statementDueDate = new Date(year, month0, card.dueDay);

  const existing = await prisma.financialAlert.findFirst({
    where: { userId, type: "card_limit", title, dueDate: statementDueDate },
  });
  if (existing) return;

  await prisma.financialAlert.create({
    data: {
      id: uuidv4(),
      userId,
      title,
      description: `Fatura atual em R$ ${used.toFixed(2)} de R$ ${card.limit.toFixed(2)}.`,
      type: "card_limit",
      severity: crossed >= 1 ? "danger" : "warning",
      amount: used,
      dueDate: statementDueDate,
    },
  });
};
