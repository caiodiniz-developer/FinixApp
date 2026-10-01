import { describe, expect, it } from "vitest";
import { roundMoney, splitMoney, sumMoney, toCents } from "../src/lib/money";

describe("money", () => {
  it("sums without floating point drift", () => {
    expect(0.1 + 0.2).not.toBe(0.3); // the problem being solved
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(sumMoney(Array(1000).fill(0.01))).toBe(10);
  });

  it("treats null/undefined as zero", () => {
    expect(sumMoney([10, null, undefined, 5.5])).toBe(15.5);
    expect(roundMoney(undefined)).toBe(0);
  });

  it("rounds to cents", () => {
    expect(toCents(19.99)).toBe(1999);
    expect(roundMoney(300.98999999999995)).toBe(300.99);
  });

  it("splits a total into parts that add up exactly", () => {
    expect(splitMoney(100, 3)).toEqual([33.33, 33.33, 33.34]);
    expect(sumMoney(splitMoney(100, 3))).toBe(100);
    expect(splitMoney(10, 4)).toEqual([2.5, 2.5, 2.5, 2.5]);
    expect(sumMoney(splitMoney(999.99, 12))).toBe(999.99);
  });
});
