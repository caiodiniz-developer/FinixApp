export interface DebtLike {
  id: string;
  creditor: string;
  remainingAmount: number;
  interestRate: number;
  minPayment: number;
}

export interface PayoffStep {
  id: string;
  creditor: string;
  order: number;
  monthsToPayOff: number;
}

/**
 * Avalanche: pay minimums everywhere, throw every spare real at the
 * highest-interest debt first (mathematically cheapest long-run).
 * Snowball: same idea but order by smallest balance first (psychologically
 * easier — quick wins keep people going). Both are legitimate strategies;
 * this just orders the list and estimates a payoff timeline, it never talks
 * to a creditor.
 */
export const prioritizeDebts = (debts: DebtLike[], method: "avalanche" | "snowball") => {
  const sorted = [...debts].sort((a, b) =>
    method === "avalanche" ? b.interestRate - a.interestRate : a.remainingAmount - b.remainingAmount,
  );
  return sorted;
};

/**
 * Simulates month-by-month payoff: minimum payment on every debt, and the
 * full `extraPayment` budget goes to whichever debt is first in priority
 * order, snowballing onto the next debt once one is paid off.
 */
export const simulatePayoff = (
  debts: DebtLike[],
  method: "avalanche" | "snowball",
  extraPayment: number,
): PayoffStep[] => {
  const order = prioritizeDebts(debts, method);
  const balances = new Map(order.map((d) => [d.id, d.remainingAmount]));
  const monthsPaidOff = new Map<string, number>();

  let month = 0;
  const maxMonths = 600; // 50 years safety cap against pathological inputs
  while (Array.from(balances.values()).some((b) => b > 0.01) && month < maxMonths) {
    month++;
    let freeBudget = extraPayment;

    // Minimum payments first, on every still-open debt.
    for (const d of order) {
      const bal = balances.get(d.id)!;
      if (bal <= 0) continue;
      const payment = Math.min(bal, d.minPayment);
      balances.set(d.id, bal - payment);
    }

    // Then dump the extra budget on the highest-priority still-open debt.
    for (const d of order) {
      const bal = balances.get(d.id)!;
      if (bal <= 0) continue;
      const payment = Math.min(bal, freeBudget);
      balances.set(d.id, bal - payment);
      freeBudget -= payment;
      if (freeBudget <= 0) break;
    }

    for (const d of order) {
      if (balances.get(d.id)! <= 0.01 && !monthsPaidOff.has(d.id)) {
        monthsPaidOff.set(d.id, month);
      }
    }
  }

  return order.map((d, i) => ({
    id: d.id,
    creditor: d.creditor,
    order: i + 1,
    monthsToPayOff: monthsPaidOff.get(d.id) ?? month,
  }));
};
