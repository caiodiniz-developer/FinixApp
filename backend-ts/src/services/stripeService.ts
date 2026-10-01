import Stripe from "stripe";
import { prisma } from "../lib/prisma";
import { PLANS } from "../config/plans";

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-04-22.dahlia" as any,
    })
  : null;

const oneMonthFromNow = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d;
};

// Minimal shapes of the Stripe objects the webhooks hand us — only the fields
// read here, loose enough to cover both older and newer API versions.
type StripeRef = string | { id: string } | null | undefined;
export interface SubscriptionLike {
  id: string;
  status?: string;
  customer?: StripeRef;
  current_period_end?: number;
  items?: { data?: { current_period_end?: number }[] };
}
export interface CheckoutSessionLike {
  id: string;
  metadata?: Record<string, string> | null;
  payment_intent?: StripeRef;
  subscription?: StripeRef;
  customer?: StripeRef;
}
export interface InvoiceLike {
  customer?: StripeRef;
  subscription?: StripeRef;
  parent?: { subscription_details?: { subscription?: StripeRef } | null } | null;
  lines?: { data?: { period?: { end?: number } }[] };
}

const idOf = (ref: StripeRef): string | null =>
  !ref ? null : typeof ref === "string" ? ref : ref.id;

/**
 * End of the period the customer has already paid for. Older Stripe API
 * versions expose it on the subscription itself, newer ones moved it to each
 * subscription item — read whichever is present.
 */
export const subscriptionPeriodEnd = (subscription: SubscriptionLike): Date | null => {
  const seconds =
    subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end;
  return typeof seconds === "number" ? new Date(seconds * 1000) : null;
};

const fetchPeriodEnd = async (subscriptionId: string | null): Promise<Date | null> => {
  if (!stripe || !subscriptionId) return null;
  try {
    return subscriptionPeriodEnd(
      (await stripe.subscriptions.retrieve(subscriptionId)) as unknown as SubscriptionLike,
    );
  } catch (err: any) {
    console.error("[STRIPE] Falha ao buscar assinatura:", err.message);
    return null;
  }
};

export async function handleCheckoutCompleted(session: CheckoutSessionLike) {
  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan;
  if (!userId || !plan || !PLANS[plan]) {
    console.error("[STRIPE] checkout.session.completed sem metadata válida:", session.id);
    return;
  }
  await prisma.paymentTransaction.updateMany({
    where: { sessionId: session.id },
    data: {
      paymentStatus: "paid",
      status: "completed",
      stripePaymentId: idOf(session.payment_intent) ?? session.id,
    },
  });
  const subscriptionId = idOf(session.subscription);
  const planExpiresAt = (await fetchPeriodEnd(subscriptionId)) ?? oneMonthFromNow();
  // updateMany: a webhook for a since-deleted user must not throw (Stripe
  // would keep retrying it forever).
  await prisma.user.updateMany({
    where: { id: userId },
    data: {
      plan,
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: idOf(session.customer) ?? undefined,
      planExpiresAt,
    },
  });
}

export async function handleInvoicePaymentSucceeded(invoice: InvoiceLike) {
  const customerId = idOf(invoice.customer);
  if (!customerId) return;
  // `invoice.subscription` was moved under `parent.subscription_details` in
  // newer API versions — the webhook endpoint's version decides which one arrives.
  const subscriptionId = idOf(
    invoice.subscription ?? invoice.parent?.subscription_details?.subscription,
  );
  const lineEnd = invoice.lines?.data?.[0]?.period?.end;
  const planExpiresAt =
    (await fetchPeriodEnd(subscriptionId)) ??
    (typeof lineEnd === "number" ? new Date(lineEnd * 1000) : oneMonthFromNow());

  await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: { planExpiresAt, ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}) },
  });
}

export async function handleSubscriptionDeleted(subscription: SubscriptionLike) {
  const customerId = idOf(subscription.customer);
  if (!customerId) return;
  // Only downgrade if this is still the user's current subscription — an old
  // one being cleaned up must not take down a newer active plan.
  await prisma.user.updateMany({
    where: {
      stripeCustomerId: customerId,
      OR: [{ stripeSubscriptionId: subscription.id }, { stripeSubscriptionId: null }],
    },
    data: { plan: "FREE", stripeSubscriptionId: null, planExpiresAt: null },
  });
}

/**
 * Safety net for the plan-expiry check: before treating a paid plan as
 * expired, ask Stripe whether the subscription is really over. If a renewal
 * webhook was lost, this repairs planExpiresAt instead of locking out a
 * customer who is still paying. Returns the date access is valid until, or
 * null when the subscription really ended.
 */
export const reconcileExpiredPlan = async (user: {
  id: string;
  stripeSubscriptionId: string | null;
}): Promise<Date | null> => {
  if (!stripe || !user.stripeSubscriptionId) return null;
  try {
    const subscription = (await stripe.subscriptions.retrieve(
      user.stripeSubscriptionId,
    )) as unknown as SubscriptionLike;
    const periodEnd = subscriptionPeriodEnd(subscription);
    const stillPaying = ["active", "trialing", "past_due"].includes(subscription.status || "");
    if (!stillPaying || !periodEnd || periodEnd.getTime() < Date.now()) return null;
    await prisma.user.updateMany({ where: { id: user.id }, data: { planExpiresAt: periodEnd } });
    return periodEnd;
  } catch (err: any) {
    // Stripe unreachable: fail open for this request rather than punish the user.
    console.error("[STRIPE] Falha ao reconciliar plano expirado:", err.message);
    return new Date();
  }
};
