/**
 * Money helpers. Amounts are stored as floating point, and floats can't
 * represent most decimal fractions exactly (0.1 + 0.2 = 0.30000000000000004),
 * so a long running sum drifts by fractions of a cent. Doing the arithmetic
 * in whole cents and converting back keeps every total exact to the centavo.
 */
export const toCents = (value: number | null | undefined): number =>
  Math.round((value || 0) * 100);

export const fromCents = (cents: number): number => cents / 100;

/** Rounds to 2 decimal places (half away from zero, immune to 1.005 → 1.00). */
export const roundMoney = (value: number | null | undefined): number =>
  fromCents(toCents(value));

/** Exact sum of monetary amounts. */
export const sumMoney = (values: Iterable<number | null | undefined>): number => {
  let cents = 0;
  for (const v of values) cents += toCents(v);
  return fromCents(cents);
};

/**
 * Splits `total` into `parts` instalments that add up to exactly `total`:
 * every instalment gets the floor share and the leftover centavos go to the
 * last one (R$ 100 em 3x → 33,33 + 33,33 + 33,34).
 */
export const splitMoney = (total: number, parts: number): number[] => {
  const totalCents = toCents(total);
  const base = Math.floor(totalCents / parts);
  const result = new Array<number>(parts).fill(base);
  result[parts - 1] += totalCents - base * parts;
  return result.map(fromCents);
};
