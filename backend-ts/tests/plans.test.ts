import { describe, expect, it, vi } from "vitest";
import {
  effectivePlanId,
  isInTrial,
  isPlanExpired,
  planFor,
  PLANS,
} from "../src/config/plans";
import { requireFeature } from "../src/middlewares/auth";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-01T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY);
const daysAhead = (n: number) => new Date(now.getTime() + n * DAY);

const user = (
  over: Partial<{ plan: string; planExpiresAt: Date | null; createdAt: Date }> = {},
) => ({
  plan: "FREE",
  planExpiresAt: null,
  createdAt: daysAgo(365),
  ...over,
});

describe("effective plan", () => {
  it("a paid plan inside its period is honoured", () => {
    expect(effectivePlanId(user({ plan: "PRO", planExpiresAt: daysAhead(10) }), now)).toBe("PRO");
  });

  it("a paid plan with no expiry date never expires (admin-granted)", () => {
    expect(effectivePlanId(user({ plan: "BASIC", planExpiresAt: null }), now)).toBe("BASIC");
  });

  it("gives a grace period after the expiry date", () => {
    const u = user({ plan: "PRO", planExpiresAt: daysAgo(2) });
    expect(isPlanExpired(u, now)).toBe(false);
    expect(effectivePlanId(u, now)).toBe("PRO");
  });

  it("falls back to FREE once the grace period is over", () => {
    const u = user({ plan: "PRO", planExpiresAt: daysAgo(4) });
    expect(isPlanExpired(u, now)).toBe(true);
    expect(effectivePlanId(u, now)).toBe("FREE");
    expect(planFor(u, now).canUseTransactions).toBe(false);
  });

  it("an unknown plan id is treated as FREE", () => {
    expect(effectivePlanId(user({ plan: "GOLD" }), now)).toBe("FREE");
  });

  it("a new FREE account gets BASIC limits for 7 days", () => {
    const fresh = user({ createdAt: daysAgo(3) });
    expect(isInTrial(fresh, now)).toBe(true);
    expect(effectivePlanId(fresh, now)).toBe("BASIC");
    expect(planFor(fresh, now).transactionsLimit).toBe(PLANS.BASIC.transactionsLimit);
  });

  it("the trial ends after 7 days", () => {
    const old = user({ createdAt: daysAgo(8) });
    expect(isInTrial(old, now)).toBe(false);
    expect(effectivePlanId(old, now)).toBe("FREE");
  });
});

describe("requireFeature (paywall)", () => {
  const run = (u: ReturnType<typeof user>, feature: "hasExcel" | "canUseCards") => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    requireFeature(feature)({ user: u } as any, res as any, next);
    return { res, next };
  };

  it("lets a PRO user through", () => {
    const { next, res } = run(user({ plan: "PRO" }), "hasExcel");
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("blocks a feature the plan does not include with 403 and the upgrade flag", () => {
    const { next, res } = run(user({ plan: "BASIC" }), "hasExcel");
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ upgrade: true, requiredFeature: "hasExcel" }),
    );
  });

  it("blocks an expired PRO user", () => {
    const expired = user({ plan: "PRO", planExpiresAt: new Date(Date.now() - 30 * DAY) });
    const { next, res } = run(expired, "canUseCards");
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
