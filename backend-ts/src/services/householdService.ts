import { prisma } from "../lib/prisma";
import { roundMoney, sumMoney } from "../lib/money";

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

  const names = new Map<string, string>([[household.ownerId, household.owner.name]]);
  for (const m of household.members) if (!names.has(m.userId)) names.set(m.userId, m.user.name);
  const userIds = Array.from(names.keys());

  // One grouped query for the whole household instead of downloading every
  // member's full transaction history.
  const sums = await prisma.transaction.groupBy({
    by: ["userId", "type"],
    where: { userId: { in: userIds } },
    _sum: { amount: true },
  });
  const sumOf = (userId: string, type: string) =>
    roundMoney(sums.find((s) => s.userId === userId && s.type === type)?._sum.amount);

  const members: HouseholdMemberSummary[] = userIds.map((userId) => {
    const income = sumOf(userId, "INCOME");
    const expense = sumOf(userId, "EXPENSE");
    return {
      userId,
      name: names.get(userId) || "Membro",
      income,
      expense,
      balance: roundMoney(income - expense),
    };
  });

  return {
    id: household.id,
    name: household.name,
    members,
    combinedIncome: sumMoney(members.map((m) => m.income)),
    combinedExpense: sumMoney(members.map((m) => m.expense)),
    combinedBalance: sumMoney(members.map((m) => m.balance)),
  };
};
