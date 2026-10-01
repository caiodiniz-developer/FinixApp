import { Router } from "express";
import { roundMoney } from "../lib/money";
import { incomeExpenseTotals, expenseByCategory } from "../services/totalsService";
import { appNow } from "../lib/dates";
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
  const year = req.query.year ? Number(req.query.year) : appNow().getFullYear();
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
    const now = appNow();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Everything the rules below need, computed by the database — the only
    // rows actually fetched are the 12 latest, for the AI prompt.
    const [totals, goalsCount, categories, expenseAgg, recentAgg, latest] = await Promise.all([
      incomeExpenseTotals(user.id),
      prisma.goal.count({ where: { userId: user.id } }),
      expenseByCategory(user.id),
      prisma.transaction.aggregate({
        where: { userId: user.id, type: "EXPENSE" },
        _avg: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: user.id, type: "EXPENSE", date: { gte: fourteenDaysAgo } },
        _avg: { amount: true },
        _count: true,
      }),
      prisma.transaction.findMany({
        where: { userId: user.id },
        orderBy: { date: "desc" },
        take: 12,
        select: { title: true, amount: true, type: true, category: true },
      }),
    ]);

    if (latest.length === 0) {
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

    const { income, expense } = totals;
    const balance = roundMoney(income - expense);
    const spendRatio = income > 0 ? expense / income : 1;
    const avgExpense = expenseAgg._avg.amount || 0;
    const bestCategory = categories[0]
      ? ([categories[0].category, categories[0].amount] as const)
      : undefined;

    type Insight = { type: string; title: string; message: string };
    const localInsights: Insight[] = [];
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
    if (recentAgg._count >= 3 && avgExpense > 0) {
      const recentAvg = recentAgg._avg.amount || 0;
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
    if (goalsCount > 0 && spendRatio > 0.6)
      localInsights.push({
        type: "info",
        title: "Meta em risco de atraso",
        message:
          "Com gastos acima de 60% da renda, pode ficar mais difícil atingir metas financeiras.",
      });

    try {
      const apiKey = process.env.EMERGENT_LLM_KEY;
      if (!apiKey) return res.json({ insights: localInsights.slice(0, 4) });

      const summary = latest
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
Metas cadastradas: ${goalsCount}
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
      let insights: Insight[] = localInsights.slice(0, 4);
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
