import { v4 as uuidv4 } from "uuid";
import { prisma } from "../lib/prisma";
import { planFor } from "../config/plans";
import { getSafeDueDay, diffDays, toLocalDateKey, appNow } from "../lib/dates";
import { splitMoney } from "../lib/money";
import { HttpError } from "../lib/httpError";
import type { AuthUser } from "../middlewares/auth";

export interface InstallmentInput {
  description: string;
  totalAmount: number;
  installments: number;
  dueDay: number;
  startDate: Date;
  category: string;
  paymentMethod: string;
  note?: string | null;
  accountId?: string | null;
  cardId?: string | null;
}

export interface PlannedParcel {
  number: number;
  title: string;
  amount: number;
  date: Date;
}

/**
 * Pure schedule of a purchase split in N parcelas: one per month starting at
 * `startDate`, each on `dueDay` (clamped to the month's last day — day 31 in
 * February becomes the 28th/29th), with amounts that add up to exactly
 * `totalAmount` (leftover centavos go on the last parcela).
 */
export const planInstallments = (
  input: Pick<InstallmentInput, "description" | "totalAmount" | "installments" | "dueDay" | "startDate">,
): PlannedParcel[] => {
  const amounts = splitMoney(input.totalAmount, input.installments);
  const start = new Date(input.startDate);
  return amounts.map((amount, i) => {
    // Built from (year, month + i, 1) rather than setMonth() on the start
    // date: Jan 31 + 1 month via setMonth overflows into March and skips
    // February entirely.
    const year = start.getFullYear();
    const month = start.getMonth() + i;
    const first = new Date(year, month, 1, start.getHours(), start.getMinutes(), start.getSeconds());
    first.setDate(getSafeDueDay(first.getFullYear(), first.getMonth(), input.dueDay));
    return {
      number: i + 1,
      title: `${input.description} • ${i + 1}/${input.installments}`,
      amount,
      date: first,
    };
  });
};

export const buildInstallmentSchedule = async (user: AuthUser, data: InstallmentInput) => {
  const plan = planFor(user);
  if (!plan.hasInstallments) {
    throw new HttpError(
      403,
      "Parcelamento disponível apenas no plano pago. Faça upgrade para ativar.",
      { upgrade: true },
    );
  }
  if (
    plan.transactionsLimit !== -1 &&
    user.transactionsUsed + data.installments > plan.transactionsLimit
  ) {
    throw new HttpError(
      403,
      `Limite mensal de ${plan.transactionsLimit} transações atingido. Faça upgrade do seu plano.`,
      { upgrade: true },
    );
  }

  const installmentId = uuidv4();
  const today = appNow();
  const transactionsData = planInstallments(data).map((parcel) => ({
    id: uuidv4(),
    userId: user.id,
    title: parcel.title,
    amount: parcel.amount,
    type: "EXPENSE",
    category: data.category,
    description: data.note || `Parcela ${parcel.number} de ${data.installments}`,
    date: parcel.date,
    recurring: false,
    paymentMethod: data.paymentMethod,
    installments: data.installments,
    installmentNumber: parcel.number,
    totalInstallments: data.installments,
    totalAmount: data.totalAmount,
    currency: "BRL",
    installmentId,
    accountId: data.accountId ?? null,
    cardId: data.cardId ?? null,
  }));

  // Reminder rows the daily job turns into e-mail/push a few days before
  // each parcela is charged on the card.
  const cardAlerts = transactionsData
    .filter((t) => t.paymentMethod === "credito")
    .map((t) => ({
      id: uuidv4(),
      userId: user.id,
      installmentId,
      title: `Cobrança no cartão: ${t.title}`,
      description: `Parcela vence em ${toLocalDateKey(t.date)}`,
      type: "installment",
      severity: "warning",
      amount: t.amount,
      daysUntilDue: diffDays(t.date, today),
      dueDate: t.date,
    }));

  // All or nothing: a failure halfway used to leave an Installment with only
  // some of its parcelas, or parcelas the monthly counter never counted.
  const [installment] = await prisma.$transaction([
    prisma.installment.create({
      data: {
        id: installmentId,
        userId: user.id,
        description: data.description,
        totalAmount: data.totalAmount,
        numberOfParcels: data.installments,
        dueDay: data.dueDay,
        startDate: data.startDate,
        status: "active",
      },
    }),
    prisma.transaction.createMany({ data: transactionsData }),
    prisma.user.update({
      where: { id: user.id },
      data: { transactionsUsed: { increment: data.installments } },
    }),
    ...(cardAlerts.length ? [prisma.financialAlert.createMany({ data: cardAlerts })] : []),
  ]);

  return { installment, transactions: transactionsData };
};
