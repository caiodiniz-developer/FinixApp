import { describe, expect, it } from "vitest";
import { dayLabel, groupByDay } from "../src/utils/transactionGroups";
import { categoryColor, categoryIcon } from "../src/utils/categoryIcons";

const tx = (date: string, type: "INCOME" | "EXPENSE", amount: number) => ({ date: `${date}T00:00:00.000Z`, type, amount });

describe("groupByDay", () => {
  it("keeps the order, one block per day, with the day's net total", () => {
    const groups = groupByDay(
      [tx("2026-10-02", "EXPENSE", 0.1), tx("2026-10-02", "EXPENSE", 0.2), tx("2026-10-02", "INCOME", 10), tx("2026-10-01", "EXPENSE", 50)],
      "2026-10-02",
    );
    expect(groups.map((g) => g.key)).toEqual(["2026-10-02", "2026-10-01"]);
    expect(groups[0].items).toHaveLength(3);
    // exact to the centavo: 10 - 0.1 - 0.2
    expect(groups[0].total).toBe(9.7);
    expect(groups[1].total).toBe(-50);
  });

  it("names today, yesterday and tomorrow", () => {
    expect(dayLabel("2026-10-02", "2026-10-02")).toBe("Hoje");
    expect(dayLabel("2026-10-01", "2026-10-02")).toBe("Ontem");
    expect(dayLabel("2026-10-03", "2026-10-02")).toBe("Amanhã");
    // across a month boundary
    expect(dayLabel("2026-09-30", "2026-10-01")).toBe("Ontem");
  });

  it("writes other days out, with the year only when it differs", () => {
    expect(dayLabel("2026-09-12", "2026-10-02")).toMatch(/12 de set/);
    expect(dayLabel("2026-09-12", "2026-10-02")).not.toMatch(/2026/);
    expect(dayLabel("2025-12-31", "2026-10-02")).toMatch(/2025/);
  });
});

describe("category icons", () => {
  it("matches custom names, with or without accents", () => {
    expect(categoryIcon("Alimentação")).toBe(categoryIcon("Mercado do mês"));
    expect(categoryIcon("Saúde")).toBe(categoryIcon("saude"));
    expect(categoryIcon("Coisa sem regra")).toBe(categoryIcon(""));
  });

  it("gives an unknown category a stable colour", () => {
    expect(categoryColor("Pet shop")).toBe(categoryColor("Pet shop"));
    expect(categoryColor("Moradia")).toBe("#3B82F6");
  });
});
