import { prisma } from "../lib/prisma";
import { calculateNetWorth } from "./netWorthService";

/**
 * "FIRE" (financial independence / retire early) math: the well-known 4%
 * rule says a reserve of 25x your annual spending can sustain that spending
 * indefinitely (4% safe withdrawal rate). Everything here is standard
 * personal-finance math, not investment advice about returns — we
 * deliberately don't assume any growth rate on the invested portion, so the
 * estimate is conservative (real timelines are usually shorter thanks to
 * compounding, which this does NOT model).
 */
export const estimateMonthlySavings = async (userId: string, lookbackMonths = 6): Promise<number> => {
  const since = new Date();
  since.setMonth(since.getMonth() - lookbackMonths);
  const tx = await prisma.transaction.findMany({
    where: { userId, date: { gte: since } },
    select: { amount: true, type: true },
  });
  if (tx.length === 0) return 0;
  const income = tx.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const expense = tx.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
  return Number(((income - expense) / lookbackMonths).toFixed(2));
};

export interface FireSimulation {
  currentNetWorth: number;
  monthlySavings: number;
  monthlyExpenseAvg: number;
  fireNumber: number; // 25x annual spending — the reserve that sustains it forever at 4%/year
  monthsToFire: number | null; // null = not reachable at current savings rate
  yearsToFire: number | null;
  customGoal?: { targetAmount: number; monthsToReach: number | null; extraMonthlyNeededFor: (years: number) => number };
}

export const simulateFire = async (
  userId: string,
  options?: { desiredMonthlyIncome?: number; targetYears?: number },
): Promise<FireSimulation> => {
  const [netWorth, monthlySavings, tx] = await Promise.all([
    calculateNetWorth(userId),
    estimateMonthlySavings(userId),
    prisma.transaction.findMany({ where: { userId, type: "EXPENSE" }, select: { amount: true, date: true } }),
  ]);

  const monthsOfData = tx.length
    ? Math.max(1, Math.round((Date.now() - Math.min(...tx.map((t) => t.date.getTime()))) / (1000 * 60 * 60 * 24 * 30)))
    : 1;
  const monthlyExpenseAvg = tx.reduce((s, t) => s + t.amount, 0) / monthsOfData;

  const baseMonthlyExpense = options?.desiredMonthlyIncome ?? monthlyExpenseAvg;
  const fireNumber = Number((baseMonthlyExpense * 12 * 25).toFixed(2));

  const gap = fireNumber - netWorth.netWorth;
  const monthsToFire = monthlySavings > 0 ? Math.max(0, Math.ceil(gap / monthlySavings)) : gap <= 0 ? 0 : null;

  const result: FireSimulation = {
    currentNetWorth: netWorth.netWorth,
    monthlySavings,
    monthlyExpenseAvg: Number(monthlyExpenseAvg.toFixed(2)),
    fireNumber,
    monthsToFire,
    yearsToFire: monthsToFire !== null ? Number((monthsToFire / 12).toFixed(1)) : null,
  };

  if (options?.targetYears) {
    const months = options.targetYears * 12;
    const neededMonthly = (fireNumber - netWorth.netWorth) / months;
    (result as any).extraMonthlyNeeded = Number(Math.max(0, neededMonthly - monthlySavings).toFixed(2));
  }

  return result;
};
