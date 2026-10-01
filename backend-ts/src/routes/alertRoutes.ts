import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, requireFeature } from "../middlewares/auth";
import { diffDays, appNow } from "../lib/dates";

const router = Router();

// ============================================================================
// ALERTS
// ============================================================================
// Two kinds of alert come out of here:
//
//  - "notice":   a stored FinancialAlert the user hasn't dismissed yet (card
//                limit reached, impulse-purchase nudge...). Marked as read
//                through POST /api/alerts/read.
//  - "upcoming": computed live from the transactions due in the next 7 days
//                (parcelas and card charges). Not stored, so nothing to mark
//                as read — it disappears on its own once the date passes.
//
// Stored alerts of type "installment" are NOT listed: they exist only so the
// daily job can send the e-mail/push reminder, and the same charge already
// appears here as an "upcoming" item. Listing both is what used to make one
// parcela show up three times.
router.get(
  "/api/alerts",
  authenticate,
  requireFeature("canUseAlerts"),
  async (req, res) => {
    const user = req.user;
    const today = appNow();
    today.setHours(0, 0, 0, 0);
    const futureLimit = new Date(today);
    futureLimit.setDate(futureLimit.getDate() + 7);

    const [stored, upcoming] = await Promise.all([
      prisma.financialAlert.findMany({
        where: { userId: user.id, isRead: false, type: { not: "installment" } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.transaction.findMany({
        where: {
          userId: user.id,
          type: "EXPENSE",
          date: { gte: today, lte: futureLimit },
          OR: [{ totalInstallments: { not: null } }, { paymentMethod: "credito" }],
        },
        orderBy: { date: "asc" },
      }),
    ]);

    const notices = stored.map((a) => ({
      id: a.id,
      source: "notice" as const,
      title: a.title,
      description: a.description,
      dueDate: a.dueDate,
      amount: a.amount,
      daysUntilDue: a.dueDate ? diffDays(a.dueDate, today) : null,
      severity: a.severity,
      type: a.type,
      createdAt: a.createdAt,
    }));

    // One alert per transaction, even when it is both a parcela and a card charge.
    const upcomingAlerts = upcoming.map((tx) => {
      const daysUntilDue = diffDays(tx.date, today);
      const when =
        daysUntilDue === 0
          ? "vence hoje"
          : `vence em ${daysUntilDue} dia${daysUntilDue > 1 ? "s" : ""}`;
      const isInstallment = !!tx.totalInstallments;
      const installmentsLeft =
        tx.totalInstallments && tx.installmentNumber
          ? tx.totalInstallments - tx.installmentNumber
          : 0;
      return {
        id: tx.id,
        source: "upcoming" as const,
        title: `${isInstallment ? "Parcela" : "Cobrança no cartão:"} ${tx.title} ${when} — R$ ${tx.amount.toFixed(2)}`,
        description: isInstallment
          ? installmentsLeft > 0
            ? `${installmentsLeft} parcela${installmentsLeft > 1 ? "s" : ""} restantes`
            : "Última parcela"
          : tx.description || null,
        dueDate: tx.date,
        amount: tx.amount,
        daysUntilDue,
        severity: daysUntilDue === 0 ? "danger" : "warning",
        type: isInstallment ? "installment" : "card_charge",
        installmentNumber: tx.installmentNumber,
        totalInstallments: tx.totalInstallments,
      };
    });

    const alerts = [...notices, ...upcomingAlerts];
    res.json({ alerts, count: alerts.length });
  },
);

// Dismisses stored notices. With `ids`, only those; without, all of them.
router.post("/api/alerts/read", authenticate, async (req, res) => {
  const { ids } = z
    .object({ ids: z.array(z.string()).max(200).optional() })
    .parse(req.body ?? {});
  const result = await prisma.financialAlert.updateMany({
    where: {
      userId: req.user.id,
      isRead: false,
      type: { not: "installment" },
      ...(ids ? { id: { in: ids } } : {}),
    },
    data: { isRead: true },
  });
  res.json({ ok: true, read: result.count });
});

export default router;
