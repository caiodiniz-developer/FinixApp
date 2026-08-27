import { prisma } from "../lib/prisma";

export interface HouseholdMemberSummary {
  userId: string;
  name: string;
  income: number;
  expense: number;
  balance: number;
}

/**
 * Combined view across household members — each person's numbers are
 * computed independently from their OWN transactions (nobody's bank data
 * is merged or shared beyond the aggregate figure), then summed. This is
 * the "meio-termo" pitch: a couple sees the household total without either
 * person's individual transaction list becoming visible to the other via
 * this endpoint — only the totals are combined.
 */
export const buildHouseholdSummary = async (householdId: string) => {
  const household = await prisma.household.findUnique({
    where: { id: householdId },
    include: { members: { include: { user: { select: { id: true, name: true } } } }, owner: { select: { id: true, name: true } } },
  });
  if (!household) return null;

  const allUserIds = [household.ownerId, ...household.members.map((m) => m.userId)];
  const uniqueUserIds = Array.from(new Set(allUserIds));

  const members: HouseholdMemberSummary[] = [];
  for (const userId of uniqueUserIds) {
    const person =
      userId === household.ownerId
        ? household.owner
        : household.members.find((m) => m.userId === userId)?.user;
    const tx = await prisma.transaction.findMany({ where: { userId }, select: { amount: true, type: true } });
    const income = tx.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
    const expense = tx.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
    members.push({
      userId,
      name: person?.name || "Membro",
      income: Number(income.toFixed(2)),
      expense: Number(expense.toFixed(2)),
      balance: Number((income - expense).toFixed(2)),
    });
  }

  return {
    id: household.id,
    name: household.name,
    members,
    combinedIncome: Number(members.reduce((s, m) => s + m.income, 0).toFixed(2)),
    combinedExpense: Number(members.reduce((s, m) => s + m.expense, 0).toFixed(2)),
    combinedBalance: Number(members.reduce((s, m) => s + m.balance, 0).toFixed(2)),
  };
};
