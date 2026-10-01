import { prisma } from "../lib/prisma";
import { sendPushToUser } from "./pushService";

const ALERT_TYPE = "impulse_review";

/**
 * Nudges users about impulse-flagged expenses from ~24h ago — "ainda vale a
 * pena aquela compra?" The transaction already happened (money moved
 * immediately, this isn't a hold); this is purely the behavioral-economics
 * reflection prompt.
 *
 * Fires exactly once per transaction no matter how often the job runs (every
 * deploy restarts the server and re-runs it): the in-app alert created here
 * doubles as the "already nudged" marker.
 */
export const sendDueImpulseReflections = async (): Promise<{ notified: number }> => {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const candidates = await prisma.transaction.findMany({
    where: {
      flaggedImpulse: true,
      reflectedAt: null,
      createdAt: { gte: windowStart, lte: windowEnd },
    },
  });

  let notified = 0;
  for (const tx of candidates) {
    const title = `Ainda vale a pena? "${tx.title}"`;
    const already = await prisma.financialAlert.findFirst({
      where: { userId: tx.userId, type: ALERT_TYPE, title, createdAt: { gte: tx.createdAt } },
      select: { id: true },
    });
    if (already) continue;

    await prisma.financialAlert.create({
      data: {
        userId: tx.userId,
        title,
        description: `Ontem você registrou esta compra de R$ ${tx.amount.toFixed(2)} como não planejada. Dá uma olhada.`,
        type: ALERT_TYPE,
        severity: "info",
        amount: tx.amount,
        // Already delivered right below — keeps the due-alert job from
        // sending a second notification for the same thing.
        notifiedAt: now,
      },
    });
    await sendPushToUser(tx.userId, {
      title: "Ainda vale a pena?",
      body: `Ontem você registrou "${tx.title}" (R$ ${tx.amount.toFixed(2)}) como uma compra não planejada. Dá uma olhada.`,
      url: "/app/transactions?review=impulse",
    });
    notified++;
  }
  return { notified };
};
