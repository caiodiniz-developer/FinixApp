import { prisma } from "../lib/prisma";

export interface NetWorthBreakdown {
  liquidCash: number;
  goalsSaved: number;
  investedTotal: number;
  totalDebt: number;
  netWorth: number;
  investmentsByType: { type: string; value: number }[];
}

/**
 * Same three buckets the product already tracks separately — cash flow
 * (Transaction), goals (Goal.currentAmount), debt (Debt.remainingAmount) —
 * plus the new Investment model, added together into one number nothing
 * else in the app currently shows: what the user is actually worth.
 */
export const calculateNetWorth = async (userId: string): Promise<NetWorthBreakdown> => {
  const [allTx, goals, debts, investments] = await Promise.all([
    prisma.transaction.findMany({ where: { userId }, select: { amount: true, type: true } }),
    prisma.goal.findMany({ where: { userId }, select: { currentAmount: true } }),
    prisma.debt.findMany({ where: { userId, paidOff: false }, select: { remainingAmount: true } }),
    prisma.investment.findMany({ where: { userId } }),
  ]);

  const income = allTx.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const expense = allTx.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
  const goalsSaved = goals.reduce((s, g) => s + g.currentAmount, 0);
  const liquidCash = income - expense - goalsSaved;
  const investedTotal = investments.reduce((s, i) => s + i.currentValue, 0);
  const totalDebt = debts.reduce((s, d) => s + d.remainingAmount, 0);

  const byType = new Map<string, number>();
  for (const i of investments) byType.set(i.type, (byType.get(i.type) || 0) + i.currentValue);

  return {
    liquidCash: Number(liquidCash.toFixed(2)),
    goalsSaved: Number(goalsSaved.toFixed(2)),
    investedTotal: Number(investedTotal.toFixed(2)),
    totalDebt: Number(totalDebt.toFixed(2)),
    netWorth: Number((liquidCash + goalsSaved + investedTotal - totalDebt).toFixed(2)),
    investmentsByType: Array.from(byType.entries()).map(([type, value]) => ({ type, value })),
  };
};
