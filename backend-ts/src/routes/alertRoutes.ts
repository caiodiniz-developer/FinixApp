import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticate, requireFeature } from "../middlewares/auth";
import { diffDays, appNow } from "../lib/dates";

const router = Router();

// ============================================================================
// ALERTS
// ============================================================================
router.get(
  "/api/alerts",
  authenticate,
  requireFeature("canUseAlerts"),
  async (req, res) => {
    try {
      const user = req.user;
      const today = appNow();
      today.setHours(0, 0, 0, 0);
      const futureLimit = new Date(today);
      futureLimit.setDate(futureLimit.getDate() + 7);

      // 1) persistent FinancialAlert records
      const storedAlerts = await prisma.financialAlert.findMany({
        where: { userId: user.id, isRead: false },
        orderBy: { dueDate: "asc" },
      });

      const persistent = storedAlerts.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        dueDate: a.dueDate,
        amount: a.amount,
        daysUntilDue: a.daysUntilDue,
        severity: a.severity,
        type: a.type,
      }));

      // 2) upcoming installment transactions (existing behavior)
      const upcomingInstallments = await prisma.transaction.findMany({
        where: {
          userId: user.id,
          type: "EXPENSE",
          date: { gte: today, lte: futureLimit },
          totalInstallments: { not: null },
        },
        orderBy: { date: "asc" },
      });

      const computedInstallments = upcomingInstallments.map((tx) => {
        const dueDate = new Date(tx.date);
        const daysUntilDue = diffDays(dueDate, today);
        const installmentsLeft =
          tx.totalInstallments && tx.installmentNumber
            ? tx.totalInstallments - tx.installmentNumber
            : 0;
        const title =
          daysUntilDue === 0
            ? `Parcela ${tx.title} vence hoje — R$ ${tx.amount.toFixed(2)}`
            : `Parcela ${tx.title} vence em ${daysUntilDue} dia${daysUntilDue > 1 ? "s" : ""} — R$ ${tx.amount.toFixed(2)}`;
        const description =
          installmentsLeft > 0
            ? `${installmentsLeft} parcela${installmentsLeft > 1 ? "s" : ""} restantes`
            : "Última parcela";
        return {
          id: tx.id,
          title,
          description,
          dueDate: tx.date,
          amount: tx.amount,
          daysUntilDue,
          severity: daysUntilDue === 0 ? "danger" : "warning",
          installmentNumber: tx.installmentNumber,
          totalInstallments: tx.totalInstallments,
        };
      });

      // 3) upcoming credit-card charges (single transactions or installments flagged as credit)
      const upcomingCardCharges = await prisma.transaction.findMany({
        where: {
          userId: user.id,
          type: "EXPENSE",
          paymentMethod: "credito",
          date: { gte: today, lte: futureLimit },
        },
        orderBy: { date: "asc" },
      });

      const computedCard = upcomingCardCharges.map((tx) => {
        const dueDate = new Date(tx.date);
        const daysUntilDue = diffDays(dueDate, today);
        const title =
          daysUntilDue === 0
            ? `Cobrança no cartão: ${tx.title} — R$ ${tx.amount.toFixed(2)}`
            : `Cobrança no cartão: ${tx.title} vence em ${daysUntilDue} dia${daysUntilDue > 1 ? "s" : ""} — R$ ${tx.amount.toFixed(2)}`;
        return {
          id: tx.id,
          title,
          description: tx.description || null,
          dueDate: tx.date,
          amount: tx.amount,
          daysUntilDue,
          severity: daysUntilDue === 0 ? "danger" : "warning",
          type: "card_charge",
        };
      });

      // Merge all alerts and sort by dueDate
      const alerts = [
        ...persistent,
        ...computedInstallments,
        ...computedCard,
      ].sort((a, b) => {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        return da - db;
      });

      res.json({ alerts, count: alerts.length });
    } catch (err: any) {
      console.error("Alerts error:", err);
      res.status(500).json({ error: "Erro ao buscar alertas" });
    }
  },
);

router.post("/api/alerts/read", authenticate, (_req, res) => {
  res.json({ ok: true });
});

export default router;
