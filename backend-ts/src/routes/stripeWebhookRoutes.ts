import { Router } from "express";
import express from "express";
import { handleCheckoutCompleted, handleInvoicePaymentSucceeded, handleSubscriptionDeleted, stripe } from "../services/stripeService";

const router = Router();

// ============================================================================
// STRIPE WEBHOOK — precisa do body RAW, antes do express.json()
// ============================================================================
router.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!stripe)
      return res.status(500).json({ error: "Stripe não configurado" });
    const sig = req.headers["stripe-signature"] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret!);
    } catch (err: any) {
      console.log("Webhook signature verification failed.", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
    res.json({ received: true });
  },
);

export default router;
