import { v4 as uuidv4 } from "uuid";
import { prisma } from "../lib/prisma";
import { planFor } from "../config/plans";
import { getSafeDueDay, diffDays, toLocalDateKey, appNow } from "../lib/dates";

export const buildInstallmentSchedule = async (user: any, data: any) => {
  const plan = planFor(user);
  if (!plan.hasInstallments) {
    throw new Error(
      "Parcelamento disponível apenas no plano pago. Faça upgrade para ativar.",
    );
  }
  if (
    plan.transactionsLimit !== -1 &&
    user.transactionsUsed + data.installments > plan.transactionsLimit
  ) {
    throw new Error(
      `Limite mensal de ${plan.transactionsLimit} transações atingido. Faça upgrade do seu plano.`,
    );
  }

  const installment = await prisma.installment.create({
    data: {
      id: uuidv4(),
      userId: user.id,
      description: data.description,
      totalAmount: data.totalAmount,
      numberOfParcels: data.installments,
      dueDay: data.dueDay,
      startDate: data.startDate,
      status: "active",
    },
  });

  const perParcel = Number((data.totalAmount / data.installments).toFixed(2));
  const remainder = Number(
    (data.totalAmount - perParcel * data.installments).toFixed(2),
  );
  const transactionsData = [] as any[];

  for (let i = 0; i < data.installments; i++) {
    const installmentDate = new Date(data.startDate);
    installmentDate.setMonth(installmentDate.getMonth() + i);
    installmentDate.setDate(
      getSafeDueDay(
        installmentDate.getFullYear(),
        installmentDate.getMonth(),
        data.dueDay,
      ),
    );
    const amount =
      i === data.installments - 1 ? perParcel + remainder : perParcel;
    transactionsData.push({
      id: uuidv4(),
      userId: user.id,
      title: `${data.description} • ${i + 1}/${data.installments}`,
      amount,
      type: "EXPENSE",
      category: data.category,
      description: data.note || `Parcela ${i + 1} de ${data.installments}`,
      date: installmentDate,
      recurring: false,
      paymentMethod: data.paymentMethod,
      installments: data.installments,
      installmentNumber: i + 1,
      totalInstallments: data.installments,
      totalAmount: data.totalAmount,
      currency: "BRL",
      installmentId: installment.id,
      accountId: data.accountId ?? null,
      cardId: data.cardId ?? null,
    });
  }

  await prisma.transaction.createMany({ data: transactionsData });
  await prisma.user.update({
    where: { id: user.id },
    data: { transactionsUsed: { increment: data.installments } },
  });

  // Create persistent financial alerts for installments that are credit-card charges
  try {
    const cardAlerts = transactionsData
      .filter((t) => t.paymentMethod === "credito")
      .map((t) => ({
        id: uuidv4(),
        userId: user.id,
        installmentId: t.installmentId,
        title: `Cobrança no cartão: ${t.title}`,
        description: `Parcela vence em ${toLocalDateKey(new Date(t.date))}`,
        type: "installment",
        severity: "warning",
        amount: t.amount,
        daysUntilDue: diffDays(new Date(t.date), appNow()),
        dueDate: new Date(t.date),
      }));
    if (cardAlerts.length)
      await prisma.financialAlert.createMany({ data: cardAlerts });
  } catch (err: any) {
    console.error("Failed to create installment alerts:", err);
  }

  return { installment, transactions: transactionsData };
};
