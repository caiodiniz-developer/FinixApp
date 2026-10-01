import { describe, expect, it } from "vitest";
import { computeDashboardMetrics } from "../src/utils/dashboardMetrics";
import type { Budget, DashboardData } from "../src/types";

const data = (over: Partial<DashboardData> = {}): DashboardData =>
  ({
    balance: 6000,
    income: 10000,
    expense: 4000,
    saved: 2000,
    monthly: [
      { month: "set", income: 5000, expense: 2000 },
      { month: "out", income: 5000, expense: 1500 },
    ],
    categories: [],
    recent: [],
    insights: [],
    ...over,
  }) as DashboardData;

const budget = (percentage: number) => ({ percentage }) as Budget;

// 15 October 2026: day 15 of a 31-day month
const now = new Date(2026, 9, 15, 12);

describe("computeDashboardMetrics", () => {
  it("derives the pace of spending from the current month", () => {
    const m = computeDashboardMetrics(data(), [], [], now);
    expect(m.daysInMonth).toBe(31);
    expect(m.daysRemaining).toBe(17);
    expect(m.dailyRate).toBe(100); // 1500 spent over 15 days
    expect(m.dailyLimit).toBeCloseTo((5000 - 1500) / 17);
    expect(m.projectedEnd).toBe(5000 - (1500 + 100 * 17));
  });

  it("compares this month with the previous one", () => {
    const m = computeDashboardMetrics(data(), [], [], now);
    expect(m.expenseDiff).toBe(-25); // 2000 -> 1500
    expect(m.incomeDiff).toBe(0);
  });

  it("computes the runway in months of average spending", () => {
    const m = computeDashboardMetrics(data(), [], [], now);
    expect(m.avgMonthly).toBe(1750);
    expect(m.runway).toBeCloseTo(6000 / 1750);
  });

  it("scores financial health between 0 and 100", () => {
    const healthy = computeDashboardMetrics(data(), [budget(50)], [], now);
    // 60% of income left -> 30, savings 20% -> capped 30, budgets ok -> 20
    expect(healthy.healthScore).toBe(80);

    const broke = computeDashboardMetrics(data({ income: 1000, expense: 5000, saved: 0 }), [budget(120)], [], now);
    expect(broke.healthScore).toBe(0);

    const noIncome = computeDashboardMetrics(data({ income: 0, expense: 0, saved: 0 }), [], [], now);
    expect(noIncome.healthScore).toBeGreaterThanOrEqual(0);
    expect(noIncome.healthScore).toBeLessThanOrEqual(100);
  });

  it("reads today's spending from the calendar", () => {
    const days = [{ date: "2026-10-15", expense: 80, revenue: 0, net: -80 }];
    const m = computeDashboardMetrics(data(), [], days, now);
    expect(m.todaySpent).toBe(80);
    expect(m.todayPct).toBeCloseTo((80 / m.dailyLimitSafe) * 100);
  });

  it("counts the streak of positive days, skipping days with no movement", () => {
    const days = [
      { date: "2026-10-10", expense: 50, revenue: 0, net: -50 },
      { date: "2026-10-11", expense: 10, revenue: 100, net: 90 },
      { date: "2026-10-12", expense: 0, revenue: 0, net: 0 },
      { date: "2026-10-13", expense: 20, revenue: 20, net: 0 },
      { date: "2026-10-14", expense: 0, revenue: 300, net: 300 },
    ];
    expect(computeDashboardMetrics(data(), [], days, now).streak).toBe(3);
  });

  it("does not divide by zero on an empty account", () => {
    const m = computeDashboardMetrics(
      data({ balance: 0, income: 0, expense: 0, saved: 0, monthly: [] }),
      [],
      [],
      now,
    );
    for (const value of [m.dailyRate, m.dailyLimit, m.runway, m.velocityPct, m.todayPct, m.expenseDiff]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});
