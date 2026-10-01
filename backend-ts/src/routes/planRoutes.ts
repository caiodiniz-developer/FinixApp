import { Router } from "express";
import { PLANS, planFor, effectivePlanId } from "../config/plans";
import { authenticate } from "../middlewares/auth";

const router = Router();

router.get("/api/plans", (_req, res) => res.json(Object.values(PLANS)));

router.get("/api/plans/me", authenticate, (req, res) => {
  const user = req.user;
  const plan = planFor(user);
  res.json({
    plan: user.plan,
    effectivePlan: effectivePlanId(user),
    planDetails: plan,
    transactionsUsed: user.transactionsUsed,
    transactionsMonth: user.transactionsMonth,
    stripeSubscriptionId: user.stripeSubscriptionId,
    planExpiresAt: user.planExpiresAt,
  });
});

export default router;
