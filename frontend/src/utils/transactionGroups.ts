import { todayISO } from "./format";

interface Dated {
  date: string;
  type: "INCOME" | "EXPENSE" | string;
  amount: number;
}

export interface DayGroup<T> {
  /** YYYY-MM-DD */
  key: string;
  /** "Hoje", "Ontem" or "seg., 28 de set." (with the year when it is not this one). */
  label: string;
  /** Income minus expenses of the day. */
  total: number;
  items: T[];
}

const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);

const shiftDay = (key: string, days: number) => {
  const d = new Date(`${key}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function dayLabel(key: string, today: string = todayISO()) {
  if (key === today) return "Hoje";
  if (key === shiftDay(today, -1)) return "Ontem";
  if (key === shiftDay(today, 1)) return "Amanhã";
  const sameYear = key.slice(0, 4) === today.slice(0, 4);
  // Stored dates are UTC midnight: format them in UTC or they slip a day.
  return new Date(`${key}T00:00:00.000Z`).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
}

/** Splits a list (already in the order it should be shown) into one block per day. */
export function groupByDay<T extends Dated>(items: T[], today: string = todayISO()): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  const byKey = new Map<string, DayGroup<T>>();
  for (const item of items) {
    const key = dayKey(item.date);
    let group = byKey.get(key);
    if (!group) {
      group = { key, label: dayLabel(key, today), total: 0, items: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
    const cents = Math.round(item.amount * 100) * (item.type === "INCOME" ? 1 : -1);
    group.total = (Math.round(group.total * 100) + cents) / 100;
  }
  return groups;
}
