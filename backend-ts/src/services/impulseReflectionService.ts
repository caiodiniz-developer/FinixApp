import { prisma } from "../lib/prisma";
import { sendPushToUser } from "./pushService";

/**
 * Once a day, nudges users about impulse-flagged expenses from ~24h ago —
 * "ainda vale a pena aquela compra?" The transaction already happened
 * (money moved immediately, this isn't a hold), this is purely the
 * behavioral-economics reflection prompt. Fires exactly once per
 * transaction: only within the 24-48h window after creation, regardless of
 * whether the user has acted on it yet (it stays visible in the in-app
 * review list either way — this is just the one nudge).
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
    await sendPushToUser(tx.userId, {
      title: "Ainda vale a pena?",
      body: `Ontem você registrou "${tx.title}" (R$ ${tx.amount.toFixed(2)}) como uma compra não planejada. Dá uma olhada.`,
      url: "/app/transactions?review=impulse",
    });
    notified++;
  }
  return { notified };
};
