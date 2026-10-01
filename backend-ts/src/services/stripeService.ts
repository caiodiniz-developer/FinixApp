import { prisma } from "../lib/prisma";

import Stripe from "stripe";

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-04-22.dahlia" as any,
    })
  : null;

export async function handleCheckoutCompleted(session: any) {
  const userId = session.metadata.userId;
  const plan = session.metadata.plan;
  await prisma.paymentTransaction.updateMany({
    where: { sessionId: session.id },
    data: {
      paymentStatus: "paid",
      status: "completed",
      stripePaymentId: session.payment_intent,
    },
  });
  const planExpiresAt = new Date();
  planExpiresAt.setMonth(planExpiresAt.getMonth() + 1);
  await prisma.user.update({
    where: { id: userId },
    data: { plan, stripeSubscriptionId: session.subscription, planExpiresAt },
  });
}

export async function handleInvoicePaymentSucceeded(invoice: any) {
  const subscription = await stripe!.subscriptions.retrieve(
    invoice.subscription,
  );
  const customer = await stripe!.customers.retrieve(
    subscription.customer as string,
  );
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: (customer as any).id },
  });
  if (user) {
    const planExpiresAt = new Date();
    planExpiresAt.setMonth(planExpiresAt.getMonth() + 1);
    await prisma.user.update({
      where: { id: user.id },
      data: { planExpiresAt },
    });
  }
}

export async function handleSubscriptionDeleted(subscription: any) {
  const customer = await stripe!.customers.retrieve(subscription.customer);
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: (customer as any).id },
  });
  if (user)
    await prisma.user.update({
      where: { id: user.id },
      data: { plan: "FREE", stripeSubscriptionId: null, planExpiresAt: null },
    });
}
