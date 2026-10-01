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
    name: "🚀 Finix Pro",
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
