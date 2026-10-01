import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middlewares/authenticate";
import { refreshCurrentMonthEstimate, clientBreakdown } from "../services/taxService";
import { compareCltVsPj } from "../services/cltVsPjService";

const router = Router();

router.get("/api/tax/estimate", authenticate, async (req, res) => {
  const user = (req as any).user;
  if (!user.isAutonomous || !user.taxRegime) {
    return res.status(400).json({ error: "Modo Autônomo não está ativado. Configure em /api/settings/autonomous." });
  }
  const current = await refreshCurrentMonthEstimate(user.id);
  const history = await prisma.taxObligation.findMany({
    where: { userId: user.id },
    orderBy: { referenceMonth: "desc" },
    take: 12,
  });
  const clients = current ? await clientBreakdown(user.id, current.referenceMonth) : [];
  res.json({
    current,
    history,
    clients,
    disclaimer:
      "Estimativa de planejamento — confira o valor oficial no app MEI (Portal do Empreendedor) ou no Carnê-Leão da Receita Federal antes de pagar.",
  });
});

router.post("/api/tax/:id/mark-paid", authenticate, async (req, res) => {
  const user = (req as any).user;
  const updated = await prisma.taxObligation.updateMany({
    where: { id: String(req.params.id), userId: user.id },
    data: { paid: true, paidAt: new Date() },
  });
  if (updated.count === 0) return res.status(404).json({ error: "Obrigação não encontrada" });
  res.json({ ok: true });
});

// ============================================================================
// CALCULADORA CLT vs PJ
// ============================================================================
router.post("/api/tax/clt-vs-pj", authenticate, async (req, res) => {
  const data = z
    .object({
      cltGrossSalary: z.number().positive(),
      pjContractedMonthly: z.number().positive(),
      pjTaxRegime: z.enum(["MEI", "CARNE_LEAO"]),
      pjMeiActivity: z.string().optional(),
      pjAccountingFee: z.number().min(0).optional(),
    })
    .parse(req.body);
  const result = compareCltVsPj(data);
  res.json({
    ...result,
    disclaimer: "Estimativa de planejamento — tabelas de INSS/IRRF mudam por decreto, confira os valores vigentes.",
  });
});

export default router;
