import { prisma } from "../lib/prisma";

export interface DetectedSubscription {
  signature: string;
  title: string;
  avgAmount: number;
  occurrences: number;
  totalSpent: number;
  firstDate: string;
  lastDate: string;
  avgIntervalDays: number;
}

const normalizeTitle = (title: string) =>
  title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9 ]/g, "")
    .trim();

const buildSignature = (normalizedTitle: string, avgAmount: number) =>
  `${normalizedTitle}:${Math.round(avgAmount)}`;

/**
 * Finds recurring-looking spending patterns the user never marked as
 * "recorrente" — same title (normalized) + similar amount, repeating on a
 * roughly monthly cadence, 3+ times. This is what catches the gym
 * membership nobody cancelled or the streaming trial that became a real
 * subscription, without the user having to have set anything up.
 */
export const detectZombieSubscriptions = async (userId: string): Promise<DetectedSubscription[]> => {
  const [transactions, existingRecurring, dismissals] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, type: "EXPENSE" },
      orderBy: { date: "asc" },
      select: { title: true, amount: true, date: true },
    }),
    prisma.recurringTransaction.findMany({ where: { userId }, select: { title: true } }),
    prisma.subscriptionInsightDismissal.findMany({ where: { userId }, select: { signature: true } }),
  ]);

  const alreadyTracked = new Set(existingRecurring.map((r) => normalizeTitle(r.title)));
  const dismissedSignatures = new Set(dismissals.map((d) => d.signature));

  const groups = new Map<string, { title: string; amount: number; date: Date }[]>();
  for (const t of transactions) {
    const key = normalizeTitle(t.title);
    if (!key || alreadyTracked.has(key)) continue;
    const list = groups.get(key) || [];
    list.push({ title: t.title, amount: t.amount, date: t.date });
    groups.set(key, list);
  }

  const results: DetectedSubscription[] = [];
  for (const [key, entries] of groups) {
    if (entries.length < 3) continue;

    const avgAmount = entries.reduce((s, e) => s + e.amount, 0) / entries.length;
    // Amounts must be reasonably consistent — a coincidence of 3 unrelated
    // "iFood" purchases at wildly different values isn't a subscription.
    const consistent = entries.every((e) => Math.abs(e.amount - avgAmount) / avgAmount <= 0.15);
    if (!consistent) continue;

    const gaps: number[] = [];
    for (let i = 1; i < entries.length; i++) {
      gaps.push((entries[i].date.getTime() - entries[i - 1].date.getTime()) / (1000 * 60 * 60 * 24));
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    // 20-40 days covers monthly billing even with a few days of jitter
    // (weekends, retry after a declined card, etc.)
    if (avgGap < 20 || avgGap > 40) continue;

    const signature = buildSignature(key, avgAmount);
    if (dismissedSignatures.has(signature)) continue;

    results.push({
      signature,
      title: entries[entries.length - 1].title,
      avgAmount: Number(avgAmount.toFixed(2)),
      occurrences: entries.length,
      totalSpent: Number(entries.reduce((s, e) => s + e.amount, 0).toFixed(2)),
      firstDate: entries[0].date.toISOString(),
      lastDate: entries[entries.length - 1].date.toISOString(),
      avgIntervalDays: Math.round(avgGap),
    });
  }

  return results.sort((a, b) => b.totalSpent - a.totalSpent);
};

export { normalizeTitle, buildSignature };
