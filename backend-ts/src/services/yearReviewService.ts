import { prisma } from "../lib/prisma";

export interface YearReview {
  year: number;
  totalIncome: number;
  totalExpense: number;
  totalSaved: number;
  topCategory: { category: string; amount: number } | null;
  bestMonth: { month: string; net: number } | null;
  worstMonth: { month: string; net: number } | null;
  transactionCount: number;
  goalsCompleted: number;
  biggestExpense: { title: string; amount: number } | null;
}

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/**
 * "Resumo do ano" — Wrapped-style recap built entirely from data the app
 * already stores. No new writes, no new tracking — just a different lens
 * on the same Transaction/Goal rows, designed to be screenshotted/shared.
 */
export const buildYearReview = async (userId: string, year: number): Promise<YearReview> => {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);

  const [transactions, goals] = await Promise.all([
    prisma.transaction.findMany({ where: { userId, date: { gte: start, lt: end } } }),
    prisma.goal.findMany({ where: { userId } }),
  ]);

  const income = transactions.filter((t) => t.type === "INCOME");
  const expenses = transactions.filter((t) => t.type === "EXPENSE");
  const totalIncome = income.reduce((s, t) => s + t.amount, 0);
  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);

  const byCategory = new Map<string, number>();
  for (const t of expenses) byCategory.set(t.category, (byCategory.get(t.category) || 0) + t.amount);
  const topCategoryEntry = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1])[0];

  const byMonth = new Map<number, number>();
  for (const t of transactions) {
    const m = t.date.getMonth();
    byMonth.set(m, (byMonth.get(m) || 0) + (t.type === "INCOME" ? t.amount : -t.amount));
  }
  const monthEntries = Array.from(byMonth.entries());
  const best = monthEntries.length ? monthEntries.reduce((a, b) => (b[1] > a[1] ? b : a)) : null;
  const worst = monthEntries.length ? monthEntries.reduce((a, b) => (b[1] < a[1] ? b : a)) : null;

  const biggest = expenses.length ? expenses.reduce((a, b) => (b.amount > a.amount ? b : a)) : null;

  const goalsCompleted = goals.filter(
    (g) => g.currentAmount >= g.targetAmount && g.deadline.getFullYear() === year,
  ).length;

  return {
    year,
    totalIncome: Number(totalIncome.toFixed(2)),
    totalExpense: Number(totalExpense.toFixed(2)),
    totalSaved: Number((totalIncome - totalExpense).toFixed(2)),
    topCategory: topCategoryEntry ? { category: topCategoryEntry[0], amount: Number(topCategoryEntry[1].toFixed(2)) } : null,
    bestMonth: best ? { month: MONTH_NAMES[best[0]], net: Number(best[1].toFixed(2)) } : null,
    worstMonth: worst ? { month: MONTH_NAMES[worst[0]], net: Number(worst[1].toFixed(2)) } : null,
    transactionCount: transactions.length,
    goalsCompleted,
    biggestExpense: biggest ? { title: biggest.title, amount: biggest.amount } : null,
  };
};
