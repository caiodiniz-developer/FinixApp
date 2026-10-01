import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middlewares/auth";
import { appNow } from "../lib/dates";
import { roundMoney, toCents, fromCents } from "../lib/money";
import { toTransactionDto } from "../lib/transactionDto";
import {
  incomeExpenseTotals,
  goalsSavedTotal,
  expenseByCategory,
} from "../services/totalsService";

const router = Router();

// ============================================================================
// DASHBOARD
// ============================================================================
// Totals and the category breakdown are aggregated by the database; only the
// last six months of rows (for the monthly chart) and the five most recent
// transactions are actually fetched.
router.get("/api/dashboard", authenticate, async (req, res) => {
  const user = req.user;
  const now = appNow();
  const months: Date[] = [];
  for (let i = 5; i >= 0; i--) {
    months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  }

  const [totals, saved, categories, windowTx, recent] = await Promise.all([
    incomeExpenseTotals(user.id),
    goalsSavedTotal(user.id),
    expenseByCategory(user.id),
    prisma.transaction.findMany({
      where: { userId: user.id, date: { gte: months[0] } },
      select: { type: true, amount: true, date: true },
    }),
    prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
      take: 5,
    }),
  ]);

  const { income, expense } = totals;
  const balance = roundMoney(income - expense - saved);

  const monthly = months.map((start) => {
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    let inc = 0;
    let exp = 0;
    for (const t of windowTx) {
      if (t.date < start || t.date >= end) continue;
      if (t.type === "INCOME") inc += toCents(t.amount);
      else if (t.type === "EXPENSE") exp += toCents(t.amount);
    }
    return {
      month: start.toLocaleDateString("pt-BR", {
        month: "short",
        year: "2-digit",
      }),
      income: fromCents(inc),
      expense: fromCents(exp),
    };
  });

  const insights: { type: string; title: string; message: string }[] = [];
  if (monthly.length >= 2) {
    const cur = monthly[monthly.length - 1].expense;
    const prev = monthly[monthly.length - 2].expense;
    if (prev > 0) {
      const diff = ((cur - prev) / prev) * 100;
      if (diff > 10)
        insights.push({
          type: "warning",
          title: "Gastos aumentaram",
          message: `Você gastou ${diff.toFixed(0)}% a mais este mês.`,
        });
      else if (diff < -10)
        insights.push({
          type: "success",
          title: "Ótimo controle",
          message: `Você economizou ${Math.abs(diff).toFixed(0)}% em relação ao mês passado.`,
        });
    }
  }
  if (categories.length > 0) {
    const top = categories[0];
    if (expense > 0 && top.amount / expense > 0.4)
      insights.push({
        type: "info",
        title: "Categoria dominante",
        message: `${top.category} representa ${((top.amount / expense) * 100).toFixed(0)}% dos seus gastos.`,
      });
  }
  if (balance < 0)
    insights.push({
      type: "warning",
      title: "Atenção ao saldo",
      message: "Suas despesas superam as receitas.",
    });
  else if (income > 0 && balance / income > 0.3)
    insights.push({
      type: "success",
      title: "Você está no caminho certo",
      message: `Economizou ${((balance / income) * 100).toFixed(0)}% da sua renda.`,
    });

  res.json({
    balance,
    income,
    expense,
    saved,
    monthly,
    categories,
    recent: recent.map(toTransactionDto),
    insights,
  });
});

export default router;
