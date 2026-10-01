import type { Transaction } from "@prisma/client";

/**
 * Shape of a transaction on the wire. The column is `installmentId`, but the
 * whole frontend groups parcelas by `installmentGroupId` (the name the
 * calendar endpoint always used) — without this alias every installment
 * purchase showed up as N unrelated transactions.
 */
export const toTransactionDto = <T extends Pick<Transaction, "installmentId">>(t: T) => ({
  ...t,
  installmentGroupId: t.installmentId ?? null,
});
