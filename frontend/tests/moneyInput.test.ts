import { describe, expect, it } from "vitest";
import { formatMoneyInput, parseMoneyInput } from "../src/components/MoneyInput";

// Intl separates "R$" and the figure with a non-breaking space in some runtimes.
const plain = (s: string) => s.replace(/ /g, " ");

describe("money input", () => {
  it("fills in from the cents as digits are typed", () => {
    expect(parseMoneyInput("1")).toBe(0.01);
    expect(parseMoneyInput("12")).toBe(0.12);
    expect(parseMoneyInput("R$ 1,23")).toBe(1.23);
    expect(parseMoneyInput("R$ 1.234,56")).toBe(1234.56);
  });

  it("is empty when every digit is erased", () => {
    expect(parseMoneyInput("")).toBe("");
    expect(parseMoneyInput("R$ ")).toBe("");
  });

  it("shows amounts the Brazilian way", () => {
    expect(plain(formatMoneyInput(1234.5))).toBe("R$ 1.234,50");
    expect(plain(formatMoneyInput(0.1 + 0.2))).toBe("R$ 0,30");
    expect(formatMoneyInput("")).toBe("");
    expect(formatMoneyInput(undefined)).toBe("");
  });

  it("round-trips what it shows", () => {
    for (const value of [0.01, 9.99, 120.5, 98765.43]) {
      expect(parseMoneyInput(formatMoneyInput(value))).toBe(value);
    }
  });
});
