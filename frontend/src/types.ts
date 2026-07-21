export interface User {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
  blocked: boolean;
  createdAt: string;
  photo?: string;
  plan?: "FREE" | "BASIC" | "PRO";
  transactionsUsed?: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  planExpiresAt?: string | null;
  hasCompletedOnboarding?: boolean;
  usageType?: string;
  companyName?: string;
  companyLogo?: string;
  businessPurpose?: string;
  primaryColor?: string;
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

export interface Goal {
  id: string;
  userId: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  createdAt: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
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
