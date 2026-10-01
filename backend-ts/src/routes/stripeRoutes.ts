import { Router } from "express";
import { prisma } from "../lib/prisma";
import { PLANS } from "../config/plans";
import { authenticate } from "../middlewares/auth";
import { userPublic } from "../lib/userPublic";
import { stripe } from "../services/stripeService";
import { FRONTEND_URL } from "../config/env";

const router = Router();

// ============================================================================
// STRIPE
// ============================================================================
router.post("/api/stripe/checkout", authenticate, async (req, res) => {
  if (!stripe) return res.status(500).json({ error: "Stripe não configurado" });
  try {
    const { plan_id } = req.body;
    const user = req.user;
    if (!["BASIC", "PRO", "TEST"].includes(plan_id))
      return res.status(400).json({ error: "Plano inválido" });
    const plan = PLANS[plan_id as keyof typeof PLANS];
    if (!plan) return res.status(400).json({ error: "Plano inválido" });

    if (!plan.stripePriceId) {
      if (plan_id === "TEST") {
        const sessionId = `test-session-${Date.now()}`;
        await prisma.user.update({
          where: { id: user.id },
          data: { plan: "TEST" },
        });
        await prisma.paymentTransaction.create({
          data: {
            userId: user.id,
            userEmail: user.email,
            sessionId,
            amount: plan.price,
            currency: "BRL",
            plan: plan_id,
            paymentStatus: "paid",
            stripePaymentId: sessionId,
          },
        });
        return res.json({
          url: `${FRONTEND_URL}/app/dashboard?success=true&session_id=${sessionId}`,
          sessionId,
        });
      }
      return res.status(400).json({ error: "Plano não configurado no Stripe" });
    }

    let customer;
    if (user.stripeCustomerId) {
      customer = await stripe.customers.retrieve(user.stripeCustomerId);
    } else {
      customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customer.id },
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ["card"],
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${FRONTEND_URL}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/plans?canceled=true`,
      metadata: { userId: user.id, plan: plan_id },
    });

    await prisma.paymentTransaction.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        sessionId: session.id,
        amount: plan.price,
        currency: "BRL",
        plan: plan_id,
        paymentStatus: "pending",
        stripePaymentId: session.id,
      },
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err: any) {
    console.error("Stripe checkout error:", err);
    res.status(500).json({ error: err.message || "Erro ao criar checkout" });
  }
});

router.post("/api/stripe/change-plan", authenticate, async (req, res) => {
  if (!stripe) return res.status(500).json({ error: "Stripe não configurado" });
  const user = req.user;
  const { plan_id } = req.body;
  if (!["BASIC", "PRO"].includes(plan_id))
    return res
      .status(400)
      .json({ error: "Plano inválido para mudança direta." });
  if (plan_id === user.plan)
    return res.status(400).json({ error: "Você já está neste plano." });
  if (!user.stripeSubscriptionId)
    return res.status(400).json({
      error: "Nenhuma assinatura ativa encontrada. Faça upgrade via checkout.",
    });
  const targetPlan = PLANS[plan_id];
  if (!targetPlan?.stripePriceId)
    return res
      .status(400)
      .json({ error: "Plano de destino não configurado no Stripe." });
  try {
    const subscription = await stripe.subscriptions.retrieve(
      user.stripeSubscriptionId,
    );
    const itemId = subscription.items.data[0]?.id;
    if (!itemId)
      return res
        .status(400)
        .json({ error: "Assinatura sem itens encontrada." });
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      items: [{ id: itemId, price: targetPlan.stripePriceId }],
      proration_behavior: "always_invoice",
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { plan: plan_id },
    });
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });
    return res.json({
      message: `Plano alterado para ${targetPlan.name} com sucesso.`,
      user: userPublic(updatedUser),
    });
  } catch (err: any) {
    console.error("Stripe change-plan error:", err);
    return res
      .status(500)
      .json({ error: err.message || "Erro ao alterar plano." });
  }
});

router.post("/api/stripe/cancel-subscription", authenticate, async (req, res) => {
  if (!stripe) return res.status(500).json({ error: "Stripe não configurado" });
  const user = req.user;
  if (!user.stripeSubscriptionId)
    return res
      .status(400)
      .json({ error: "Nenhuma assinatura ativa encontrada para cancelar." });
  try {
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { plan: "FREE", stripeSubscriptionId: null, planExpiresAt: null },
    });
    return res.json({
      message:
        "Assinatura cancelada. Seu plano foi revertido para o plano gratuito.",
    });
  } catch (err: any) {
    console.error("Stripe cancel subscription error:", err);
    return res
      .status(500)
      .json({ error: err.message || "Erro ao cancelar a assinatura" });
  }
});

export default router;
