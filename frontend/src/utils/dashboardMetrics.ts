import { Budget, DashboardData } from "../types";

interface DayTotals {
  date: string;
  expense: number;
  revenue: number;
  net: number;
}

const EMPTY_MONTH = { income: 0, expense: 0 };

/**
 * The numbers the dashboard derives from the raw API payload: pace of
 * spending, projection for the end of the month, the 0–100 health score and
 * the streak of positive days. Pure — given the same inputs and `now` it
 * always returns the same result.
 */
export function computeDashboardMetrics(
  data: DashboardData,
  budgets: Budget[],
  calDays: DayTotals[],
  now: Date = new Date(),
) {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysRemaining = daysInMonth - dayOfMonth + 1;
  const curMonth = data.monthly[data.monthly.length - 1] || EMPTY_MONTH;
  const prevMonth = data.monthly[data.monthly.length - 2] || EMPTY_MONTH;

  const dailyRate = dayOfMonth > 0 ? curMonth.expense / dayOfMonth : 0;
  const dailyLimit = curMonth.income > 0 ? (curMonth.income - curMonth.expense) / daysRemaining : 0;
  const projectedEnd = curMonth.income - (curMonth.expense + dailyRate * daysRemaining);
  const avgMonthly = data.monthly.reduce((s, m) => s + m.expense, 0) / (data.monthly.length || 1);
  /** How many months of average spending the current balance covers. */
  const runway = avgMonthly > 0 ? data.balance / avgMonthly : 0;
  const velocityPct =
    curMonth.income > 0 ? Math.min((dailyRate / (curMonth.income / daysInMonth)) * 100, 100) : 0;

  const savingsRate = data.income > 0 ? (data.saved / data.income) * 100 : 0;
  const expenseRatio = data.income > 0 ? (data.expense / data.income) * 100 : 100;
  const budgetHealth =
    budgets.length > 0
      ? (budgets.filter((b) => b.percentage < 80).length / budgets.length) * 100
      : 100;
  // 50% how much of the income is left, up to 30 points for saving, 20% budgets under control.
  const healthScore = Math.round(
    Math.min(
      100,
      Math.max(0, Math.max(0, 100 - expenseRatio) * 0.5 + Math.min(savingsRate * 2, 30) + budgetHealth * 0.2),
    ),
  );

  const expenseDiff =
    prevMonth.expense > 0 ? ((curMonth.expense - prevMonth.expense) / prevMonth.expense) * 100 : 0;
  const incomeDiff =
    prevMonth.income > 0 ? ((curMonth.income - prevMonth.income) / prevMonth.income) * 100 : 0;

  const pad = (n: number) => String(n).padStart(2, "0");
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const todaySpent = calDays.find((d) => d.date === todayKey)?.expense || 0;
  const dailyLimitSafe = Math.max(dailyLimit, 0);
  const todayPct = dailyLimitSafe > 0 ? Math.min((todaySpent / dailyLimitSafe) * 100, 100) : 0;

  // Consecutive days (most recent first) that closed with a non-negative
  // balance; days without any movement don't break the streak.
  let streak = 0;
  for (const d of [...calDays].sort((a, b) => b.date.localeCompare(a.date))) {
    if (d.expense === 0 && d.revenue === 0) continue;
    if (d.net >= 0) streak++;
    else break;
  }

  return {
    daysInMonth,
    dayOfMonth,
    daysRemaining,
    curMonth,
    prevMonth,
    dailyRate,
    dailyLimit,
    projectedEnd,
    avgMonthly,
    runway,
    velocityPct,
    savingsRate,
    expenseRatio,
    budgetHealth,
    healthScore,
    expenseDiff,
    incomeDiff,
    todayKey,
    todaySpent,
    dailyLimitSafe,
    todayPct,
    streak,
  };
}
