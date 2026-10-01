import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/httpError";

interface OwnedRefs {
  accountId?: string | null;
  cardId?: string | null;
  contactId?: string | null;
  goalId?: string | null;
}

/**
 * Ids arriving in a request body are just strings — nothing guarantees they
 * point at rows of the logged-in user. Linking a transaction to someone
 * else's card (or sweeping round-ups into someone else's goal) would leak or
 * alter another account's data, so every referenced row is checked here
 * before it is written.
 */
export const assertOwnedRefs = async (userId: string, refs: OwnedRefs): Promise<void> => {
  const checks: Promise<void>[] = [];
  const fail = (what: string) => {
    throw new HttpError(400, `${what} não encontrado(a)`);
  };

  if (refs.accountId) {
    checks.push(
      prisma.account
        .count({ where: { id: refs.accountId, userId } })
        .then((n) => (n ? undefined : fail("Conta"))),
    );
  }
  if (refs.cardId) {
    checks.push(
      prisma.creditCard
        .count({ where: { id: refs.cardId, userId } })
        .then((n) => (n ? undefined : fail("Cartão"))),
    );
  }
  if (refs.contactId) {
    checks.push(
      prisma.contact
        .count({ where: { id: refs.contactId, userId } })
        .then((n) => (n ? undefined : fail("Contato"))),
    );
  }
  if (refs.goalId) {
    // Goals can be shared: the owner and accepted members may both use them.
    checks.push(
      prisma.goal
        .count({
          where: { id: refs.goalId, OR: [{ userId }, { members: { some: { userId } } }] },
        })
        .then((n) => (n ? undefined : fail("Meta"))),
    );
  }
  await Promise.all(checks);
};
