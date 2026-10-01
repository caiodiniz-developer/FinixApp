import { prisma } from "../lib/prisma";
import { roundMoney } from "../lib/money";

export interface IncomeExpenseTotals {
  income: number;
  expense: number;
}

/**
 * Lifetime income/expense of a user, summed by the database. The pages that
 * need these two numbers (dashboard, forecast, net worth, AI insights) used
 * to download every transaction the user ever created and add them up in
 * Node — fine with 50 rows, a multi-second request with 20 000.
 */
export const incomeExpenseTotals = async (
  userId: string,
  dateRange?: { gte?: Date; lt?: Date; lte?: Date },
): Promise<IncomeExpenseTotals> => {
  const rows = await prisma.transaction.groupBy({
    by: ["type"],
    where: { userId, ...(dateRange ? { date: dateRange } : {}) },
    _sum: { amount: true },
  });
  const of = (type: string) => roundMoney(rows.find((r) => r.type === type)?._sum.amount);
  return { income: of("INCOME"), expense: of("EXPENSE") };
};

/** Total currently set aside in the user's own goals. */
export const goalsSavedTotal = async (userId: string): Promise<number> => {
  const agg = await prisma.goal.aggregate({
    where: { userId },
    _sum: { currentAmount: true },
  });
  return roundMoney(agg._sum.currentAmount);
};

/** Expense per category, largest first. */
export const expenseByCategory = async (
  userId: string,
  dateRange?: { gte?: Date; lt?: Date; lte?: Date },
): Promise<{ category: string; amount: number }[]> => {
  const rows = await prisma.transaction.groupBy({
    by: ["category"],
    where: { userId, type: "EXPENSE", ...(dateRange ? { date: dateRange } : {}) },
    _sum: { amount: true },
  });
  return rows
    .map((r) => ({ category: r.category, amount: roundMoney(r._sum.amount) }))
    .sort((a, b) => b.amount - a.amount);
};
