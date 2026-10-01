import { describe, expect, it } from "vitest";
import {
  appNow,
  cardStatementWindow,
  currentStatementMonth,
  getSafeDueDay,
} from "../src/lib/dates";

const iso = (d: Date) => d.toISOString();

describe("card statement (fatura)", () => {
  it("covers the day after the previous closing up to the closing day", () => {
    // closes on the 10th: the October statement is Sep 11 .. Oct 10
    const { start, end } = cardStatementWindow(10, 2026, 9);
    expect(iso(start)).toBe("2026-09-11T00:00:00.000Z");
    expect(iso(end)).toBe("2026-10-10T23:59:59.999Z");
  });

  it("clamps a closing day that does not exist in the month", () => {
    // closes on the 31st: the February statement ends Feb 28 and starts the day after Jan 31
    const { start, end } = cardStatementWindow(31, 2027, 1);
    expect(iso(end)).toBe("2027-02-28T23:59:59.999Z");
    expect(iso(start)).toBe("2027-02-01T00:00:00.000Z");
  });

  it("crosses the year boundary", () => {
    const { start, end } = cardStatementWindow(5, 2027, 0);
    expect(iso(start)).toBe("2026-12-06T00:00:00.000Z");
    expect(iso(end)).toBe("2027-01-05T23:59:59.999Z");
  });

  it("a purchase after the closing day belongs to the next statement", () => {
    expect(currentStatementMonth(10, new Date("2026-10-10T12:00:00Z"))).toEqual({ year: 2026, month0: 9 });
    expect(currentStatementMonth(10, new Date("2026-10-11T12:00:00Z"))).toEqual({ year: 2026, month0: 10 });
    expect(currentStatementMonth(10, new Date("2026-12-20T12:00:00Z"))).toEqual({ year: 2027, month0: 0 });
  });

  it("getSafeDueDay respects leap years", () => {
    expect(getSafeDueDay(2027, 1, 31)).toBe(28);
    expect(getSafeDueDay(2028, 1, 31)).toBe(29);
    expect(getSafeDueDay(2026, 3, 31)).toBe(30);
  });
});

describe("appNow", () => {
  it("reads the clock in Brazil time, not UTC", () => {
    // 01:30 UTC on Oct 1st is still 22:30 of Sep 30th in São Paulo
    const now = appNow(new Date("2026-10-01T01:30:00Z"));
    expect(now.getMonth()).toBe(8);
    expect(now.getDate()).toBe(30);
    expect(now.getHours()).toBe(22);
  });
});
