import { PrismaClient } from "@prisma/client";
import { sendAlertEmail } from "./emailService";
import { sendPushToUser } from "./pushService";
import { dispatchWebhook } from "./webhookService";

const prisma = new PrismaClient();

/**
 * Finds FinancialAlerts due within the next 3 days that haven't been
 * notified yet (notifiedAt is null) and sends one email + one push per
 * alert, then stamps notifiedAt so the same alert never spams the user
 * again on the next run. Meant to be called once a day by the internal
 * scheduler (see startRecurringJobs in server.ts).
 */
export const sendDueAlertNotifications = async (): Promise<{ notified: number }> => {
  const in3Days = new Date();
  in3Days.setDate(in3Days.getDate() + 3);

  const alerts = await prisma.financialAlert.findMany({
    where: {
      notifiedAt: null,
      isRead: false,
      dueDate: { not: null, lte: in3Days },
    },
    include: { user: true },
  });

  let notified = 0;
  for (const alert of alerts) {
    if (!alert.user) continue;
    const daysUntilDue = alert.dueDate
      ? Math.ceil((alert.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : alert.daysUntilDue ?? undefined;

    await Promise.allSettled([
      sendAlertEmail(alert.user.email, {
        title: alert.title,
        description: alert.description,
        amount: alert.amount,
        daysUntilDue,
      }),
      sendPushToUser(alert.userId, {
        title: alert.title,
        body: alert.description || "Você tem um vencimento se aproximando",
        url: "/app/alerts",
      }),
    ]);

    dispatchWebhook(alert.userId, "alert.due_soon", {
      title: alert.title,
      amount: alert.amount,
      dueDate: alert.dueDate,
    });

    await prisma.financialAlert.update({
      where: { id: alert.id },
      data: { notifiedAt: new Date() },
    });
    notified++;
  }

  return { notified };
};
