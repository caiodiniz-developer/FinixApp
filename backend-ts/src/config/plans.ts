// ============================================================================
// PLANS CONFIGURATION
// ============================================================================
export const PLANS: Record<
  string,
  {
    id: string;
    name: string;
    description: string;
    price: number;
    currency: string;
    monthlyPrice: number;
    yearlyPrice?: number;
    yearlySavings?: number;
    trialDays?: number;
    transactionsLimit: number;
    categoriesLimit: number;
    goalsLimit: number;
    contactsLimit: number;
    accountsLimit: number;
    cardsLimit: number;
    cardMovementsLimit: number;
    canUseTransactions: boolean;
    canUseCards: boolean;
    canUseReports: boolean;
    canUseAlerts: boolean;
    canEditCategories: boolean;
    canCreateCategories: boolean;
    hasAI: boolean;
    hasAdvancedAI: boolean;
    hasPDF: boolean;
    hasExcel: boolean;
    hasPrioritySupport: boolean;
    hasCalendar: boolean;
    hasInstallments: boolean;
    stripePriceId?: string;
  }
> = {
  FREE: {
    id: "FREE",
    name: "Grátis",
    description: "Trial 7 dias - Acesso apenas à Dashboard básica",
    price: 0,
    currency: "BRL",
    monthlyPrice: 0,
    yearlyPrice: 0,
    yearlySavings: 0,
    trialDays: 7,
    transactionsLimit: 0,
    categoriesLimit: 0,
    goalsLimit: 2,
    contactsLimit: 0,
    accountsLimit: 0,
    cardsLimit: 0,
    cardMovementsLimit: 0,
    canUseTransactions: false,
    canUseCards: false,
    canUseReports: false,
    canUseAlerts: false,
    canEditCategories: false,
    canCreateCategories: false,
    hasAI: false,
    hasAdvancedAI: false,
    hasPDF: false,
    hasExcel: false,
    hasPrioritySupport: false,
    hasCalendar: false,
    hasInstallments: false,
  },
  BASIC: {
    id: "BASIC",
    name: "Finix Básico",
    description:
      "Para profissionais autônomos - R$10/mês (ou R$100/ano com economia de R$20)",
    price: 10,
    currency: "BRL",
    monthlyPrice: 10,
    yearlyPrice: 100,
    yearlySavings: 20,
    transactionsLimit: 500,
    categoriesLimit: 999,
    goalsLimit: 5,
    contactsLimit: 50,
    accountsLimit: 2,
    cardsLimit: 2,
    cardMovementsLimit: 50,
    canUseTransactions: true,
    canUseCards: true,
    canUseReports: true,
    canUseAlerts: true,
    canEditCategories: false,
    canCreateCategories: false,
    hasAI: true,
    hasAdvancedAI: false,
    hasPDF: true,
    hasExcel: false,
    hasPrioritySupport: false,
    hasCalendar: true,
    hasInstallments: true,
    stripePriceId: "price_1TRjBSJjlHCvcKLJki6868NK",
  },
  TEST: {
    id: "TEST",
    name: "Teste",
    description: "Plano de testes com todos os recursos",
    price: 0.01,
    currency: "BRL",
    monthlyPrice: 0.01,
    transactionsLimit: -1,
    categoriesLimit: 999,
    goalsLimit: -1,
    contactsLimit: 999,
    accountsLimit: 999,
    cardsLimit: 999,
    cardMovementsLimit: 999,
    canUseTransactions: true,
    canUseCards: true,
    canUseReports: true,
    canUseAlerts: true,
    canEditCategories: true,
    canCreateCategories: true,
    hasAI: true,
    hasAdvancedAI: true,
    hasPDF: true,
    hasExcel: true,
    hasPrioritySupport: true,
    hasCalendar: true,
    hasInstallments: true,
  },
  PRO: {
    id: "PRO",
    name: "Finix Pro",
    description:
      "Para pequenas empresas - R$35/mês (ou R$350/ano com economia de R$70)",
    price: 35,
    currency: "BRL",
    monthlyPrice: 35,
    yearlyPrice: 350,
    yearlySavings: 70,
    transactionsLimit: -1,
    categoriesLimit: 999,
    goalsLimit: -1,
    contactsLimit: 999,
    accountsLimit: 999,
    cardsLimit: 999,
    cardMovementsLimit: 999,
    canUseTransactions: true,
    canUseCards: true,
    canUseReports: true,
    canUseAlerts: true,
    canEditCategories: true,
    canCreateCategories: true,
    hasAI: true,
    hasAdvancedAI: true,
    hasPDF: true,
    hasExcel: true,
    hasPrioritySupport: true,
    hasCalendar: true,
    hasInstallments: true,
    stripePriceId: "price_1TRjBTJjlHCvcKLJICo0Js1Y",
  },
};

// ============================================================================
// EFFECTIVE PLAN — what the user can actually use right now
// ============================================================================
const DAY_MS = 24 * 60 * 60 * 1000;

// Renewal webhooks can arrive late (Stripe retries failed deliveries for
// days) — don't lock a paying customer out the minute the period turns over.
export const PLAN_EXPIRY_GRACE_MS = 3 * DAY_MS;

export interface PlanSubject {
  plan: string;
  planExpiresAt: Date | null;
  createdAt: Date;
}

// The "7 dias grátis" promised on the landing page: a new FREE account gets
// the limits of this plan for PLANS.FREE.trialDays days, no card needed.
export const TRIAL_PLAN_ID = "BASIC";

export const trialEndsAt = (user: Pick<PlanSubject, "createdAt">): Date =>
  new Date(user.createdAt.getTime() + (PLANS.FREE.trialDays || 0) * DAY_MS);

export const isInTrial = (user: PlanSubject, now: Date = new Date()): boolean =>
  now.getTime() < trialEndsAt(user).getTime();

/** True when a paid plan's paid-for period (plus the grace window) is over. */
export const isPlanExpired = (user: Pick<PlanSubject, "plan" | "planExpiresAt">, now: Date = new Date()): boolean =>
  user.plan !== "FREE" &&
  !!user.planExpiresAt &&
  user.planExpiresAt.getTime() + PLAN_EXPIRY_GRACE_MS < now.getTime();

/**
 * The plan id whose limits apply to this user right now. `user.plan` is what
 * they bought; this is what they're still entitled to — an expired paid plan
 * falls back to FREE, and a FREE account still inside its trial window gets
 * the trial plan. A null planExpiresAt means "no expiry" (e.g. plans granted
 * by an admin).
 */
export const effectivePlanId = (user: PlanSubject, now: Date = new Date()): string => {
  const paid = PLANS[user.plan] && !isPlanExpired(user, now) ? user.plan : "FREE";
  if (paid === "FREE" && isInTrial(user, now)) return TRIAL_PLAN_ID;
  return paid;
};

export const planFor = (user: PlanSubject, now: Date = new Date()) =>
  PLANS[effectivePlanId(user, now)];
