import { beforeEach, describe, expect, it, vi } from "vitest";

// The handlers only talk to the database through these three calls.
const db = vi.hoisted(() => ({
  userUpdateMany: vi.fn().mockResolvedValue({ count: 1 }),
  paymentUpdateMany: vi.fn().mockResolvedValue({ count: 1 }),
}));

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    user: { updateMany: db.userUpdateMany },
    paymentTransaction: { updateMany: db.paymentUpdateMany },
  },
}));

import {
  handleCheckoutCompleted,
  handleInvoicePaymentSucceeded,
  handleSubscriptionDeleted,
  subscriptionPeriodEnd,
} from "../src/services/stripeService";

beforeEach(() => {
  db.userUpdateMany.mockClear();
  db.paymentUpdateMany.mockClear();
});

describe("subscriptionPeriodEnd", () => {
  it("reads the period end from the subscription (older API versions)", () => {
    expect(subscriptionPeriodEnd({ id: "sub_1", current_period_end: 1790000000 })).toEqual(
      new Date(1790000000 * 1000),
    );
  });

  it("reads it from the first item (newer API versions)", () => {
    expect(
      subscriptionPeriodEnd({ id: "sub_1", items: { data: [{ current_period_end: 1790000000 }] } }),
    ).toEqual(new Date(1790000000 * 1000));
  });

  it("returns null when neither is present", () => {
    expect(subscriptionPeriodEnd({ id: "sub_1" })).toBeNull();
  });
});

describe("checkout.session.completed", () => {
  it("activates the plan from the session metadata and marks the payment as paid", async () => {
    await handleCheckoutCompleted({
      id: "cs_1",
      metadata: { userId: "user-1", plan: "PRO" },
      payment_intent: "pi_1",
      subscription: "sub_1",
      customer: "cus_1",
    });

    expect(db.paymentUpdateMany).toHaveBeenCalledWith({
      where: { sessionId: "cs_1" },
      data: { paymentStatus: "paid", status: "completed", stripePaymentId: "pi_1" },
    });
    expect(db.userUpdateMany).toHaveBeenCalledOnce();
    const call = db.userUpdateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: "user-1" });
    expect(call.data).toMatchObject({
      plan: "PRO",
      stripeSubscriptionId: "sub_1",
      stripeCustomerId: "cus_1",
    });
    expect(call.data.planExpiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("ignores a session without valid metadata instead of granting a plan", async () => {
    await handleCheckoutCompleted({ id: "cs_2", metadata: { userId: "user-1", plan: "GOLD" } });
    await handleCheckoutCompleted({ id: "cs_3", metadata: null });
    expect(db.userUpdateMany).not.toHaveBeenCalled();
    expect(db.paymentUpdateMany).not.toHaveBeenCalled();
  });
});

describe("invoice.payment_succeeded (renewal)", () => {
  it("extends the plan to the end of the paid period", async () => {
    await handleInvoicePaymentSucceeded({
      customer: "cus_1",
      subscription: "sub_1",
      lines: { data: [{ period: { end: 1790000000 } }] },
    });
    expect(db.userUpdateMany).toHaveBeenCalledWith({
      where: { stripeCustomerId: "cus_1" },
      data: { planExpiresAt: new Date(1790000000 * 1000), stripeSubscriptionId: "sub_1" },
    });
  });

  it("finds the subscription in the newer payload shape", async () => {
    await handleInvoicePaymentSucceeded({
      customer: { id: "cus_1" },
      parent: { subscription_details: { subscription: "sub_9" } },
      lines: { data: [{ period: { end: 1790000000 } }] },
    });
    expect(db.userUpdateMany.mock.calls[0][0].data.stripeSubscriptionId).toBe("sub_9");
  });

  it("does nothing for an invoice with no customer", async () => {
    await handleInvoicePaymentSucceeded({});
    expect(db.userUpdateMany).not.toHaveBeenCalled();
  });
});

describe("customer.subscription.deleted", () => {
  it("downgrades to FREE only the user still on that subscription", async () => {
    await handleSubscriptionDeleted({ id: "sub_1", customer: "cus_1" });
    expect(db.userUpdateMany).toHaveBeenCalledWith({
      where: {
        stripeCustomerId: "cus_1",
        OR: [{ stripeSubscriptionId: "sub_1" }, { stripeSubscriptionId: null }],
      },
      data: { plan: "FREE", stripeSubscriptionId: null, planExpiresAt: null },
    });
  });
});
