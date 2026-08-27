import { estimateDasMei, estimateCarneLeao } from "./taxService";

// ⚠️ ESTIMATIVA — mesma ressalva do taxService.ts: tabelas de INSS/IRRF
// mudam por decreto, confira os valores vigentes antes de decidir com base
// nisso. Isto é uma calculadora de planejamento, não uma consultoria.
const INSS_FAIXAS = [
  { ate: 1518.0, aliquota: 0.075 },
  { ate: 2793.88, aliquota: 0.09 },
  { ate: 4190.83, aliquota: 0.12 },
  { ate: 8157.41, aliquota: 0.14 },
];

/** INSS é progressivo por faixa (soma marginal), não "aliquota única sobre o total". */
const calculateInss = (grossSalary: number): number => {
  let remaining = Math.min(grossSalary, INSS_FAIXAS[INSS_FAIXAS.length - 1].ate);
  let total = 0;
  let previousCap = 0;
  for (const faixa of INSS_FAIXAS) {
    const faixaBase = Math.min(remaining, faixa.ate - previousCap);
    if (faixaBase <= 0) break;
    total += faixaBase * faixa.aliquota;
    remaining -= faixaBase;
    previousCap = faixa.ate;
  }
  return Number(total.toFixed(2));
};

export interface CltVsPjResult {
  clt: {
    grossSalary: number;
    inss: number;
    irrf: number;
    netMonthly: number;
    fgtsMonthlyEquivalent: number; // not spendable now, but real value the PJ side doesn't get
    thirteenthAndVacationMonthlyEquivalent: number;
    totalMonthlyEquivalent: number; // netMonthly + benefits spread across 12 months
  };
  pj: {
    contractedMonthly: number;
    taxRegime: "MEI" | "CARNE_LEAO";
    estimatedTax: number;
    accountingFee: number;
    netMonthly: number;
  };
  difference: number; // pj.netMonthly - clt.totalMonthlyEquivalent (positive = PJ compensates more)
  breakEvenAccountingFee: number; // accounting fee at which both sides tie
}

export const compareCltVsPj = (input: {
  cltGrossSalary: number;
  pjContractedMonthly: number;
  pjTaxRegime: "MEI" | "CARNE_LEAO";
  pjMeiActivity?: string;
  pjAccountingFee?: number;
}): CltVsPjResult => {
  const { estimateCarneLeaoIrrf } = { estimateCarneLeaoIrrf: estimateCarneLeao }; // same progressive table as IRRF

  const inss = calculateInss(input.cltGrossSalary);
  const irrfBase = input.cltGrossSalary - inss;
  const irrf = estimateCarneLeaoIrrf(irrfBase); // IRRF uses the same monthly progressive table as Carnê-Leão
  const netMonthly = Number((input.cltGrossSalary - inss - irrf).toFixed(2));
  const fgts = Number((input.cltGrossSalary * 0.08).toFixed(2));
  // 13º (1/12 avo) + férias com 1/3 (1/12 avo), sobre o líquido aproximado
  const thirteenthAndVacation = Number(((netMonthly * (13 / 12) + netMonthly * (1 / 3 / 12)) - netMonthly).toFixed(2));
  const cltTotalEquivalent = Number((netMonthly + thirteenthAndVacation).toFixed(2));

  const accountingFee = input.pjAccountingFee ?? 0;
  const estimatedTax =
    input.pjTaxRegime === "MEI"
      ? estimateDasMei(input.pjMeiActivity || "COMERCIO_SERVICOS")
      : estimateCarneLeao(input.pjContractedMonthly);
  const pjNetMonthly = Number((input.pjContractedMonthly - estimatedTax - accountingFee).toFixed(2));

  const difference = Number((pjNetMonthly - cltTotalEquivalent).toFixed(2));
  const breakEvenAccountingFee = Number((input.pjContractedMonthly - estimatedTax - cltTotalEquivalent).toFixed(2));

  return {
    clt: {
      grossSalary: input.cltGrossSalary,
      inss,
      irrf,
      netMonthly,
      fgtsMonthlyEquivalent: fgts,
      thirteenthAndVacationMonthlyEquivalent: thirteenthAndVacation,
      totalMonthlyEquivalent: cltTotalEquivalent,
    },
    pj: {
      contractedMonthly: input.pjContractedMonthly,
      taxRegime: input.pjTaxRegime,
      estimatedTax,
      accountingFee,
      netMonthly: pjNetMonthly,
    },
    difference,
    breakEvenAccountingFee,
  };
};
