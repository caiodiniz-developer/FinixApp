import { describe, expect, it } from "vitest";
import { planInstallments } from "../src/services/installmentService";
import { sumMoney } from "../src/lib/money";

const iso = (d: Date) => d.toISOString().slice(0, 10);

describe("planInstallments", () => {
  it("creates one parcela per month on the due day", () => {
    const parcels = planInstallments({
      description: "TV",
      totalAmount: 1200,
      installments: 3,
      dueDay: 10,
      startDate: new Date("2026-10-10"),
    });
    expect(parcels.map((p) => iso(p.date))).toEqual(["2026-10-10", "2026-11-10", "2026-12-10"]);
    expect(parcels.map((p) => p.title)).toEqual(["TV • 1/3", "TV • 2/3", "TV • 3/3"]);
    expect(parcels.map((p) => p.amount)).toEqual([400, 400, 400]);
  });

  it("puts the leftover centavos on the last parcela", () => {
    const parcels = planInstallments({
      description: "Sofá",
      totalAmount: 100,
      installments: 3,
      dueDay: 5,
      startDate: new Date("2026-01-05"),
    });
    expect(parcels.map((p) => p.amount)).toEqual([33.33, 33.33, 33.34]);
    expect(sumMoney(parcels.map((p) => p.amount))).toBe(100);
  });

  it("clamps day 31 to the last day of shorter months without skipping any", () => {
    const parcels = planInstallments({
      description: "Notebook",
      totalAmount: 900,
      installments: 4,
      dueDay: 31,
      startDate: new Date("2027-01-31"),
    });
    expect(parcels.map((p) => iso(p.date))).toEqual([
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
      "2027-04-30",
    ]);
  });

  it("rolls over into the next year", () => {
    const parcels = planInstallments({
      description: "Curso",
      totalAmount: 300,
      installments: 3,
      dueDay: 15,
      startDate: new Date("2026-12-15"),
    });
    expect(parcels.map((p) => iso(p.date))).toEqual(["2026-12-15", "2027-01-15", "2027-02-15"]);
  });
});
