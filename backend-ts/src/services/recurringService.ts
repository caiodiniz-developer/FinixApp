import { PrismaClient } from "@prisma/client";
import { dispatchWebhook } from "./webhookService";

const prisma = new PrismaClient();

export type RecurrenceFrequency = "weekly" | "monthly" | "yearly";

export const computeNextRunDate = (from: Date, frequency: RecurrenceFrequency): Date => {
  const next = new Date(from);
  if (frequency === "weekly") next.setDate(next.getDate() + 7);
  else if (frequency === "yearly") next.setFullYear(next.getFullYear() + 1);
  else next.setMonth(next.getMonth() + 1); // monthly is the default
  return next;
};

/**
 * Scans every active RecurringTransaction whose nextRunDate has arrived,
 * creates the concrete Transaction for this cycle, and advances
 * nextRunDate — looping per-row (not just +1 period) so a rule that missed
 * several cycles (server was down, etc.) catches up instead of silently
 * skipping ahead to "now".
 */
export const runDueRecurringTransactions = async (): Promise<{ created: number }> => {
  const now = new Date();
  const due = await prisma.recurringTransaction.findMany({
    where: { active: true, nextRunDate: { lte: now } },
  });

  let created = 0;
  for (const rule of due) {
    let cursor = rule.nextRunDate;
    // Cap at 24 catch-up cycles per run so a rule paused for years doesn't
    // flood the account with backlogged transactions in one pass.
    for (let i = 0; i < 24 && cursor <= now; i++) {
      await prisma.transaction.create({
        data: {
          userId: rule.userId,
          title: rule.title,
          amount: rule.amount,
          type: rule.type,
          category: rule.category,
          description: `Recorrência automática: ${rule.title}`,
          date: cursor,
          recurring: true,
          recurringFrequency: rule.frequency,
          accountId: rule.accountId,
          cardId: rule.cardId,
        },
      });
      created++;
      await prisma.user.update({
        where: { id: rule.userId },
        data: { transactionsUsed: { increment: 1 } },
      }).catch(() => {});

      dispatchWebhook(rule.userId, "transaction.created", {
        title: rule.title,
        amount: rule.amount,
        type: rule.type,
        source: "recurring",
      });

      cursor = computeNextRunDate(cursor, rule.frequency as RecurrenceFrequency);
    }

    await prisma.recurringTransaction.update({
      where: { id: rule.id },
      data: { nextRunDate: cursor, lastRunDate: now },
    });
  }

  return { created };
};
