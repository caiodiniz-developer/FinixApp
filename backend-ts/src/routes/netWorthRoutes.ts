import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middlewares/authenticate";
import { calculateNetWorth } from "../services/netWorthService";
import { simulateFire } from "../services/fireSimulatorService";

const router = Router();

// ============================================================================
// PATRIMÔNIO LÍQUIDO E INVESTIMENTOS
// ============================================================================
router.get("/api/net-worth", authenticate, async (req, res) => {
  const user = (req as any).user;
  const netWorth = await calculateNetWorth(user.id);
  res.json(netWorth);
});

const investmentSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(["RENDA_FIXA", "ACOES", "FUNDOS_IMOBILIARIOS", "CRIPTO", "TESOURO_DIRETO", "OUTRO"]),
  investedAmount: z.number().min(0),
  currentValue: z.number().min(0),
});

router.get("/api/investments", authenticate, async (req, res) => {
  const user = (req as any).user;
  const investments = await prisma.investment.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  res.json(investments);
});

router.post("/api/investments", authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = investmentSchema.parse(req.body);
  const investment = await prisma.investment.create({ data: { ...data, userId: user.id } });
  res.status(201).json(investment);
});

router.put("/api/investments/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = investmentSchema.partial().parse(req.body);
  const updated = await prisma.investment.updateMany({
    where: { id: String(req.params.id), userId: user.id },
    data,
  });
  if (updated.count === 0) return res.status(404).json({ error: "Investimento não encontrado" });
  res.json({ ok: true });
});

router.delete("/api/investments/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const deleted = await prisma.investment.deleteMany({ where: { id: String(req.params.id), userId: user.id } });
  if (deleted.count === 0) return res.status(404).json({ error: "Investimento não encontrado" });
  res.json({ ok: true });
});

// ============================================================================
// SIMULADOR DE INDEPENDÊNCIA FINANCEIRA (FIRE)
// ============================================================================
router.get("/api/fire-simulation", authenticate, async (req, res) => {
  const user = (req as any).user;
  const desiredMonthlyIncome = req.query.desiredMonthlyIncome ? Number(req.query.desiredMonthlyIncome) : undefined;
  const targetYears = req.query.targetYears ? Number(req.query.targetYears) : undefined;
  const simulation = await simulateFire(user.id, { desiredMonthlyIncome, targetYears });
  res.json(simulation);
});

export default router;
