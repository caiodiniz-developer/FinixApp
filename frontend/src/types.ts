export interface User {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  blocked: boolean;
  createdAt: string;
  /** Whether the account has an avatar — fetch the actual data URI from GET /api/auth/photo. */
  hasPhoto?: boolean;
  plan?: "FREE" | "BASIC" | "PRO";
  transactionsUsed?: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  planExpiresAt?: string | null;
  hasCompletedOnboarding?: boolean;
  usageType?: string;
  companyName?: string;
  /** Whether a company logo is set — fetch the actual data URI from GET /api/auth/photo. */
  hasCompanyLogo?: boolean;
  businessPurpose?: string;
  primaryColor?: string;
  twoFactorEnabled?: boolean;
  roundUpEnabled?: boolean;
  roundUpGoalId?: string | null;
  isAutonomous?: boolean;
  taxRegime?: "MEI" | "CARNE_LEAO" | null;
  meiActivity?: "COMERCIO_INDUSTRIA" | "SERVICOS" | "COMERCIO_SERVICOS" | null;
}

export interface Transaction {
  id: string;
  userId: string;
  title: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  category: string;
  description?: string;
  date: string;
  recurring?: boolean;
  recurringFrequency?: "monthly" | "weekly" | "yearly" | null;
  paymentMethod?: "credito" | "debito" | "pix";
  installments?: number;
  installmentNumber?: number;
  installmentGroupId?: string;
  totalInstallments?: number;
  totalAmount?: number;
  currency?: "BRL" | "USD" | "EUR" | "GBP";
  accountId?: string | null;
  cardId?: string | null;
  createdAt: string;
}

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: "corrente" | "poupanca" | "carteira" | "investimento";
  color?: string;
  isDefault: boolean;
  archived: boolean;
  balance: number;
  createdAt: string;
}

export interface CardStatement {
  referenceMonth: string;
  total: number;
  closingDate: string;
  dueDate: string;
  transactionsCount?: number;
  transactions?: Transaction[];
}

export interface CreditCard {
  id: string;
  userId: string;
  name: string;
  brand?: string | null;
  limit: number;
  closingDay: number;
  dueDay: number;
  color?: string;
  archived: boolean;
  currentStatement: CardStatement;
  createdAt: string;
}

export interface Contact {
  id: string;
  userId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  color?: string;
  totalOwed: number;
  createdAt: string;
}

export interface SplitExpense {
  id: string;
  userId: string;
  transactionId: string;
  contactId: string;
  amount: number;
  settled: boolean;
  settledAt?: string | null;
  createdAt: string;
  contact?: Contact;
  transaction?: Transaction;
}

export interface CalendarDay {
  date: string;
  revenue?: number;
  expense?: number;
  net?: number;
  transactions?: Transaction[];
}

export interface CalendarData {
  dailySummary: CalendarDay[];
}

export interface GoalMember {
  id: string;
  goalId: string;
  userId: string;
  role: "owner" | "member";
  joinedAt: string;
  user?: { id: string; name: string; email: string };
}

export interface GoalInvite {
  id: string;
  goalId: string;
  senderId: string;
  receiverEmail: string;
  receiverId?: string | null;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
  goal?: Goal;
  sender?: { id: string; name: string; email: string };
}

export interface Goal {
  id: string;
  userId: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  createdAt: string;
  members?: GoalMember[];
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  icon?: string;
  color?: string;
  type?: "income" | "expense";
  isDefault?: boolean;
  isActive?: boolean;
  createdAt: string;
}

export interface RecurringTransaction {
  id: string;
  userId: string;
  title: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  category: string;
  frequency: "weekly" | "monthly" | "yearly";
  startDate: string;
  nextRunDate: string;
  lastRunDate?: string | null;
  active: boolean;
  accountId?: string | null;
  cardId?: string | null;
  createdAt: string;
}

export interface WebhookSubscription {
  id: string;
  userId: string;
  url: string;
  secret?: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

export interface ApiKeySummary {
  id: string;
  label: string;
  keyPrefix: string;
  lastUsedAt?: string | null;
  createdAt: string;
}

export interface ExternalConnection {
  id: string;
  userId: string;
  provider: string;
  itemId: string;
  status: string;
  institution?: string | null;
  lastSyncedAt?: string | null;
  accounts?: { id: string; name: string; balance: number; currency: string }[];
}

export interface Insight {
  type: "info" | "warning" | "success";
  title: string;
  message: string;
}

export interface DashboardData {
  balance: number;
  income: number;
  expense: number;
  saved: number;
  monthly: { month: string; income: number; expense: number }[];
  categories: { category: string; amount: number }[];
  recent: Transaction[];
  insights: Insight[];
}

export interface Budget {
  id: string;
  userId: string;
  category: string;
  limit: number;
  spent: number;
  percentage: number;
  createdAt: string;
}
