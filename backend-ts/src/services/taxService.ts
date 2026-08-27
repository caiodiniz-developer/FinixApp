import { prisma } from "../lib/prisma";

// ============================================================================
// ⚠️ ESTIMATIVAS, NÃO CÁLCULO OFICIAL. Os valores abaixo (salário mínimo,
// faixas do Carnê-Leão) mudam por decreto/lei, geralmente uma vez por ano
// (MEI) — e a tabela do Carnê-Leão pode mudar por medida provisória a
// qualquer momento. ATUALIZE estas constantes quando souber do novo valor
// oficial. Nunca use este cálculo como base final de pagamento sem conferir
// no app oficial "MEI" (Portal do Empreendedor) ou no Carnê-Leão da Receita
// Federal — isso aqui é uma ferramenta de planejamento, não uma DAS/DARF
// pronta pra pagar.
// ============================================================================
const SALARIO_MINIMO_REFERENCIA = 1518; // 2025 — confira o valor vigente

const DAS_MEI_ADICIONAL: Record<string, number> = {
  COMERCIO_INDUSTRIA: 1, // ICMS
  SERVICOS: 5, // ISS
  COMERCIO_SERVICOS: 6, // ICMS + ISS
};

export const estimateDasMei = (meiActivity: string): number => {
  const inss = SALARIO_MINIMO_REFERENCIA * 0.05;
  const adicional = DAS_MEI_ADICIONAL[meiActivity] ?? DAS_MEI_ADICIONAL.COMERCIO_SERVICOS;
  return Number((inss + adicional).toFixed(2));
};

// Tabela progressiva mensal do Carnê-Leão (renda de autônomo sem retenção na
// fonte) — faixas de referência, sempre confira a tabela vigente antes de
// gerar o DARF real.
const CARNE_LEAO_FAIXAS = [
  { ate: 2259.2, aliquota: 0, deducao: 0 },
  { ate: 2826.65, aliquota: 0.075, deducao: 169.44 },
  { ate: 3751.05, aliquota: 0.15, deducao: 381.44 },
  { ate: 4664.68, aliquota: 0.225, deducao: 662.77 },
  { ate: Infinity, aliquota: 0.275, deducao: 896.0 },
];

export const estimateCarneLeao = (grossMonthlyIncome: number): number => {
  const faixa = CARNE_LEAO_FAIXAS.find((f) => grossMonthlyIncome <= f.ate) || CARNE_LEAO_FAIXAS[CARNE_LEAO_FAIXAS.length - 1];
  const imposto = grossMonthlyIncome * faixa.aliquota - faixa.deducao;
  return Number(Math.max(0, imposto).toFixed(2));
};

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const dueDateForMonth = (referenceMonth: string, day: number): Date => {
  const [y, m] = referenceMonth.split("-").map(Number);
  // DAS-MEI/Carnê-Leão referentes ao mês M vencem no mês seguinte.
  return new Date(y, m, day);
};

/**
 * Recomputes (or creates) the current month's tax estimate for an autonomous
 * user, based on that month's actual INCOME transactions. Idempotent: calling
 * it again just updates the existing row for the month (upsert on
 * userId+referenceMonth+type), so it's safe to call on every dashboard load.
 */
export const refreshCurrentMonthEstimate = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.isAutonomous || !user.taxRegime) return null;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const referenceMonth = monthKey(now);

  const incomeTx = await prisma.transaction.findMany({
    where: { userId, type: "INCOME", date: { gte: monthStart, lt: monthEnd } },
  });
  const grossIncome = incomeTx.reduce((s, t) => s + t.amount, 0);

  const type = user.taxRegime === "MEI" ? "DAS_MEI" : "CARNE_LEAO";
  const estimatedAmount =
    type === "DAS_MEI" ? estimateDasMei(user.meiActivity || "COMERCIO_SERVICOS") : estimateCarneLeao(grossIncome);
  const dueDay = type === "DAS_MEI" ? 20 : 31; // DAS: dia 20 do mês seguinte · Carnê-Leão: último dia útil (aproximado)

  return prisma.taxObligation.upsert({
    where: { userId_referenceMonth_type: { userId, referenceMonth, type } },
    create: {
      userId,
      referenceMonth,
      type,
      grossIncome,
      estimatedAmount,
      dueDate: dueDateForMonth(referenceMonth, dueDay),
    },
    update: { grossIncome, estimatedAmount },
  });
};

/** Per-client income breakdown for the month, e.g. "Cliente X: R$1.200 (3 lançamentos)". */
export const clientBreakdown = async (userId: string, referenceMonth: string) => {
  const [y, m] = referenceMonth.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  const incomeTx = await prisma.transaction.findMany({
    where: { userId, type: "INCOME", date: { gte: start, lt: end } },
  });
  const byClient = new Map<string, number>();
  for (const t of incomeTx) {
    const key = t.client?.trim() || "Sem cliente identificado";
    byClient.set(key, (byClient.get(key) || 0) + t.amount);
  }
  return Array.from(byClient.entries())
    .map(([client, amount]) => ({ client, amount }))
    .sort((a, b) => b.amount - a.amount);
};
