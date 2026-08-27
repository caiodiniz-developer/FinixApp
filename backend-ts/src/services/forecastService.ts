import { prisma } from "../lib/prisma";
import { computeNextRunDate, RecurrenceFrequency } from "./recurringService";

const toDateKey = (d: Date) => d.toISOString().slice(0, 10);

export interface ForecastDay {
  date: string;
  balance: number;
  events: { title: string; amount: number; type: "INCOME" | "EXPENSE"; source: "transaction" | "recurring" }[];
}

export interface RiskWindow {
  start: string;
  end: string;
  lowestBalance: number;
  reason: string;
}

/**
 * Projects daily balance for the next `days` days by combining:
 *  - the current balance (income - expense - saved, same formula as /api/dashboard)
 *  - Transaction rows already dated in the future (installments are
 *    pre-materialized as real rows with future dates, so card bills and
 *    parcelas already show up here with zero extra work)
 *  - RecurringTransaction rules, projected forward from nextRunDate
 * This is what makes it a *forecast* instead of a history chart — nothing
 * else in the app simulates money that hasn't moved yet.
 */
export const buildForecast = async (
  userId: string,
  days = 30,
): Promise<{ currentBalance: number; days: ForecastDay[]; riskWindows: RiskWindow[] }> => {
  const [allTx, goals, recurring] = await Promise.all([
    prisma.transaction.findMany({ where: { userId } }),
    prisma.goal.findMany({ where: { userId } }),
    prisma.recurringTransaction.findMany({ where: { userId, active: true } }),
  ]);

  const income = allTx.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const expense = allTx.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
  const saved = goals.reduce((s, g) => s + g.currentAmount, 0);
  const currentBalance = income - expense - saved;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizonEnd = new Date(today);
  horizonEnd.setDate(horizonEnd.getDate() + days);

  // Bucket future-dated transactions (installments/scheduled) by day.
  const byDay = new Map<string, ForecastDay["events"]>();
  for (const t of allTx) {
    const d = new Date(t.date);
    d.setHours(0, 0, 0, 0);
    if (d < today || d > horizonEnd) continue;
    const key = toDateKey(d);
    const list = byDay.get(key) || [];
    list.push({ title: t.title, amount: t.amount, type: t.type as "INCOME" | "EXPENSE", source: "transaction" });
    byDay.set(key, list);
  }

  // Project each recurring rule's occurrences inside the window, starting
  // from its own nextRunDate (same advance logic the actual daily job uses).
  for (const rule of recurring) {
    let cursor = new Date(rule.nextRunDate);
    let guard = 0;
    while (cursor <= horizonEnd && guard < 24) {
      if (cursor >= today) {
        const key = toDateKey(cursor);
        const list = byDay.get(key) || [];
        list.push({ title: rule.title, amount: rule.amount, type: rule.type as "INCOME" | "EXPENSE", source: "recurring" });
        byDay.set(key, list);
      }
      cursor = computeNextRunDate(cursor, rule.frequency as RecurrenceFrequency);
      guard++;
    }
  }

  const result: ForecastDay[] = [];
  let running = currentBalance;
  for (let i = 0; i <= days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const key = toDateKey(d);
    const events = byDay.get(key) || [];
    for (const e of events) {
      running += e.type === "INCOME" ? e.amount : -e.amount;
    }
    result.push({ date: key, balance: Number(running.toFixed(2)), events });
  }

  // A "risk window" is a run of consecutive days below zero — grouped so the
  // UI can say "18 a 22" instead of five separate warnings.
  const riskWindows: RiskWindow[] = [];
  let windowStart: ForecastDay | null = null;
  let windowLowest = 0;
  let windowReasons = new Set<string>();
  for (const day of result) {
    if (day.balance < 0) {
      if (!windowStart) {
        windowStart = day;
        windowLowest = day.balance;
        windowReasons = new Set();
      }
      windowLowest = Math.min(windowLowest, day.balance);
      day.events.filter((e) => e.type === "EXPENSE").forEach((e) => windowReasons.add(e.title));
    } else if (windowStart) {
      riskWindows.push({
        start: windowStart.date,
        end: result[result.indexOf(day) - 1]?.date || windowStart.date,
        lowestBalance: windowLowest,
        reason: Array.from(windowReasons).slice(0, 3).join(", ") || "acúmulo de despesas",
      });
      windowStart = null;
    }
  }
  if (windowStart) {
    riskWindows.push({
      start: windowStart.date,
      end: result[result.length - 1].date,
      lowestBalance: windowLowest,
      reason: Array.from(windowReasons).slice(0, 3).join(", ") || "acúmulo de despesas",
    });
  }

  return { currentBalance, days: result, riskWindows };
};
