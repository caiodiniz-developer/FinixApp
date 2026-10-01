import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticate, requireFeature } from "../middlewares/auth";
import { buildForecast } from "../services/forecastService";
import { buildYearReview } from "../services/yearReviewService";

const router = Router();

// ============================================================================
// PREVISÃO DE APERTO FINANCEIRO
// ============================================================================
router.get("/api/forecast", authenticate, async (req, res) => {
  const user = req.user;
  const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
  const forecast = await buildForecast(user.id, days);
  res.json(forecast);
});

// ============================================================================
// RESUMO DO ANO
// ============================================================================
router.get("/api/year-review", authenticate, async (req, res) => {
  const user = req.user;
  const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
  const review = await buildYearReview(user.id, year);
  res.json(review);
});

// ============================================================================
// AI INSIGHTS
// ============================================================================
router.post(
  "/api/insights/ai",
  authenticate,
  requireFeature("hasAI"),
  async (req, res) => {
    const user = req.user;
    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
    });
    const goals = await prisma.goal.findMany({ where: { userId: user.id } });

    if (transactions.length === 0) {
      return res.json({
        insights: [
          {
            type: "info",
            title: "Sem dados suficientes",
            message:
              "Adicione algumas transações para receber análises personalizadas.",
          },
        ],
      });
    }

    const incomeTx = transactions.filter((t) => t.type === "INCOME");
    const expenseTx = transactions.filter((t) => t.type === "EXPENSE");
    const income = incomeTx.reduce((sum, t) => sum + t.amount, 0);
    const expense = expenseTx.reduce((sum, t) => sum + t.amount, 0);
    const balance = income - expense;
    const spendRatio = income > 0 ? expense / income : 1;
    const avgExpense = expenseTx.length > 0 ? expense / expenseTx.length : 0;
    const topCategory = expenseTx.reduce(
      (acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      },
      {} as Record<string, number>,
    );
    const bestCategory = Object.entries(topCategory).sort(
      (a, b) => b[1] - a[1],
    )[0];
    const now = new Date();
    const recentExpenses = expenseTx.filter(
      (t) =>
        (now.getTime() - new Date(t.date).getTime()) / (1000 * 60 * 60 * 24) <=
        14,
    );

    const localInsights: any[] = [];
    if (income === 0)
      localInsights.push({
        type: "warning",
        title: "Atenção, sem receita registrada",
        message: "Ainda não há nenhuma receita cadastrada.",
      });
    else if (spendRatio >= 0.9)
      localInsights.push({
        type: "warning",
        title: "Cuidado, seus gastos estão muito altos",
        message: `Você já gastou ${(spendRatio * 100).toFixed(0)}% da sua renda registrada.`,
      });
    else if (spendRatio >= 0.75)
      localInsights.push({
        type: "warning",
        title: "Atenção, a dívida do mês pode apertar",
        message: `Seu ritmo de despesas consome ${(spendRatio * 100).toFixed(0)}% da renda.`,
      });
    else if (spendRatio >= 0.5)
      localInsights.push({
        type: "info",
        title: "Bom controle, mas fique atento",
        message: `Você usou ${(spendRatio * 100).toFixed(0)}% da sua renda.`,
      });
    else
      localInsights.push({
        type: "success",
        title: "Ótimo, seu orçamento está equilibrado",
        message: `Suas despesas representam ${(spendRatio * 100).toFixed(0)}% da receita.`,
      });

    if (bestCategory && bestCategory[1] > 0 && expense > 0) {
      const categoryRatio = (bestCategory[1] / expense) * 100;
      if (categoryRatio >= 35)
        localInsights.push({
          type: "warning",
          title: `Atenção: ${bestCategory[0]} domina seus gastos`,
          message: `${bestCategory[0]} responde por ${categoryRatio.toFixed(0)}% das despesas.`,
        });
    }
    if (recentExpenses.length >= 3 && avgExpense > 0) {
      const recentAvg =
        recentExpenses.reduce((sum, t) => sum + t.amount, 0) /
        recentExpenses.length;
      if (recentAvg > avgExpense)
        localInsights.push({
          type: "info",
          title: "Últimos gastos acima da média",
          message:
            "Nas últimas duas semanas você gastou mais do que a sua média habitual.",
        });
    }
    if (balance < 0)
      localInsights.push({
        type: "warning",
        title: "Seu saldo está negativo",
        message: "As despesas superam sua renda registrada.",
      });
    if (goals.length > 0 && spendRatio > 0.6)
      localInsights.push({
        type: "info",
        title: "Meta em risco de atraso",
        message:
          "Com gastos acima de 60% da renda, pode ficar mais difícil atingir metas financeiras.",
      });

    try {
      const apiKey = process.env.EMERGENT_LLM_KEY;
      if (!apiKey) return res.json({ insights: localInsights.slice(0, 4) });

      const summary = transactions
        .slice(0, 12)
        .map(
          (t) =>
            `${t.title}: R$ ${t.amount.toFixed(2)} (${t.type}/${t.category})`,
        )
        .join(", ");
      const prompt = `Você é a assistente financeira do Finix. Analise os dados abaixo e gere 4 insights em português no estilo de uma conversa clara e prática.
Renda total: R$ ${income.toFixed(2)}
Despesas totais: R$ ${expense.toFixed(2)}
Saldo: R$ ${balance.toFixed(2)}
Porcentagem de renda gasta: ${(spendRatio * 100).toFixed(0)}%
Metas cadastradas: ${goals.length}
Últimas transações: ${summary}
Responda apenas com JSON válido no formato:
{ "insights": [{ "type": "success|warning|info", "title": "...", "message": "..." }] }`;

      const response = await fetch(
        "https://integrations.emergentagent.com/llm/v1/messages",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 800,
            messages: [{ role: "user", content: prompt }],
          }),
        },
      );

      const data = (await response.json()) as any;
      let insights: any[] = localInsights.slice(0, 4);
      if (data.content?.[0]) {
        try {
          const jsonMatch = data.content[0].text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed?.insights && Array.isArray(parsed.insights))
              insights = parsed.insights;
          }
        } catch {
          /* usa fallback */
        }
      }
      res.json({ insights });
    } catch (err) {
      console.error("AI Error:", err);
      res.json({ insights: localInsights.slice(0, 4) });
    }
  },
);

export default router;
