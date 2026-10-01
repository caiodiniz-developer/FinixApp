import { describe, expect, it } from "vitest";
import { currency, dateBR, dateISOForInput, todayISO } from "../src/utils/format";
import { activePlan, type User } from "../src/types";

describe("dateBR", () => {
  it("shows a stored calendar date as the same day, whatever the browser timezone", () => {
    // Stored as UTC midnight; in Brazil (UTC-3) a naive conversion shows 30/09.
    expect(dateBR("2026-10-01T00:00:00.000Z")).toBe("01/10/2026");
    expect(dateBR("2026-10-01")).toBe("01/10/2026");
    expect(dateBR("2026-12-31T00:00:00.000Z")).toBe("31/12/2026");
  });
});

describe("date inputs", () => {
  it("todayISO is the local calendar date in YYYY-MM-DD", () => {
    const d = new Date();
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    expect(todayISO()).toBe(expected);
  });

  it("dateISOForInput keeps the stored day and defaults to today", () => {
    expect(dateISOForInput("2026-10-01T00:00:00.000Z")).toBe("2026-10-01");
    expect(dateISOForInput()).toBe(todayISO());
  });
});

describe("currency", () => {
  it("formats in Brazilian reais by default", () => {
    expect(currency(1234.5).replace(/\s/g, " ")).toBe("R$ 1.234,50");
    expect(currency(0).replace(/\s/g, " ")).toBe("R$ 0,00");
  });
});

describe("activePlan", () => {
  const user = (over: Partial<User>) => ({ plan: "FREE", ...over }) as User;

  it("prefers the effective plan sent by the API", () => {
    expect(activePlan(user({ plan: "FREE", effectivePlan: "BASIC" }))).toBe("BASIC"); // trial
    expect(activePlan(user({ plan: "PRO", effectivePlan: "FREE" }))).toBe("FREE"); // expired
  });

  it("falls back to the purchased plan, then to FREE", () => {
    expect(activePlan(user({ plan: "PRO" }))).toBe("PRO");
    expect(activePlan(null)).toBe("FREE");
  });
});
