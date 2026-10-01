import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middlewares/authenticate";
import { toLocalDateKey } from "../lib/dates";

const router = Router();

// ============================================================================
// CALENDAR
// ============================================================================
router.get("/api/calendar", authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const monthParam = String(req.query.month || "");
    const [year, month] = monthParam.split("-").map(Number);
    const selected =
      Number.isInteger(year) && Number.isInteger(month)
        ? new Date(year, month - 1, 1)
        : new Date();

    const startOfMonth = new Date(
      selected.getFullYear(),
      selected.getMonth(),
      1,
      0,
      0,
      0,
      0,
    );
    const endOfMonth = new Date(
      selected.getFullYear(),
      selected.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id, date: { gte: startOfMonth, lte: endOfMonth } },
      orderBy: { date: "asc" },
    });

    const dailyMap: Record<
      string,
      { revenue: number; expense: number; net: number; transactions: any[] }
    > = {};
    const monthDays = new Date(
      selected.getFullYear(),
      selected.getMonth() + 1,
      0,
    ).getDate();

    for (let day = 1; day <= monthDays; day++) {
      const dateKey = toLocalDateKey(
        new Date(selected.getFullYear(), selected.getMonth(), day),
      );
      dailyMap[dateKey] = { revenue: 0, expense: 0, net: 0, transactions: [] };
    }

    const monthlyTotal = { revenue: 0, expense: 0, net: 0 };

    transactions.forEach((tx) => {
      const dateKey = toLocalDateKey(new Date(tx.date));
      if (!dailyMap[dateKey])
        dailyMap[dateKey] = {
          revenue: 0,
          expense: 0,
          net: 0,
          transactions: [],
        };
      const values = dailyMap[dateKey];
      if (tx.type === "INCOME") {
        values.revenue += Number(tx.amount);
        monthlyTotal.revenue += Number(tx.amount);
      } else {
        values.expense += Number(tx.amount);
        monthlyTotal.expense += Number(tx.amount);
      }
      values.net = values.revenue - values.expense;
      monthlyTotal.net = monthlyTotal.revenue - monthlyTotal.expense;
      values.transactions.push({
        id: tx.id,
        title: tx.title,
        amount: tx.amount,
        type: tx.type,
        category: tx.category,
        description: tx.description ?? null,
        date: toLocalDateKey(new Date(tx.date)),
        paymentMethod: tx.paymentMethod ?? "pix",
        currency: tx.currency ?? "BRL",
        recurring: tx.recurring ?? false,
        recurringFrequency: tx.recurringFrequency ?? null,
        installmentGroupId: (tx as any).installmentId ?? null,
        installmentNumber: tx.installmentNumber ?? null,
        totalInstallments: tx.totalInstallments ?? null,
      });
      dailyMap[dateKey] = values;
    });

    const dailySummary = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));

    res.json({
      month: selected.getMonth() + 1,
      year: selected.getFullYear(),
      monthlyTotal,
      dailySummary,
    });
  } catch (err: any) {
    console.error("Calendar error:", err);
    res.status(500).json({ error: "Erro ao carregar calendário" });
  }
});

export default router;
