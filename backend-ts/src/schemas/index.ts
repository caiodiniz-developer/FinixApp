import { z } from "zod";

// ============================================================================
// SCHEMAS
// ============================================================================
export const transactionSchema = z.object({
  title: z.string().min(1).max(120),
  amount: z.number().positive(),
  type: z.enum(["INCOME", "EXPENSE"]),
  category: z.string(),
  description: z.string().optional(),
  date: z.string().transform((str) => new Date(str)),
  recurring: z.boolean().optional().default(false),
  recurringFrequency: z
    .enum(["monthly", "weekly", "yearly"])
    .optional()
    .nullable(),
  paymentMethod: z.enum(["credito", "debito", "pix"]).optional().default("pix"),
  installments: z.number().min(1).max(60).optional().default(1),
  currency: z.enum(["BRL", "USD", "EUR", "GBP"]).optional().default("BRL"),
  accountId: z.string().optional().nullable(),
  cardId: z.string().optional().nullable(),
  dueDate: z
    .string()
    .nullable()
    .optional()
    .transform((s) => (s ? new Date(s) : null)),
  client: z.string().max(80).optional().nullable(),
  // Pausa de 24h pra compra por impulso: omitted/true = normal; explicit
  // `false` means the user said "não" to "essa compra foi planejada?".
  plannedPurchase: z.boolean().optional().default(true),
});

export const installmentSchema = z.object({
  description: z.string().min(1).max(120),
  totalAmount: z.number().positive(),
  installments: z.number().min(2).max(60),
  dueDay: z.number().min(1).max(31),
  startDate: z.string().transform((str) => new Date(str)),
  category: z.string().optional().default("Cartão de Crédito"),
  paymentMethod: z
    .enum(["credito", "debito", "pix"])
    .optional()
    .default("credito"),
  note: z.string().optional(),
});

export const goalSchema = z.object({
  title: z.string().min(1).max(120),
  targetAmount: z.number().positive(),
  currentAmount: z.number().min(0).optional().default(0),
  deadline: z.string().transform((str) => new Date(str)),
});

export const budgetSchema = z.object({
  category: z.string(),
  limit: z.number().positive(),
});

export const accountSchema = z.object({
  name: z.string().min(1).max(80),
  type: z
    .enum(["corrente", "poupanca", "carteira", "investimento"])
    .optional()
    .default("corrente"),
  color: z.string().optional(),
  isDefault: z.boolean().optional().default(false),
});

export const creditCardSchema = z.object({
  name: z.string().min(1).max(80),
  brand: z.string().optional().nullable(),
  limit: z.number().min(0).optional().default(0),
  closingDay: z.number().min(1).max(31),
  dueDay: z.number().min(1).max(31),
  color: z.string().optional(),
});

export const contactSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  color: z.string().optional(),
});

export const splitExpenseCreateSchema = z.object({
  splits: z
    .array(
      z.object({
        contactId: z.string(),
        amount: z.number().positive(),
      }),
    )
    .min(1),
});

export const profileUpdateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).max(128).optional(),
  photo: z.string().optional(),
});

export const categoriesUpdateSchema = z.object({
  categories: z.array(z.string().min(1).max(50)).min(1),
});

export const categorySchema = z.object({
  name: z.string().min(1).max(60),
  icon: z.string().optional(),
  color: z.string().optional(),
  type: z.enum(["income", "expense", "both"]).optional().default("expense"),
  isActive: z.boolean().optional().default(true),
});

export const categoryUpdateSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  type: z.enum(["income", "expense", "both"]).optional(),
  isActive: z.boolean().optional(),
});

export const userUpdateSchema = z.object({
  name: z.string().optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  blocked: z.boolean().optional(),
  plan: z.enum(["FREE", "BASIC", "PRO", "TEST"]).optional(),
  hasCompletedOnboarding: z.boolean().optional(),
  usageType: z.enum(["pessoal", "empresarial", "organizar"]).optional(),
  companyName: z.string().optional().nullable(),
  companyLogo: z.string().optional().nullable(),
  businessPurpose: z.string().optional().nullable(),
  primaryColor: z.string().optional().nullable(),
  categories: z.array(z.string().min(1).max(50)).optional(),
});

export const onboardingSchema = z.object({
  usageType: z.enum(["pessoal", "empresarial", "organizar"]),
  companyName: z.string().nullable().optional(),
  companyLogo: z.string().nullable().optional(),
  businessPurpose: z.string().nullable().optional(),
  primaryColor: z.string().nullable().optional(),
  categories: z.array(z.string().min(1).max(50)).min(1),
});
