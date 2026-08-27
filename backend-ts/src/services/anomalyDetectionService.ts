import { prisma } from "../lib/prisma";

/**
 * Flags a new expense as anomalous if it's a statistical outlier for that
 * user's OWN category history — not a fixed threshold, since "unusual" is
 * relative to how the person normally spends. Requires at least 5 prior
 * transactions in the category (a mean/stddev from 1-2 points is noise, not
 * signal), and a minimum floor so it doesn't fire on tiny fluctuations.
 */
export const isAnomalousExpense = async (
  userId: string,
  category: string,
  amount: number,
): Promise<boolean> => {
  if (amount < 50) return false;

  const history = await prisma.transaction.findMany({
    where: { userId, type: "EXPENSE", category },
    select: { amount: true },
  });
  if (history.length < 5) return false;

  const amounts = history.map((t) => t.amount);
  const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
  const variance = amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length;
  const stddev = Math.sqrt(variance);

  if (stddev === 0) return amount > mean * 3; // no variance at all — fall back to a flat multiple

  const zScore = (amount - mean) / stddev;
  return zScore >= 3;
};
