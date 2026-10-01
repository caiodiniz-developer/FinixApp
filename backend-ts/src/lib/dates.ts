import { APP_TIMEZONE } from "../config/env";

const wallClock = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/**
 * "Now" as the user's wall clock reads it (APP_TIMEZONE, Brazil by default),
 * expressed in the same UTC-based frame the stored calendar dates use. Use it
 * whenever the question is "which day/month are we in" — the server clock is
 * UTC, so between 21:00 and midnight in Brazil a plain `new Date()` is
 * already in tomorrow (and on the last day of the month, in next month).
 *
 * Not a real instant: never store it or compare it with timestamps like
 * createdAt/expiresAt — use `new Date()` for those.
 */
export const appNow = (instant: Date = new Date()): Date => {
  const p: Record<string, number> = {};
  for (const part of wallClock.formatToParts(instant)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  return new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second));
};

export const getSafeDueDay = (year: number, month: number, day: number) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Math.min(day, daysInMonth);
};

export const diffDays = (dateA: Date, dateB: Date) => {
  const a = new Date(dateA);
  const b = new Date(dateB);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
};

export const toLocalDateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// A card's "fatura" is a rolling window that closes on `closingDay` of each
// month and opens the day after the previous closing — computed on read from
// Transaction rows, never stored, same philosophy as budgets' `spent`.
export const cardStatementWindow = (closingDay: number, year: number, month0: number) => {
  const closeDay = getSafeDueDay(year, month0, closingDay);
  const end = new Date(year, month0, closeDay, 23, 59, 59, 999);
  const prev = new Date(year, month0 - 1, 1);
  const startDay = getSafeDueDay(prev.getFullYear(), prev.getMonth(), closingDay);
  const start = new Date(prev.getFullYear(), prev.getMonth(), startDay + 1, 0, 0, 0, 0);
  return { start, end };
};

export const currentStatementMonth = (closingDay: number, ref: Date = appNow()) => {
  const day = getSafeDueDay(ref.getFullYear(), ref.getMonth(), closingDay);
  if (ref.getDate() > day) {
    const next = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
    return { year: next.getFullYear(), month0: next.getMonth() };
  }
  return { year: ref.getFullYear(), month0: ref.getMonth() };
};
