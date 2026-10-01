import { prisma } from "../lib/prisma";
import { roundMoney, sumMoney } from "../lib/money";
import { incomeExpenseTotals, goalsSavedTotal } from "./totalsService";

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
 * plus the Investment model, added together into one number nothing else in
 * the app shows: what the user is actually worth. Every figure is summed by
 * the database.
 */
export const calculateNetWorth = async (userId: string): Promise<NetWorthBreakdown> => {
  const [totals, goalsSaved, debtAgg, byType] = await Promise.all([
    incomeExpenseTotals(userId),
    goalsSavedTotal(userId),
    prisma.debt.aggregate({ where: { userId, paidOff: false }, _sum: { remainingAmount: true } }),
    prisma.investment.groupBy({ by: ["type"], where: { userId }, _sum: { currentValue: true } }),
  ]);

  const liquidCash = roundMoney(totals.income - totals.expense - goalsSaved);
  const totalDebt = roundMoney(debtAgg._sum.remainingAmount);
  const investmentsByType = byType.map((r) => ({
    type: r.type,
    value: roundMoney(r._sum.currentValue),
  }));
  const investedTotal = sumMoney(investmentsByType.map((i) => i.value));

  return {
    liquidCash,
    goalsSaved,
    investedTotal,
    totalDebt,
    netWorth: roundMoney(liquidCash + goalsSaved + investedTotal - totalDebt),
    investmentsByType,
  };
};
