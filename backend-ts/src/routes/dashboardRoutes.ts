import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middlewares/authenticate";

const router = Router();

// ============================================================================
// DASHBOARD
// ============================================================================
router.get("/api/dashboard", authenticate, async (req, res) => {
  const user = (req as any).user;
  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
  });
  const goals = await prisma.goal.findMany({ where: { userId: user.id } });

  const income = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((s, t) => s + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((s, t) => s + t.amount, 0);
  const saved = goals.reduce((s, g) => s + g.currentAmount, 0);
  const balance = income - expense - saved;

  const now = new Date();
  const months: Date[] = [];
  for (let i = 5; i >= 0; i--) {
    const y = now.getFullYear();
    const m = now.getMonth() - i;
    const d = new Date(y, m < 0 ? m + 12 : m, 1);
    if (m < 0) d.setFullYear(y - 1);
    months.push(d);
  }
  const monthly = months.map((start) => {
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const inc = transactions
      .filter((t) => t.type === "INCOME" && t.date >= start && t.date < end)
      .reduce((s, t) => s + t.amount, 0);
    const exp = transactions
      .filter((t) => t.type === "EXPENSE" && t.date >= start && t.date < end)
      .reduce((s, t) => s + t.amount, 0);
    return {
      month: start.toLocaleDateString("pt-BR", {
        month: "short",
        year: "2-digit",
      }),
      income: inc,
      expense: exp,
    };
  });

  const byCat: Record<string, number> = {};
  transactions
    .filter((t) => t.type === "EXPENSE")
    .forEach((t) => {
      byCat[t.category] = (byCat[t.category] || 0) + t.amount;
    });
  const categories = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({ category, amount }));

  const insights: any[] = [];
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

  const recent = transactions
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5);
  res.json({
    balance,
    income,
    expense,
    saved,
    monthly,
    categories,
    recent,
    insights,
  });
});

export default router;
