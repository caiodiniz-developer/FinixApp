import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../lib/prisma";
import { PLANS } from "../config/plans";
import { authenticate } from "../middlewares/authenticate";
import { transactionSchema } from "../schemas";
import { diffDays } from "../lib/dates";
import { checkCardLimitAlert } from "../services/cardService";
import { buildInstallmentSchedule } from "../services/installmentService";
import { upload } from "../lib/upload";
import { dispatchWebhook } from "../services/webhookService";
import { sendPushToUser } from "../services/pushService";
import { isAnomalousExpense } from "../services/anomalyDetectionService";

const router = Router();

// ============================================================================
// TRANSACTIONS
// ============================================================================
router.get("/api/transactions", authenticate, async (req, res) => {
  const user = (req as any).user;
  const plan = PLANS[user.plan] || PLANS.FREE;
  if (!plan.canUseTransactions) {
    return res.status(403).json({
      error:
        "Acesso a transações não disponível no seu plano. Faça upgrade para acessar.",
      upgrade: true,
      currentPlan: user.plan,
    });
  }
  const { type, category, search, startDate, endDate, date } = req.query;
  const where: any = { userId: user.id };
  if (type) where.type = type;
  if (category) where.category = category;
  if (search) where.title = { contains: search as string };

  const buildDateRange = (dateStr: string) => {
    const [year, month, day] = String(dateStr).split("-").map(Number);
    if ([year, month, day].some((value) => !Number.isInteger(value)))
      return null;
    return {
      gte: new Date(year, month - 1, day, 0, 0, 0, 0),
      lte: new Date(year, month - 1, day, 23, 59, 59, 999),
    };
  };

  if (date) {
    const range = buildDateRange(String(date));
    if (range) where.date = range;
  } else if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate as string);
    if (endDate) where.date.lte = new Date(endDate as string);
  }

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { date: "desc" },
  });
  res.json(transactions);
});

router.post("/api/transactions", authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = transactionSchema.parse(req.body);
  const plan = PLANS[user.plan] || PLANS.FREE;

  if (!plan.canUseTransactions) {
    return res.status(403).json({
      error: "Acesso a transações não disponível no seu plano.",
      upgrade: true,
      currentPlan: user.plan,
    });
  }
  if (
    plan.transactionsLimit !== -1 &&
    user.transactionsUsed >= plan.transactionsLimit
  ) {
    return res.status(403).json({
      error: `Limite mensal de ${plan.transactionsLimit} transações atingido.`,
      upgrade: true,
      currentPlan: user.plan,
      limit: plan.transactionsLimit,
      used: user.transactionsUsed,
    });
  }
  if (plan.categoriesLimit !== 999) {
    const distinctCats = await prisma.transaction.findMany({
      where: { userId: user.id },
      select: { category: true },
      distinct: ["category"],
    });
    const existingCats = new Set(distinctCats.map((c) => c.category));
    if (
      !existingCats.has(data.category) &&
      existingCats.size >= plan.categoriesLimit
    ) {
      return res.status(403).json({
        error: `Plano ${plan.name} permite até ${plan.categoriesLimit} categorias.`,
        upgrade: true,
      });
    }
  }

  try {
    if (data.installments > 1 && data.type === "EXPENSE") {
      const response = await buildInstallmentSchedule(user, {
        description: data.title,
        totalAmount: data.amount * data.installments,
        installments: data.installments,
        dueDay: new Date(data.date).getDate(),
        startDate: data.date,
        category: data.category,
        paymentMethod: data.paymentMethod,
        note: data.description,
        accountId: data.accountId,
        cardId: data.cardId,
      });
      return res.json(response.transactions);
    }

    // Pausa de 24h pra compra por impulso: only worth asking about on
    // expenses that are unusually large for THIS user — comparing against a
    // flat threshold would either spam frugal users or never trigger for
    // big spenders. 2.5x their own historical average, floored at R$150 so
    // it doesn't fire on someone whose average is near zero.
    let flaggedImpulse = false;
    if (data.type === "EXPENSE" && data.plannedPurchase === false) {
      const agg = await prisma.transaction.aggregate({
        where: { userId: user.id, type: "EXPENSE" },
        _avg: { amount: true },
      });
      const threshold = Math.max(150, (agg._avg.amount || 0) * 2.5);
      flaggedImpulse = data.amount >= threshold;
    }

    // Alerta de gasto anômalo: outlier estatístico dentro da própria
    // categoria do usuário (ver anomalyDetectionService) — não é "compra
    // grande", é "compra fora do padrão dessa categoria específica".
    const flaggedAnomaly =
      data.type === "EXPENSE" && (await isAnomalousExpense(user.id, data.category, data.amount));

    const { plannedPurchase, ...transactionData } = data;
    const transaction = await prisma.transaction.create({
      data: {
        ...transactionData,
        id: uuidv4(),
        userId: user.id,
        dueDate: data.dueDate ?? null,
        flaggedImpulse,
        flaggedAnomaly,
      },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { transactionsUsed: { increment: 1 } },
    });

    // Round-up ("arredondamento"): sweep the difference to the next whole
    // real into the user's chosen goal. Fire-and-forget — never let this
    // side effect slow down or fail the actual transaction creation.
    if (data.type === "EXPENSE" && user.roundUpEnabled && user.roundUpGoalId) {
      const roundUp = Number((Math.ceil(data.amount) - data.amount).toFixed(2));
      if (roundUp > 0) {
        prisma.goal
          .update({ where: { id: user.roundUpGoalId }, data: { currentAmount: { increment: roundUp } } })
          .catch((err) => console.error("[ROUNDUP] Falha ao aplicar arredondamento:", err));
      }
    }

    // Gasto anômalo: avisa na hora (não espera o job do dia seguinte como o
    // de impulso) — pode ser cartão clonado ou erro de digitação, então
    // quanto antes o usuário vir, melhor.
    if (flaggedAnomaly) {
      sendPushToUser(user.id, {
        title: "Gasto fora do padrão",
        body: `"${transaction.title}" (R$ ${transaction.amount.toFixed(2)}) é bem diferente do que você costuma gastar em ${transaction.category}.`,
        url: "/app/transactions?review=anomaly",
      }).catch(() => {});
      dispatchWebhook(user.id, "alert.anomaly_detected", {
        title: "Gasto anômalo detectado",
        amount: transaction.amount,
        category: transaction.category,
      });
    }

    // If this is a credit-card charge, create a FinancialAlert for the user
    try {
      if (data.paymentMethod === "credito") {
        await prisma.financialAlert.create({
          data: {
            id: uuidv4(),
            userId: user.id,
            installmentId: transaction.installmentId || null,
            title: `Cobrança no cartão: ${transaction.title}`,
            description: transaction.description || null,
            type: "installment",
            severity: "warning",
            amount: transaction.amount,
            daysUntilDue: transaction.dueDate
              ? diffDays(new Date(transaction.dueDate), new Date())
              : null,
            dueDate: transaction.dueDate || null,
          },
        });
      }
    } catch (err: any) {
      console.error("Failed to create credit card alert:", err);
    }

    // Alerta de limite do cartão: cruza 80/90/100% da fatura atual. Checa se
    // já existe um alerta igual pra essa fatura antes de duplicar.
    if (data.cardId) {
      checkCardLimitAlert(user.id, data.cardId).catch((err) =>
        console.error("[CARD LIMIT] Falha ao checar limite:", err),
      );
    }

    dispatchWebhook(user.id, "transaction.created", {
      id: transaction.id,
      title: transaction.title,
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category,
    });
    res.json(transaction);
  } catch (err: any) {
    console.error("Transaction creation error:", err);
    if (err.message?.includes("Limite mensal"))
      return res.status(403).json({ error: err.message, upgrade: true });
    throw err;
  }
});

router.put("/api/transactions/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  // plannedPurchase is a request-only flag (see POST) — it isn't a column,
  // so passing it through makes Prisma reject the whole update.
  const { plannedPurchase, ...data } = transactionSchema.parse(req.body);
  const transaction = await prisma.transaction.updateMany({
    where: { id: String(req.params.id), userId: user.id },
    data,
  });
  if (transaction.count === 0)
    return res.status(404).json({ error: "Transação não encontrada" });
  const updated = await prisma.transaction.findUnique({
    where: { id: String(req.params.id) },
  });
  res.json(updated);
});

router.delete("/api/transactions/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const { deleteGroup } = req.query;
  if (deleteGroup === "true") {
    const tx = await prisma.transaction.findUnique({
      where: { id: String(req.params.id) },
    });
    if (tx?.installmentId) {
      await prisma.transaction.deleteMany({
        where: { installmentId: tx.installmentId, userId: user.id },
      });
      await prisma.installment.deleteMany({
        where: { id: tx.installmentId, userId: user.id },
      });
      return res.json({ ok: true });
    }
  }
  const deleted = await prisma.transaction.deleteMany({
    where: { id: String(req.params.id), userId: user.id },
  });
  if (deleted.count === 0)
    return res.status(404).json({ error: "Transação não encontrada" });
  res.json({ ok: true });
});

router.get("/api/installments", authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const installments = await prisma.installment.findMany({
      where: { userId: user.id },
      orderBy: { startDate: "desc" },
      include: { transactions: true },
    });
    const now = new Date();
    const result = installments.map((inst) => {
      const nextTransaction = inst.transactions
        .filter((t) => new Date(t.date) >= now)
        .sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        )[0];
      const paid = inst.transactions.filter(
        (t) => new Date(t.date) < now,
      ).length;
      return {
        ...inst,
        nextDueDate: nextTransaction?.date || null,
        paidInstallments: paid,
        remainingInstallments: inst.numberOfParcels - paid,
      };
    });
    res.json(result);
  } catch (err: any) {
    console.error("Installments error:", err);
    res.status(500).json({ error: "Erro ao carregar parcelamentos" });
  }
});

// ============================================================================
// PAUSA DE 24H PRA COMPRA POR IMPULSO
// ============================================================================
// Impulso (não planejada) e anomalia (fora do padrão da categoria) são
// motivos diferentes, mas resolvem com a mesma ação — o usuário olha de
// novo e confirma — então dividem a mesma fila de revisão e o mesmo
// endpoint de dispensa (POST /:id/reflect).
router.get("/api/transactions/impulse-review", authenticate, async (req, res) => {
  const user = (req as any).user;
  const items = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      reflectedAt: null,
      OR: [{ flaggedImpulse: true }, { flaggedAnomaly: true }],
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(
    items.map((t) => ({ ...t, reviewReason: t.flaggedImpulse ? "impulse" : "anomaly" })),
  );
});

router.post("/api/transactions/:id/reflect", authenticate, async (req, res) => {
  const user = (req as any).user;
  const updated = await prisma.transaction.updateMany({
    where: { id: String(req.params.id), userId: user.id },
    data: { reflectedAt: new Date() },
  });
  if (updated.count === 0) return res.status(404).json({ error: "Transação não encontrada" });
  res.json({ ok: true });
});

// ============================================================================
// COMPROVANTE DE TRANSAÇÃO
// ============================================================================
router.post("/api/transactions/:id/receipt", authenticate, upload.single("file"), async (req, res) => {
  const user = (req as any).user;
  if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });
  const transaction = await prisma.transaction.findFirst({ where: { id: String(req.params.id), userId: user.id } });
  if (!transaction) return res.status(404).json({ error: "Transação não encontrada" });

  const imageData = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
  const receipt = await prisma.transactionReceipt.upsert({
    where: { transactionId: transaction.id },
    create: { transactionId: transaction.id, userId: user.id, imageData },
    update: { imageData },
  });
  res.status(201).json({ id: receipt.id });
});

router.get("/api/transactions/:id/receipt", authenticate, async (req, res) => {
  const user = (req as any).user;
  const receipt = await prisma.transactionReceipt.findFirst({
    where: { transactionId: String(req.params.id), userId: user.id },
  });
  if (!receipt) return res.status(404).json({ error: "Sem comprovante" });
  res.json({ imageData: receipt.imageData });
});

router.delete("/api/transactions/:id/receipt", authenticate, async (req, res) => {
  const user = (req as any).user;
  await prisma.transactionReceipt.deleteMany({ where: { transactionId: String(req.params.id), userId: user.id } });
  res.json({ ok: true });
});

export default router;
