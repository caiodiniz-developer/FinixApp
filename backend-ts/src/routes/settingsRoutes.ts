import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middlewares/authenticate";

const router = Router();

// ============================================================================
// ROUND-UP ("ARREDONDAMENTO") E MODO AUTÔNOMO/MEI — configurações
// ============================================================================
router.put("/api/settings/roundup", authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = z
    .object({ enabled: z.boolean(), goalId: z.string().nullable().optional() })
    .parse(req.body);
  await prisma.user.update({
    where: { id: user.id },
    data: { roundUpEnabled: data.enabled, roundUpGoalId: data.enabled ? data.goalId : null },
  });
  res.json({ ok: true });
});

router.put("/api/settings/autonomous", authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = z
    .object({
      isAutonomous: z.boolean(),
      taxRegime: z.enum(["MEI", "CARNE_LEAO"]).nullable().optional(),
      meiActivity: z.enum(["COMERCIO_INDUSTRIA", "SERVICOS", "COMERCIO_SERVICOS"]).nullable().optional(),
    })
    .parse(req.body);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      isAutonomous: data.isAutonomous,
      taxRegime: data.isAutonomous ? data.taxRegime : null,
      meiActivity: data.isAutonomous ? data.meiActivity : null,
    },
  });
  res.json({ ok: true });
});

export default router;
