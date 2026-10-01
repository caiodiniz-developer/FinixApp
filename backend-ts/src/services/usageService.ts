import { prisma } from "../lib/prisma";
import { appNow } from "../lib/dates";

export const currentMonthKey = () => {
  const d = appNow();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const resetMonthlyIfNeeded = async (userId: string, currentMonth: string) => {
  const mk = currentMonthKey();
  if (currentMonth !== mk) {
    await prisma.user.update({
      where: { id: userId },
      data: { transactionsUsed: 0, transactionsMonth: mk },
    });
    return 0;
  }
  return null;
};
