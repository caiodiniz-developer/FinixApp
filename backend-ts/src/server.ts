import express from "express";
import helmet from "helmet";
import cors from "cors";
import "express-async-errors";
import crypto from "crypto";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { prisma } from "./lib/prisma";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
import { z } from "zod";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import Stripe from "stripe";
import authRoutes from "./routes/authRoutes";
import googleRoutes from "./routes/googleRoutes";
import twoFactorRoutes from "./routes/twoFactorRoutes";
import { authRateLimit } from "./middlewares/rateLimit";
import { dispatchWebhook, generateWebhookSecret } from "./services/webhookService";
import { sendPushToUser, getVapidPublicKey, isPushConfigured } from "./services/pushService";
import { runDueRecurringTransactions, computeNextRunDate } from "./services/recurringService";
import { sendDueAlertNotifications } from "./services/alertNotificationService";
import { transactionsToCsv, parseCsvTransactions } from "./services/csvService";
import { transactionsToOfx, parseOfxTransactions } from "./services/ofxService";
import * as openFinance from "./services/openFinanceService";
import { buildForecast } from "./services/forecastService";
import { detectZombieSubscriptions, normalizeTitle, buildSignature } from "./services/subscriptionDetectorService";
import { estimateDasMei, estimateCarneLeao, refreshCurrentMonthEstimate, clientBreakdown } from "./services/taxService";
import { prioritizeDebts, simulatePayoff } from "./services/debtService";
import { sendDueImpulseReflections } from "./services/impulseReflectionService";
import { calculateNetWorth } from "./services/netWorthService";
import { simulateFire } from "./services/fireSimulatorService";
import { compareCltVsPj } from "./services/cltVsPjService";
import { isAnomalousExpense } from "./services/anomalyDetectionService";
import { buildYearReview } from "./services/yearReviewService";
import { buildHouseholdSummary } from "./services/householdService";

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.warn("WARNING: DATABASE_URL is not set. Configure your .env file.");
}

// JWT_SECRET signs every access token AND gates the /internal/* routes (via
// x-internal-secret). A missing or well-known default value means anyone can
// forge a token for any user — including admin — with zero credentials.
// Refuse to boot in production rather than silently running wide open.
const WEAK_JWT_SECRETS = new Set(["finix-dev-secret", "changeme", "secret", "dev-secret", ""]);
if (
  process.env.NODE_ENV === "production" &&
  (!process.env.JWT_SECRET || WEAK_JWT_SECRETS.has(process.env.JWT_SECRET))
) {
  console.error(
    "[FATAL] JWT_SECRET não está definido ou está usando um valor padrão inseguro. " +
      "Defina uma variável de ambiente JWT_SECRET forte e aleatória (ex: `openssl rand -hex 48`) antes de rodar em produção.",
  );
  process.exit(1);
}

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-04-22.dahlia" as any,
    })
  : null;

const JWT_SECRET = process.env.JWT_SECRET || "finix-dev-secret";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://finixapp.vercel.app";

const allowedOrigins = [
  "https://finixapp.vercel.app",
  "https://finixapp.com.br",
  "https://www.finixapp.com.br",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

// ============================================================================
// CORS — deve vir ANTES de qualquer rota
// ============================================================================
const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    // Permite requisições sem origin (mobile, Insomnia, Postman)
    if (!origin) return callback(null, true);
    const isAllowed =
      allowedOrigins.includes(origin) || origin.endsWith(".vercel.app");
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Origin bloqueada: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "stripe-signature"],
  exposedHeaders: ["Content-Range", "X-Content-Range"],
  maxAge: 86400,
};

// JSON API, not an HTML page — disable the HTML-oriented CSP directives and
// relax cross-origin-resource-policy so the Vercel-hosted frontend (a
// different origin) can actually consume the responses.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// FIX 1: aplica cors() globalmente
app.use(cors(corsOptions));
app.use(cookieParser());

// FIX 2: responde imediatamente a todo preflight OPTIONS
// Sem isso, o browser recebe 404 no preflight e bloqueia a requisição real.
app.options("*", cors(corsOptions));

// ============================================================================
// STRIPE WEBHOOK — precisa do body RAW, antes do express.json()
// ============================================================================
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!stripe)
      return res.status(500).json({ error: "Stripe não configurado" });
    const sig = req.headers["stripe-signature"] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret!);
    } catch (err: any) {
      console.log("Webhook signature verification failed.", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
    res.json({ received: true });
  },
);

app.use(express.json({ limit: "10mb" }));

// ============================================================================
// HEALTH CHECK
// ============================================================================
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

app.get("/", (_req, res) => {
  res.json({
    name: "Finix API",
    version: "1.0.0",
    status: "running",
    endpoints: { auth: "/api/auth/login", health: "/health" },
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/2fa", twoFactorRoutes);
app.use("/google", googleRoutes);

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

const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const resetMonthlyIfNeeded = async (userId: string, currentMonth: string) => {
  const mk = currentMonthKey();
  if (currentMonth !== mk) {
    await prisma.user.update({
      where: { id: userId },
      data: { transactionsUsed: 0, transactionsMonth: mk },
    });
    return 0;
  }
  return null;
};

// ============================================================================
// MIDDLEWARE
// ============================================================================
// Accepts either a JWT bearer token (normal frontend session) or an
// `X-Api-Key` header (external integrations — Zapier, scripts, spreadsheets;
// see POST /api/api-keys). Both paths converge on the same `req.user`, so
// every route below works unmodified with either credential.
const authenticateApiKey = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  const rawKey = req.headers["x-api-key"] as string | undefined;
  if (!rawKey) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  try {
    const fingerprint = crypto.createHash("sha256").update(rawKey).digest("hex");
    const apiKey = await prisma.apiKey.findUnique({ where: { keyFingerprint: fingerprint } });
    if (!apiKey || !(await bcrypt.compare(rawKey, apiKey.keyHash))) {
      res.status(401).json({ error: "API key inválida" });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: apiKey.userId },
      omit: { photo: true, companyLogo: true },
    });
    if (!user || user.blocked) {
      res.status(401).json({ error: "Usuário não encontrado ou bloqueado" });
      return;
    }
    prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
    (req as any).user = user;
    (req as any).authMethod = "apikey";
    next();
  } catch {
    res.status(401).json({ error: "API key inválida" });
  }
};

const authenticate = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  if (req.headers["x-api-key"]) {
    return authenticateApiKey(req, res, next);
  }
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  const token = auth.substring(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    // This runs on nearly every request in the app — never fetch
    // photo/companyLogo here (can be multi-MB base64 data URIs). The one
    // route that needs the real image (GET /api/auth/photo) fetches it
    // itself with an explicit `select`, on demand.
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      omit: { photo: true, companyLogo: true },
    });
    if (!user || user.blocked) {
      return res
        .status(401)
        .json({ error: "Usuário não encontrado ou bloqueado" });
    }
    const reset = await resetMonthlyIfNeeded(user.id, user.transactionsMonth);
    if (reset !== null) {
      user.transactionsUsed = 0;
      user.transactionsMonth = currentMonthKey();
    }
    (req as any).user = user;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
};

const requireAdmin = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const user = (req as any).user;
  if (user.role !== "ADMIN") {
    return res.status(403).json({ error: "Acesso negado (admin)" });
  }
  next();
};

type PlanFeature =
  | "hasAI"
  | "hasAdvancedAI"
  | "hasPDF"
  | "hasExcel"
  | "hasCalendar"
  | "canUseTransactions"
  | "canUseCards"
  | "canUseReports"
  | "canUseAlerts";

const requireFeature =
  (feature: PlanFeature) =>
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = (req as any).user;
    const plan = PLANS[user.plan] || PLANS.FREE;
    if (!plan[feature]) {
      return res.status(403).json({
        error: "Recurso não disponível no seu plano",
        requiredFeature: feature,
        currentPlan: user.plan,
        upgrade: true,
      });
    }
    next();
  };

// ============================================================================
// SCHEMAS
// ============================================================================
const transactionSchema = z.object({
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

const installmentSchema = z.object({
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

const getSafeDueDay = (year: number, month: number, day: number) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Math.min(day, daysInMonth);
};

const diffDays = (dateA: Date, dateB: Date) => {
  const a = new Date(dateA);
  const b = new Date(dateB);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
};

const toLocalDateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// A card's "fatura" is a rolling window that closes on `closingDay` of each
// month and opens the day after the previous closing — computed on read from
// Transaction rows, never stored, same philosophy as budgets' `spent`.
const cardStatementWindow = (closingDay: number, year: number, month0: number) => {
  const closeDay = getSafeDueDay(year, month0, closingDay);
  const end = new Date(year, month0, closeDay, 23, 59, 59, 999);
  const prev = new Date(year, month0 - 1, 1);
  const startDay = getSafeDueDay(prev.getFullYear(), prev.getMonth(), closingDay);
  const start = new Date(prev.getFullYear(), prev.getMonth(), startDay + 1, 0, 0, 0, 0);
  return { start, end };
};

const currentStatementMonth = (closingDay: number, ref: Date = new Date()) => {
  const day = getSafeDueDay(ref.getFullYear(), ref.getMonth(), closingDay);
  if (ref.getDate() > day) {
    const next = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
    return { year: next.getFullYear(), month0: next.getMonth() };
  }
  return { year: ref.getFullYear(), month0: ref.getMonth() };
};

const buildInstallmentSchedule = async (user: any, data: any) => {
  const plan = PLANS[user.plan] || PLANS.FREE;
  if (!plan.hasInstallments) {
    throw new Error(
      "Parcelamento disponível apenas no plano pago. Faça upgrade para ativar.",
    );
  }
  if (
    plan.transactionsLimit !== -1 &&
    user.transactionsUsed + data.installments > plan.transactionsLimit
  ) {
    throw new Error(
      `Limite mensal de ${plan.transactionsLimit} transações atingido. Faça upgrade do seu plano.`,
    );
  }

  const installment = await prisma.installment.create({
    data: {
      id: uuidv4(),
      userId: user.id,
      description: data.description,
      totalAmount: data.totalAmount,
      numberOfParcels: data.installments,
      dueDay: data.dueDay,
      startDate: data.startDate,
      status: "active",
    },
  });

  const perParcel = Number((data.totalAmount / data.installments).toFixed(2));
  const remainder = Number(
    (data.totalAmount - perParcel * data.installments).toFixed(2),
  );
  const transactionsData = [] as any[];

  for (let i = 0; i < data.installments; i++) {
    const installmentDate = new Date(data.startDate);
    installmentDate.setMonth(installmentDate.getMonth() + i);
    installmentDate.setDate(
      getSafeDueDay(
        installmentDate.getFullYear(),
        installmentDate.getMonth(),
        data.dueDay,
      ),
    );
    const amount =
      i === data.installments - 1 ? perParcel + remainder : perParcel;
    transactionsData.push({
      id: uuidv4(),
      userId: user.id,
      title: `${data.description} • ${i + 1}/${data.installments}`,
      amount,
      type: "EXPENSE",
      category: data.category,
      description: data.note || `Parcela ${i + 1} de ${data.installments}`,
      date: installmentDate,
      recurring: false,
      paymentMethod: data.paymentMethod,
      installments: data.installments,
      installmentNumber: i + 1,
      totalInstallments: data.installments,
      totalAmount: data.totalAmount,
      currency: "BRL",
      installmentId: installment.id,
      accountId: data.accountId ?? null,
      cardId: data.cardId ?? null,
    });
  }

  await prisma.transaction.createMany({ data: transactionsData });
  await prisma.user.update({
    where: { id: user.id },
    data: { transactionsUsed: { increment: data.installments } },
  });

  // Create persistent financial alerts for installments that are credit-card charges
  try {
    const cardAlerts = transactionsData
      .filter((t) => t.paymentMethod === "credito")
      .map((t) => ({
        id: uuidv4(),
        userId: user.id,
        installmentId: t.installmentId,
        title: `Cobrança no cartão: ${t.title}`,
        description: `Parcela vence em ${toLocalDateKey(new Date(t.date))}`,
        type: "installment",
        severity: "warning",
        amount: t.amount,
        daysUntilDue: diffDays(new Date(t.date), new Date()),
        dueDate: new Date(t.date),
      }));
    if (cardAlerts.length)
      await prisma.financialAlert.createMany({ data: cardAlerts });
  } catch (err: any) {
    console.error("Failed to create installment alerts:", err);
  }

  return { installment, transactions: transactionsData };
};

const goalSchema = z.object({
  title: z.string().min(1).max(120),
  targetAmount: z.number().positive(),
  currentAmount: z.number().min(0).optional().default(0),
  deadline: z.string().transform((str) => new Date(str)),
});

const budgetSchema = z.object({
  category: z.string(),
  limit: z.number().positive(),
});

const accountSchema = z.object({
  name: z.string().min(1).max(80),
  type: z
    .enum(["corrente", "poupanca", "carteira", "investimento"])
    .optional()
    .default("corrente"),
  color: z.string().optional(),
  isDefault: z.boolean().optional().default(false),
});

const creditCardSchema = z.object({
  name: z.string().min(1).max(80),
  brand: z.string().optional().nullable(),
  limit: z.number().min(0).optional().default(0),
  closingDay: z.number().min(1).max(31),
  dueDay: z.number().min(1).max(31),
  color: z.string().optional(),
});

const contactSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  color: z.string().optional(),
});

const splitExpenseCreateSchema = z.object({
  splits: z
    .array(
      z.object({
        contactId: z.string(),
        amount: z.number().positive(),
      }),
    )
    .min(1),
});

const profileUpdateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).max(128).optional(),
  photo: z.string().optional(),
});

const categoriesUpdateSchema = z.object({
  categories: z.array(z.string().min(1).max(50)).min(1),
});

const categorySchema = z.object({
  name: z.string().min(1).max(60),
  icon: z.string().optional(),
  color: z.string().optional(),
  type: z.enum(["income", "expense", "both"]).optional().default("expense"),
  isActive: z.boolean().optional().default(true),
});

const categoryUpdateSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  type: z.enum(["income", "expense", "both"]).optional(),
  isActive: z.boolean().optional(),
});

const userUpdateSchema = z.object({
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

const onboardingSchema = z.object({
  usageType: z.enum(["pessoal", "empresarial", "organizar"]),
  companyName: z.string().nullable().optional(),
  companyLogo: z.string().nullable().optional(),
  businessPurpose: z.string().nullable().optional(),
  primaryColor: z.string().nullable().optional(),
  categories: z.array(z.string().min(1).max(50)).min(1),
});

// ============================================================================
// HELPERS
// ============================================================================
// `photo`/`companyLogo` are data: URIs stored straight in the DB — some are
// multiple MB of base64. userPublic() is embedded in the login/signup/me/
// refresh response and re-fetched on every window focus (useAutoRefreshUser),
// so shipping the raw bytes there made every auth check multi-megabyte. Only
// a boolean flag goes out here; the actual image is fetched once, on demand,
// from GET /api/auth/photo by whichever screen renders an <img>.
const userPublic = (u: any) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  blocked: u.blocked,
  hasPhoto: !!u.photo,
  plan: u.plan,
  transactionsUsed: u.transactionsUsed,
  stripeCustomerId: u.stripeCustomerId,
  stripeSubscriptionId: u.stripeSubscriptionId,
  planExpiresAt: u.planExpiresAt,
  hasCompletedOnboarding: u.hasCompletedOnboarding,
  usageType: u.usageType,
  companyName: u.companyName,
  hasCompanyLogo: !!u.companyLogo,
  businessPurpose: u.businessPurpose,
  primaryColor: u.primaryColor,
  isVerified: u.isVerified,
  createdAt: u.createdAt,
});

// ============================================================================
// AUTH
// ============================================================================
// Separate from userPublic() on purpose — see comment there. Fetched once by
// whichever component actually renders an avatar, not on every auth check.
// `authenticate` now omits photo/companyLogo (see comment there), so this is
// its own dedicated query — `select` (not the default fetch-everything)
// keeps it to exactly the two columns actually needed here.
app.get("/api/auth/photo", authenticate, async (req, res) => {
  const authUser = (req as any).user;
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { photo: true, companyLogo: true },
  });
  res.json({ photo: user?.photo || null, companyLogo: user?.companyLogo || null });
});

// ============================================================================
// ONBOARDING
// ============================================================================
const DEFAULT_CATEGORIES = [
  "Alimentação",
  "Transporte",
  "Saúde",
  "Salário",
  "Investimento",
  "Pagamento",
  "Lazer",
  "Educação",
  "Moradia",
  "Serviços",
];

app.post("/api/onboarding", authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.hasCompletedOnboarding)
      return res.status(400).json({ error: "Onboarding já completado" });
    const data = onboardingSchema.parse(req.body);
    const updateData: any = {
      hasCompletedOnboarding: true,
      usageType: data.usageType,
    };
    if (data.usageType !== "pessoal") {
      updateData.companyName = data.companyName || null;
      updateData.companyLogo = data.companyLogo || null;
      updateData.businessPurpose = data.businessPurpose || null;
      updateData.primaryColor = data.primaryColor || null;
    } else {
      updateData.companyName = null;
      updateData.companyLogo = null;
      updateData.businessPurpose = null;
      updateData.primaryColor = null;
    }
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });
    await prisma.category.deleteMany({ where: { userId: user.id } });
    const categoriesToCreate =
      data.categories?.length > 0 ? data.categories : DEFAULT_CATEGORIES;
    if (categoriesToCreate.length > 0) {
      await prisma.category.createMany({
        data: categoriesToCreate.map((name) => ({ userId: user.id, name })),
      });
    }
    res.json({ user: userPublic(updatedUser) });
  } catch (err: any) {
    console.error("Onboarding error:", err);
    if (err.name === "ZodError")
      return res
        .status(400)
        .json({ error: "Dados inválidos", details: err.errors });
    res.status(500).json({ error: err.message || "Erro no onboarding" });
  }
});

app.post(
  "/api/upload-logo",
  authenticate,
  upload.single("logo"),
  async (req, res) => {
    try {
      const user = (req as any).user;
      if (user.plan !== "PRO")
        return res
          .status(403)
          .json({ error: "Upload de logo disponível apenas para plano PRO" });
      if (!req.file)
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
      const logoUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      res.json({ logoUrl });
    } catch (err: any) {
      console.error("Upload error:", err);
      res.status(500).json({ error: "Erro no upload" });
    }
  },
);

app.get("/api/plans", (_req, res) => res.json(Object.values(PLANS)));

app.get("/api/plans/me", authenticate, (req, res) => {
  const user = (req as any).user;
  const plan = PLANS[user.plan] || PLANS.FREE;
  res.json({
    plan: user.plan,
    planDetails: plan,
    transactionsUsed: user.transactionsUsed,
    transactionsMonth: user.transactionsMonth,
    stripeSubscriptionId: user.stripeSubscriptionId,
    planExpiresAt: user.planExpiresAt,
  });
});

// ============================================================================
// CATEGORIES
// ============================================================================
app.put("/api/categories", authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const plan = PLANS[user.plan] || PLANS.FREE;
    if (!plan.canEditCategories)
      return res.status(403).json({
        error: "Atualização de categorias disponível apenas no plano Pro",
      });
    const data = categoriesUpdateSchema.parse(req.body);
    const uniqueCategories = Array.from(
      new Set(data.categories.map((cat) => cat.trim()).filter(Boolean)),
    );
    if (uniqueCategories.length === 0)
      return res
        .status(400)
        .json({ error: "Adicione pelo menos uma categoria" });
    await prisma.category.deleteMany({ where: { userId: user.id } });
    await prisma.category.createMany({
      data: uniqueCategories.map((name) => ({ userId: user.id, name })),
    });
    const categories = await prisma.category.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    });
    res.json(categories);
  } catch (err: any) {
    console.error("Categories update error:", err);
    if (err.name === "ZodError")
      return res.status(400).json({ error: "Dados de categoria inválidos" });
    res
      .status(500)
      .json({ error: err.message || "Erro ao atualizar categorias" });
  }
});

app.post("/api/categories", authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const plan = PLANS[user.plan] || PLANS.FREE;
    if (!plan.canCreateCategories)
      return res.status(403).json({
        error: "Criação de categorias disponível apenas no plano Pro",
      });
    const data = categorySchema.parse(req.body);
    const category = await prisma.category.create({
      data: { id: uuidv4(), userId: user.id, ...data },
    });
    res.json(category);
  } catch (err: any) {
    console.error("Create category error:", err);
    if (err.name === "ZodError")
      return res.status(400).json({ error: "Dados de categoria inválidos" });
    res.status(500).json({ error: err.message || "Erro ao criar categoria" });
  }
});

app.put("/api/categories/:id", authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const plan = PLANS[user.plan] || PLANS.FREE;
    if (!plan.canEditCategories)
      return res
        .status(403)
        .json({ error: "Edição de categorias disponível apenas no plano Pro" });
    const data = categoryUpdateSchema.parse(req.body);
    const updated = await prisma.category.updateMany({
      where: { id: String(req.params.id), userId: user.id },
      data,
    });
    if (updated.count === 0)
      return res.status(404).json({ error: "Categoria não encontrada" });
    const category = await prisma.category.findUnique({
      where: { id: String(req.params.id) },
    });
    res.json(category);
  } catch (err: any) {
    console.error("Update category error:", err);
    if (err.name === "ZodError")
      return res.status(400).json({ error: "Dados de categoria inválidos" });
    res
      .status(500)
      .json({ error: err.message || "Erro ao atualizar categoria" });
  }
});

app.delete("/api/categories/:id", authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const plan = PLANS[user.plan] || PLANS.FREE;
    if (!plan.canEditCategories)
      return res.status(403).json({
        error: "Exclusão de categorias disponível apenas no plano Pro",
      });
    const categoryId = String(req.params.id);
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category || category.userId !== user.id)
      return res.status(404).json({ error: "Categoria não encontrada" });
    const linked = await prisma.transaction.count({
      where: { userId: user.id, category: category.name },
    });
    if (linked > 0)
      return res.status(400).json({
        error: "Não é possível excluir categoria vinculada a transações",
      });
    await prisma.category.delete({ where: { id: categoryId } });
    res.json({ ok: true });
  } catch (err: any) {
    console.error("Delete category error:", err);
    res.status(500).json({ error: err.message || "Erro ao excluir categoria" });
  }
});

app.get("/api/categories", authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const categories = await prisma.category.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    });
    res.json(categories);
  } catch (err: any) {
    console.error("Categories error:", err);
    res.status(500).json({ error: "Erro ao buscar categorias" });
  }
});

// ============================================================================
// TRANSACTIONS
// ============================================================================
app.get("/api/transactions", authenticate, async (req, res) => {
  const user = (req as any).user;
  const plan = PLANS[user.plan] || PLANS.FREE;
  if (!plan.canUseTransactions) {
    return res.status(403).json({
      error:
        "Acesso a transações não disponível no seu plano. Faça upgrade para acessar.",
      upgrade: true,
      currentPlan: user.plan,
    });
  }
  const { type, category, search, startDate, endDate, date } = req.query;
  const where: any = { userId: user.id };
  if (type) where.type = type;
  if (category) where.category = category;
  if (search) where.title = { contains: search as string };

  const buildDateRange = (dateStr: string) => {
    const [year, month, day] = String(dateStr).split("-").map(Number);
    if ([year, month, day].some((value) => !Number.isInteger(value)))
      return null;
    return {
      gte: new Date(year, month - 1, day, 0, 0, 0, 0),
      lte: new Date(year, month - 1, day, 23, 59, 59, 999),
    };
  };

  if (date) {
    const range = buildDateRange(String(date));
    if (range) where.date = range;
  } else if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate as string);
    if (endDate) where.date.lte = new Date(endDate as string);
  }

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { date: "desc" },
  });
  res.json(transactions);
});

app.post("/api/transactions", authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = transactionSchema.parse(req.body);
  const plan = PLANS[user.plan] || PLANS.FREE;

  if (!plan.canUseTransactions) {
    return res.status(403).json({
      error: "Acesso a transações não disponível no seu plano.",
      upgrade: true,
      currentPlan: user.plan,
    });
  }
  if (
    plan.transactionsLimit !== -1 &&
    user.transactionsUsed >= plan.transactionsLimit
  ) {
    return res.status(403).json({
      error: `Limite mensal de ${plan.transactionsLimit} transações atingido.`,
      upgrade: true,
      currentPlan: user.plan,
      limit: plan.transactionsLimit,
      used: user.transactionsUsed,
    });
  }
  if (plan.categoriesLimit !== 999) {
    const distinctCats = await prisma.transaction.findMany({
      where: { userId: user.id },
      select: { category: true },
      distinct: ["category"],
    });
    const existingCats = new Set(distinctCats.map((c) => c.category));
    if (
      !existingCats.has(data.category) &&
      existingCats.size >= plan.categoriesLimit
    ) {
      return res.status(403).json({
        error: `Plano ${plan.name} permite até ${plan.categoriesLimit} categorias.`,
        upgrade: true,
      });
    }
  }

  try {
    if (data.installments > 1 && data.type === "EXPENSE") {
      const response = await buildInstallmentSchedule(user, {
        description: data.title,
        totalAmount: data.amount * data.installments,
        installments: data.installments,
        dueDay: new Date(data.date).getDate(),
        startDate: data.date,
        category: data.category,
        paymentMethod: data.paymentMethod,
        note: data.description,
        accountId: data.accountId,
        cardId: data.cardId,
      });
      return res.json(response.transactions);
    }

    // Pausa de 24h pra compra por impulso: only worth asking about on
    // expenses that are unusually large for THIS user — comparing against a
    // flat threshold would either spam frugal users or never trigger for
    // big spenders. 2.5x their own historical average, floored at R$150 so
    // it doesn't fire on someone whose average is near zero.
    let flaggedImpulse = false;
    if (data.type === "EXPENSE" && data.plannedPurchase === false) {
      const agg = await prisma.transaction.aggregate({
        where: { userId: user.id, type: "EXPENSE" },
        _avg: { amount: true },
      });
      const threshold = Math.max(150, (agg._avg.amount || 0) * 2.5);
      flaggedImpulse = data.amount >= threshold;
    }

    const { plannedPurchase, ...transactionData } = data;
    const transaction = await prisma.transaction.create({
      data: {
        ...transactionData,
        id: uuidv4(),
        userId: user.id,
        dueDate: data.dueDate ?? null,
        flaggedImpulse,
      },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { transactionsUsed: { increment: 1 } },
    });

    // Round-up ("arredondamento"): sweep the difference to the next whole
    // real into the user's chosen goal. Fire-and-forget — never let this
    // side effect slow down or fail the actual transaction creation.
    if (data.type === "EXPENSE" && user.roundUpEnabled && user.roundUpGoalId) {
      const roundUp = Number((Math.ceil(data.amount) - data.amount).toFixed(2));
      if (roundUp > 0) {
        prisma.goal
          .update({ where: { id: user.roundUpGoalId }, data: { currentAmount: { increment: roundUp } } })
          .catch((err) => console.error("[ROUNDUP] Falha ao aplicar arredondamento:", err));
      }
    }

    // If this is a credit-card charge, create a FinancialAlert for the user
    try {
      if (data.paymentMethod === "credito") {
        await prisma.financialAlert.create({
          data: {
            id: uuidv4(),
            userId: user.id,
            installmentId: transaction.installmentId || null,
            title: `Cobrança no cartão: ${transaction.title}`,
            description: transaction.description || null,
            type: "installment",
            severity: "warning",
            amount: transaction.amount,
            daysUntilDue: transaction.dueDate
              ? diffDays(new Date(transaction.dueDate), new Date())
              : null,
            dueDate: transaction.dueDate || null,
          },
        });
      }
    } catch (err: any) {
      console.error("Failed to create credit card alert:", err);
    }
    dispatchWebhook(user.id, "transaction.created", {
      id: transaction.id,
      title: transaction.title,
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category,
    });
    res.json(transaction);
  } catch (err: any) {
    console.error("Transaction creation error:", err);
    if (err.message?.includes("Limite mensal"))
      return res.status(403).json({ error: err.message, upgrade: true });
    throw err;
  }
});

app.put("/api/transactions/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = transactionSchema.parse(req.body);
  const transaction = await prisma.transaction.updateMany({
    where: { id: String(req.params.id), userId: user.id },
    data,
  });
  if (transaction.count === 0)
    return res.status(404).json({ error: "Transação não encontrada" });
  const updated = await prisma.transaction.findUnique({
    where: { id: String(req.params.id) },
  });
  res.json(updated);
});

app.delete("/api/transactions/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const { deleteGroup } = req.query;
  if (deleteGroup === "true") {
    const tx = await prisma.transaction.findUnique({
      where: { id: String(req.params.id) },
    });
    if (tx?.installmentId) {
      await prisma.transaction.deleteMany({
        where: { installmentId: tx.installmentId, userId: user.id },
      });
      await prisma.installment.deleteMany({
        where: { id: tx.installmentId, userId: user.id },
      });
      return res.json({ ok: true });
    }
  }
  const deleted = await prisma.transaction.deleteMany({
    where: { id: String(req.params.id), userId: user.id },
  });
  if (deleted.count === 0)
    return res.status(404).json({ error: "Transação não encontrada" });
  res.json({ ok: true });
});

app.get("/api/installments", authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const installments = await prisma.installment.findMany({
      where: { userId: user.id },
      orderBy: { startDate: "desc" },
      include: { transactions: true },
    });
    const now = new Date();
    const result = installments.map((inst) => {
      const nextTransaction = inst.transactions
        .filter((t) => new Date(t.date) >= now)
        .sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        )[0];
      const paid = inst.transactions.filter(
        (t) => new Date(t.date) < now,
      ).length;
      return {
        ...inst,
        nextDueDate: nextTransaction?.date || null,
        paidInstallments: paid,
        remainingInstallments: inst.numberOfParcels - paid,
      };
    });
    res.json(result);
  } catch (err: any) {
    console.error("Installments error:", err);
    res.status(500).json({ error: "Erro ao carregar parcelamentos" });
  }
});

// ============================================================================
// ALERTS
// ============================================================================
app.get(
  "/api/alerts",
  authenticate,
  requireFeature("canUseAlerts"),
  async (req, res) => {
    try {
      const user = (req as any).user;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const futureLimit = new Date(today);
      futureLimit.setDate(futureLimit.getDate() + 7);

      // 1) persistent FinancialAlert records
      const storedAlerts = await prisma.financialAlert.findMany({
        where: { userId: user.id, isRead: false },
        orderBy: { dueDate: "asc" },
      });

      const persistent = storedAlerts.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        dueDate: a.dueDate,
        amount: a.amount,
        daysUntilDue: a.daysUntilDue,
        severity: a.severity,
        type: a.type,
      }));

      // 2) upcoming installment transactions (existing behavior)
      const upcomingInstallments = await prisma.transaction.findMany({
        where: {
          userId: user.id,
          type: "EXPENSE",
          date: { gte: today, lte: futureLimit },
          totalInstallments: { not: null },
        },
        orderBy: { date: "asc" },
      });

      const computedInstallments = upcomingInstallments.map((tx) => {
        const dueDate = new Date(tx.date);
        const daysUntilDue = diffDays(dueDate, today);
        const installmentsLeft =
          tx.totalInstallments && tx.installmentNumber
            ? tx.totalInstallments - tx.installmentNumber
            : 0;
        const title =
          daysUntilDue === 0
            ? `Parcela ${tx.title} vence hoje — R$ ${tx.amount.toFixed(2)}`
            : `Parcela ${tx.title} vence em ${daysUntilDue} dia${daysUntilDue > 1 ? "s" : ""} — R$ ${tx.amount.toFixed(2)}`;
        const description =
          installmentsLeft > 0
            ? `${installmentsLeft} parcela${installmentsLeft > 1 ? "s" : ""} restantes`
            : "Última parcela";
        return {
          id: tx.id,
          title,
          description,
          dueDate: tx.date,
          amount: tx.amount,
          daysUntilDue,
          severity: daysUntilDue === 0 ? "danger" : "warning",
          installmentNumber: tx.installmentNumber,
          totalInstallments: tx.totalInstallments,
        };
      });

      // 3) upcoming credit-card charges (single transactions or installments flagged as credit)
      const upcomingCardCharges = await prisma.transaction.findMany({
        where: {
          userId: user.id,
          type: "EXPENSE",
          paymentMethod: "credito",
          date: { gte: today, lte: futureLimit },
        },
        orderBy: { date: "asc" },
      });

      const computedCard = upcomingCardCharges.map((tx) => {
        const dueDate = new Date(tx.date);
        const daysUntilDue = diffDays(dueDate, today);
        const title =
          daysUntilDue === 0
            ? `Cobrança no cartão: ${tx.title} — R$ ${tx.amount.toFixed(2)}`
            : `Cobrança no cartão: ${tx.title} vence em ${daysUntilDue} dia${daysUntilDue > 1 ? "s" : ""} — R$ ${tx.amount.toFixed(2)}`;
        return {
          id: tx.id,
          title,
          description: tx.description || null,
          dueDate: tx.date,
          amount: tx.amount,
          daysUntilDue,
          severity: daysUntilDue === 0 ? "danger" : "warning",
          type: "card_charge",
        };
      });

      // Merge all alerts and sort by dueDate
      const alerts = [
        ...persistent,
        ...computedInstallments,
        ...computedCard,
      ].sort((a, b) => {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        return da - db;
      });

      res.json({ alerts, count: alerts.length });
    } catch (err: any) {
      console.error("Alerts error:", err);
      res.status(500).json({ error: "Erro ao buscar alertas" });
    }
  },
);

app.post("/api/alerts/read", authenticate, (_req, res) => {
  res.json({ ok: true });
});

// ============================================================================
// CALENDAR
// ============================================================================
app.get("/api/calendar", authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const monthParam = String(req.query.month || "");
    const [year, month] = monthParam.split("-").map(Number);
    const selected =
      Number.isInteger(year) && Number.isInteger(month)
        ? new Date(year, month - 1, 1)
        : new Date();

    const startOfMonth = new Date(
      selected.getFullYear(),
      selected.getMonth(),
      1,
      0,
      0,
      0,
      0,
    );
    const endOfMonth = new Date(
      selected.getFullYear(),
      selected.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id, date: { gte: startOfMonth, lte: endOfMonth } },
      orderBy: { date: "asc" },
    });

    const dailyMap: Record<
      string,
      { revenue: number; expense: number; net: number; transactions: any[] }
    > = {};
    const monthDays = new Date(
      selected.getFullYear(),
      selected.getMonth() + 1,
      0,
    ).getDate();

    for (let day = 1; day <= monthDays; day++) {
      const dateKey = toLocalDateKey(
        new Date(selected.getFullYear(), selected.getMonth(), day),
      );
      dailyMap[dateKey] = { revenue: 0, expense: 0, net: 0, transactions: [] };
    }

    const monthlyTotal = { revenue: 0, expense: 0, net: 0 };

    transactions.forEach((tx) => {
      const dateKey = toLocalDateKey(new Date(tx.date));
      if (!dailyMap[dateKey])
        dailyMap[dateKey] = {
          revenue: 0,
          expense: 0,
          net: 0,
          transactions: [],
        };
      const values = dailyMap[dateKey];
      if (tx.type === "INCOME") {
        values.revenue += Number(tx.amount);
        monthlyTotal.revenue += Number(tx.amount);
      } else {
        values.expense += Number(tx.amount);
        monthlyTotal.expense += Number(tx.amount);
      }
      values.net = values.revenue - values.expense;
      monthlyTotal.net = monthlyTotal.revenue - monthlyTotal.expense;
      values.transactions.push({
        id: tx.id,
        title: tx.title,
        amount: tx.amount,
        type: tx.type,
        category: tx.category,
        description: tx.description ?? null,
        date: toLocalDateKey(new Date(tx.date)),
        paymentMethod: tx.paymentMethod ?? "pix",
        currency: tx.currency ?? "BRL",
        recurring: tx.recurring ?? false,
        recurringFrequency: tx.recurringFrequency ?? null,
        installmentGroupId: (tx as any).installmentId ?? null,
        installmentNumber: tx.installmentNumber ?? null,
        totalInstallments: tx.totalInstallments ?? null,
      });
      dailyMap[dateKey] = values;
    });

    const dailySummary = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({ date, ...data }));

    res.json({
      month: selected.getMonth() + 1,
      year: selected.getFullYear(),
      monthlyTotal,
      dailySummary,
    });
  } catch (err: any) {
    console.error("Calendar error:", err);
    res.status(500).json({ error: "Erro ao carregar calendário" });
  }
});

// ============================================================================
// GOALS
// ============================================================================
// A goal is visible/editable by its owner (userId) OR any accepted
// GoalMember — the `OR` below is what makes goals "shared" without touching
// every existing query that assumed single ownership.
app.get("/api/goals", authenticate, async (req, res) => {
  const user = (req as any).user;
  const goals = await prisma.goal.findMany({
    where: { OR: [{ userId: user.id }, { members: { some: { userId: user.id } } }] },
    include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
    orderBy: { deadline: "asc" },
  });
  res.json(goals);
});

app.post("/api/goals", authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = goalSchema.parse(req.body);
  const plan = PLANS[user.plan] || PLANS.FREE;
  if (plan.goalsLimit !== -1) {
    const count = await prisma.goal.count({ where: { userId: user.id } });
    if (count >= plan.goalsLimit)
      return res.status(403).json({
        error: `Plano ${plan.name} permite até ${plan.goalsLimit} metas. Faça upgrade.`,
        upgrade: true,
      });
  }
  const goal = await prisma.goal.create({
    data: { ...data, id: uuidv4(), userId: user.id },
  });
  dispatchWebhook(user.id, "goal.created", { id: goal.id, title: goal.title, targetAmount: goal.targetAmount });
  res.json(goal);
});

const canAccessGoal = async (goalId: string, userId: string) => {
  const goal = await prisma.goal.findFirst({
    where: { id: goalId, OR: [{ userId }, { members: { some: { userId } } }] },
  });
  return goal;
};

app.put("/api/goals/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = goalSchema.parse(req.body);
  const existing = await canAccessGoal(String(req.params.id), user.id);
  if (!existing) return res.status(404).json({ error: "Meta não encontrada" });

  const updated = await prisma.goal.update({
    where: { id: String(req.params.id) },
    data,
  });
  if (updated.currentAmount >= updated.targetAmount) {
    dispatchWebhook(existing.userId, "goal.completed", { id: updated.id, title: updated.title });
  }
  res.json(updated);
});

app.delete("/api/goals/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  // Only the owner can delete — members can contribute/view, not tear it down.
  const deleted = await prisma.goal.deleteMany({
    where: { id: String(req.params.id), userId: user.id },
  });
  if (deleted.count === 0)
    return res.status(404).json({ error: "Meta não encontrada" });
  res.json({ ok: true });
});

// ── Shared goals: invite another Finix user by e-mail, they accept/decline ──
app.post("/api/goals/:id/invite", authenticate, async (req, res) => {
  const user = (req as any).user;
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const goal = await prisma.goal.findFirst({ where: { id: String(req.params.id), userId: user.id } });
  if (!goal) return res.status(404).json({ error: "Meta não encontrada" });

  const normalizedEmail = email.toLowerCase().trim();
  if (normalizedEmail === user.email) {
    return res.status(400).json({ error: "Você já é dono desta meta" });
  }
  const receiver = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  const invite = await prisma.goalInvite.create({
    data: {
      goalId: goal.id,
      senderId: user.id,
      receiverEmail: normalizedEmail,
      receiverId: receiver?.id || null,
    },
  });
  res.status(201).json(invite);
});

app.get("/api/goals/invites", authenticate, async (req, res) => {
  const user = (req as any).user;
  const invites = await prisma.goalInvite.findMany({
    where: { receiverEmail: user.email.toLowerCase(), status: "pending" },
    include: { goal: true, sender: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(invites);
});

app.post("/api/goals/invites/:id/accept", authenticate, async (req, res) => {
  const user = (req as any).user;
  const invite = await prisma.goalInvite.findUnique({ where: { id: String(req.params.id) } });
  if (!invite || invite.receiverEmail !== user.email.toLowerCase() || invite.status !== "pending") {
    return res.status(404).json({ error: "Convite não encontrado" });
  }
  await prisma.$transaction([
    prisma.goalInvite.update({
      where: { id: invite.id },
      data: { status: "accepted", receiverId: user.id, respondedAt: new Date() },
    }),
    prisma.goalMember.upsert({
      where: { goalId_userId: { goalId: invite.goalId, userId: user.id } },
      create: { goalId: invite.goalId, userId: user.id, role: "member" },
      update: {},
    }),
  ]);
  res.json({ ok: true });
});

app.post("/api/goals/invites/:id/decline", authenticate, async (req, res) => {
  const user = (req as any).user;
  const invite = await prisma.goalInvite.findUnique({ where: { id: String(req.params.id) } });
  if (!invite || invite.receiverEmail !== user.email.toLowerCase() || invite.status !== "pending") {
    return res.status(404).json({ error: "Convite não encontrado" });
  }
  await prisma.goalInvite.update({
    where: { id: invite.id },
    data: { status: "declined", respondedAt: new Date() },
  });
  res.json({ ok: true });
});

// ============================================================================
// BUDGETS
// ============================================================================
app.get("/api/budgets", authenticate, async (req, res) => {
  const user = (req as any).user;
  const budgets = await prisma.budget.findMany({ where: { userId: user.id } });
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id, type: "EXPENSE", date: { gte: monthStart } },
  });
  const spentByCategory: Record<string, number> = {};
  transactions.forEach((t) => {
    spentByCategory[t.category] = (spentByCategory[t.category] || 0) + t.amount;
  });
  const result = budgets.map((b) => ({
    ...b,
    spent: spentByCategory[b.category] || 0,
    percentage:
      b.limit > 0 ? ((spentByCategory[b.category] || 0) / b.limit) * 100 : 0,
  }));
  res.json(result);
});

app.post("/api/budgets", authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = budgetSchema.parse(req.body);
  try {
    const budget = await prisma.budget.create({
      data: { ...data, id: uuidv4(), userId: user.id },
    });
    res.json(budget);
  } catch {
    res
      .status(400)
      .json({ error: "Já existe um orçamento para esta categoria" });
  }
});

app.put("/api/budgets/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = budgetSchema.parse(req.body);
  const budget = await prisma.budget.updateMany({
    where: { id: String(req.params.id), userId: user.id },
    data,
  });
  if (budget.count === 0)
    return res.status(404).json({ error: "Orçamento não encontrado" });
  const updated = await prisma.budget.findUnique({
    where: { id: String(req.params.id) },
  });
  res.json(updated);
});

app.delete("/api/budgets/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const deleted = await prisma.budget.deleteMany({
    where: { id: String(req.params.id), userId: user.id },
  });
  if (deleted.count === 0)
    return res.status(404).json({ error: "Orçamento não encontrado" });
  res.json({ ok: true });
});

// ============================================================================
// ACCOUNTS
// ============================================================================
app.get("/api/accounts", authenticate, async (req, res) => {
  const user = (req as any).user;
  const accounts = await prisma.account.findMany({
    where: { userId: user.id, archived: false },
    orderBy: { createdAt: "asc" },
  });
  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id, accountId: { in: accounts.map((a) => a.id) } },
    select: { accountId: true, amount: true, type: true },
  });
  const balanceByAccount: Record<string, number> = {};
  transactions.forEach((t) => {
    const delta = t.type === "INCOME" ? t.amount : -t.amount;
    balanceByAccount[t.accountId as string] =
      (balanceByAccount[t.accountId as string] || 0) + delta;
  });
  res.json(accounts.map((a) => ({ ...a, balance: balanceByAccount[a.id] || 0 })));
});

app.post("/api/accounts", authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = accountSchema.parse(req.body);
  const plan = PLANS[user.plan] || PLANS.FREE;
  const count = await prisma.account.count({
    where: { userId: user.id, archived: false },
  });
  if (count >= plan.accountsLimit)
    return res.status(403).json({
      error: `Plano ${plan.name} permite até ${plan.accountsLimit} contas. Faça upgrade.`,
      upgrade: true,
    });
  const account = await prisma.account.create({
    data: { ...data, id: uuidv4(), userId: user.id },
  });
  res.json(account);
});

app.put("/api/accounts/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = accountSchema.parse(req.body);
  const updated = await prisma.account.updateMany({
    where: { id: String(req.params.id), userId: user.id },
    data,
  });
  if (updated.count === 0)
    return res.status(404).json({ error: "Conta não encontrada" });
  const account = await prisma.account.findUnique({
    where: { id: String(req.params.id) },
  });
  res.json(account);
});

app.delete("/api/accounts/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const deleted = await prisma.account.deleteMany({
    where: { id: String(req.params.id), userId: user.id },
  });
  if (deleted.count === 0)
    return res.status(404).json({ error: "Conta não encontrada" });
  res.json({ ok: true });
});

// ============================================================================
// CREDIT CARDS (fatura computada on-the-fly, nunca armazenada)
// ============================================================================
app.get(
  "/api/cards",
  authenticate,
  requireFeature("canUseCards"),
  async (req, res) => {
    const user = (req as any).user;
    const cards = await prisma.creditCard.findMany({
      where: { userId: user.id, archived: false },
      orderBy: { createdAt: "asc" },
    });
    const now = new Date();
    const result = await Promise.all(
      cards.map(async (c) => {
        const { year, month0 } = currentStatementMonth(c.closingDay, now);
        const { start, end } = cardStatementWindow(c.closingDay, year, month0);
        const txs = await prisma.transaction.findMany({
          where: {
            userId: user.id,
            cardId: c.id,
            paymentMethod: "credito",
            date: { gte: start, lte: end },
          },
        });
        const total = txs.reduce((s, t) => s + t.amount, 0);
        const dueDate = new Date(year, month0, getSafeDueDay(year, month0, c.dueDay));
        return {
          ...c,
          currentStatement: {
            referenceMonth: `${year}-${String(month0 + 1).padStart(2, "0")}`,
            total,
            closingDate: end,
            dueDate,
            transactionsCount: txs.length,
          },
        };
      }),
    );
    res.json(result);
  },
);

app.post(
  "/api/cards",
  authenticate,
  requireFeature("canUseCards"),
  async (req, res) => {
    const user = (req as any).user;
    const data = creditCardSchema.parse(req.body);
    const plan = PLANS[user.plan] || PLANS.FREE;
    const count = await prisma.creditCard.count({
      where: { userId: user.id, archived: false },
    });
    if (count >= plan.cardsLimit)
      return res.status(403).json({
        error: `Plano ${plan.name} permite até ${plan.cardsLimit} cartões. Faça upgrade.`,
        upgrade: true,
      });
    const card = await prisma.creditCard.create({
      data: { ...data, id: uuidv4(), userId: user.id },
    });
    res.json(card);
  },
);

app.put(
  "/api/cards/:id",
  authenticate,
  requireFeature("canUseCards"),
  async (req, res) => {
    const user = (req as any).user;
    const data = creditCardSchema.parse(req.body);
    const updated = await prisma.creditCard.updateMany({
      where: { id: String(req.params.id), userId: user.id },
      data,
    });
    if (updated.count === 0)
      return res.status(404).json({ error: "Cartão não encontrado" });
    const card = await prisma.creditCard.findUnique({
      where: { id: String(req.params.id) },
    });
    res.json(card);
  },
);

app.delete(
  "/api/cards/:id",
  authenticate,
  requireFeature("canUseCards"),
  async (req, res) => {
    const user = (req as any).user;
    const deleted = await prisma.creditCard.deleteMany({
      where: { id: String(req.params.id), userId: user.id },
    });
    if (deleted.count === 0)
      return res.status(404).json({ error: "Cartão não encontrado" });
    res.json({ ok: true });
  },
);

app.get(
  "/api/cards/:id/statements/:month",
  authenticate,
  requireFeature("canUseCards"),
  async (req, res) => {
    const user = (req as any).user;
    const card = await prisma.creditCard.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!card || card.userId !== user.id)
      return res.status(404).json({ error: "Cartão não encontrado" });
    const [yearStr, monthStr] = String(req.params.month).split("-");
    const year = Number(yearStr);
    const month0 = Number(monthStr) - 1;
    if (!Number.isInteger(year) || !Number.isInteger(month0))
      return res.status(400).json({ error: "Mês inválido, use o formato AAAA-MM" });
    const { start, end } = cardStatementWindow(card.closingDay, year, month0);
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        cardId: card.id,
        paymentMethod: "credito",
        date: { gte: start, lte: end },
      },
      orderBy: { date: "asc" },
    });
    const total = transactions.reduce((s, t) => s + t.amount, 0);
    const dueDate = new Date(year, month0, getSafeDueDay(year, month0, card.dueDay));
    res.json({
      referenceMonth: `${year}-${String(month0 + 1).padStart(2, "0")}`,
      closingDate: end,
      dueDate,
      total,
      transactions,
    });
  },
);

// ============================================================================
// CONTACTS & SPLIT EXPENSES (rachar conta)
// ============================================================================
app.get("/api/contacts", authenticate, async (req, res) => {
  const user = (req as any).user;
  const contacts = await prisma.contact.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
  });
  const splits = await prisma.splitExpense.findMany({
    where: { userId: user.id, settled: false },
  });
  const owedByContact: Record<string, number> = {};
  splits.forEach((s) => {
    owedByContact[s.contactId] = (owedByContact[s.contactId] || 0) + s.amount;
  });
  res.json(
    contacts.map((c) => ({ ...c, totalOwed: owedByContact[c.id] || 0 })),
  );
});

app.post("/api/contacts", authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = contactSchema.parse(req.body);
  const plan = PLANS[user.plan] || PLANS.FREE;
  const count = await prisma.contact.count({ where: { userId: user.id } });
  if (count >= plan.contactsLimit)
    return res.status(403).json({
      error: `Plano ${plan.name} permite até ${plan.contactsLimit} contatos. Faça upgrade.`,
      upgrade: true,
    });
  const contact = await prisma.contact.create({
    data: { ...data, id: uuidv4(), userId: user.id },
  });
  res.json(contact);
});

app.put("/api/contacts/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = contactSchema.parse(req.body);
  const updated = await prisma.contact.updateMany({
    where: { id: String(req.params.id), userId: user.id },
    data,
  });
  if (updated.count === 0)
    return res.status(404).json({ error: "Contato não encontrado" });
  const contact = await prisma.contact.findUnique({
    where: { id: String(req.params.id) },
  });
  res.json(contact);
});

app.delete("/api/contacts/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const deleted = await prisma.contact.deleteMany({
    where: { id: String(req.params.id), userId: user.id },
  });
  if (deleted.count === 0)
    return res.status(404).json({ error: "Contato não encontrado" });
  res.json({ ok: true });
});

// "Quem deve quem" líquido: zera de uma vez todas as divisões em aberto com
// este contato, em vez de marcar uma por uma.
app.post("/api/contacts/:id/settle-all", authenticate, async (req, res) => {
  const user = (req as any).user;
  const contact = await prisma.contact.findUnique({ where: { id: String(req.params.id) } });
  if (!contact || contact.userId !== user.id) return res.status(404).json({ error: "Contato não encontrado" });
  const result = await prisma.splitExpense.updateMany({
    where: { userId: user.id, contactId: contact.id, settled: false },
    data: { settled: true, settledAt: new Date() },
  });
  res.json({ settled: result.count });
});

app.get("/api/contacts/:id/splits", authenticate, async (req, res) => {
  const user = (req as any).user;
  const contact = await prisma.contact.findUnique({
    where: { id: String(req.params.id) },
  });
  if (!contact || contact.userId !== user.id)
    return res.status(404).json({ error: "Contato não encontrado" });
  const splits = await prisma.splitExpense.findMany({
    where: { userId: user.id, contactId: contact.id },
    include: { transaction: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(splits);
});

app.post("/api/transactions/:id/split", authenticate, async (req, res) => {
  const user = (req as any).user;
  const tx = await prisma.transaction.findUnique({
    where: { id: String(req.params.id) },
  });
  if (!tx || tx.userId !== user.id)
    return res.status(404).json({ error: "Transação não encontrada" });
  const data = splitExpenseCreateSchema.parse(req.body);
  const contactIds = data.splits.map((s) => s.contactId);
  const ownedCount = await prisma.contact.count({
    where: { id: { in: contactIds }, userId: user.id },
  });
  if (ownedCount !== new Set(contactIds).size)
    return res.status(400).json({ error: "Contato inválido" });
  await prisma.splitExpense.createMany({
    data: data.splits.map((s) => ({
      id: uuidv4(),
      userId: user.id,
      transactionId: tx.id,
      contactId: s.contactId,
      amount: s.amount,
    })),
  });
  const splits = await prisma.splitExpense.findMany({
    where: { transactionId: tx.id, userId: user.id },
    include: { contact: true },
  });
  res.json(splits);
});

app.put("/api/split-expenses/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const settled = Boolean(req.body?.settled);
  const updated = await prisma.splitExpense.updateMany({
    where: { id: String(req.params.id), userId: user.id },
    data: { settled, settledAt: settled ? new Date() : null },
  });
  if (updated.count === 0)
    return res.status(404).json({ error: "Registro não encontrado" });
  const split = await prisma.splitExpense.findUnique({
    where: { id: String(req.params.id) },
  });
  res.json(split);
});

app.delete("/api/split-expenses/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const deleted = await prisma.splitExpense.deleteMany({
    where: { id: String(req.params.id), userId: user.id },
  });
  if (deleted.count === 0)
    return res.status(404).json({ error: "Registro não encontrado" });
  res.json({ ok: true });
});

// ============================================================================
// PROFILE
// ============================================================================
app.put("/api/profile", authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = profileUpdateSchema.parse(req.body);
  const updates: any = {};
  if (data.name) updates.name = data.name.trim();
  if (data.photo) updates.photo = data.photo;
  if (data.newPassword) {
    if (
      !data.currentPassword ||
      !(await bcrypt.compare(data.currentPassword, user.passwordHash))
    )
      return res.status(400).json({ error: "Senha atual incorreta" });
    updates.passwordHash = await bcrypt.hash(data.newPassword, 10);
  }
  if (Object.keys(updates).length === 0)
    return res.status(400).json({ error: "Nada para atualizar" });
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: updates,
  });
  res.json(userPublic(updatedUser));
});

// ============================================================================
// DASHBOARD
// ============================================================================
app.get("/api/dashboard", authenticate, async (req, res) => {
  const user = (req as any).user;
  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
  });
  const goals = await prisma.goal.findMany({ where: { userId: user.id } });

  const income = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((s, t) => s + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((s, t) => s + t.amount, 0);
  const saved = goals.reduce((s, g) => s + g.currentAmount, 0);
  const balance = income - expense - saved;

  const now = new Date();
  const months: Date[] = [];
  for (let i = 5; i >= 0; i--) {
    const y = now.getFullYear();
    const m = now.getMonth() - i;
    const d = new Date(y, m < 0 ? m + 12 : m, 1);
    if (m < 0) d.setFullYear(y - 1);
    months.push(d);
  }
  const monthly = months.map((start) => {
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const inc = transactions
      .filter((t) => t.type === "INCOME" && t.date >= start && t.date < end)
      .reduce((s, t) => s + t.amount, 0);
    const exp = transactions
      .filter((t) => t.type === "EXPENSE" && t.date >= start && t.date < end)
      .reduce((s, t) => s + t.amount, 0);
    return {
      month: start.toLocaleDateString("pt-BR", {
        month: "short",
        year: "2-digit",
      }),
      income: inc,
      expense: exp,
    };
  });

  const byCat: Record<string, number> = {};
  transactions
    .filter((t) => t.type === "EXPENSE")
    .forEach((t) => {
      byCat[t.category] = (byCat[t.category] || 0) + t.amount;
    });
  const categories = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({ category, amount }));

  const insights: any[] = [];
  if (monthly.length >= 2) {
    const cur = monthly[monthly.length - 1].expense;
    const prev = monthly[monthly.length - 2].expense;
    if (prev > 0) {
      const diff = ((cur - prev) / prev) * 100;
      if (diff > 10)
        insights.push({
          type: "warning",
          title: "Gastos aumentaram",
          message: `Você gastou ${diff.toFixed(0)}% a mais este mês.`,
        });
      else if (diff < -10)
        insights.push({
          type: "success",
          title: "Ótimo controle",
          message: `Você economizou ${Math.abs(diff).toFixed(0)}% em relação ao mês passado.`,
        });
    }
  }
  if (categories.length > 0) {
    const top = categories[0];
    if (expense > 0 && top.amount / expense > 0.4)
      insights.push({
        type: "info",
        title: "Categoria dominante",
        message: `${top.category} representa ${((top.amount / expense) * 100).toFixed(0)}% dos seus gastos.`,
      });
  }
  if (balance < 0)
    insights.push({
      type: "warning",
      title: "Atenção ao saldo",
      message: "Suas despesas superam as receitas.",
    });
  else if (income > 0 && balance / income > 0.3)
    insights.push({
      type: "success",
      title: "Você está no caminho certo",
      message: `Economizou ${((balance / income) * 100).toFixed(0)}% da sua renda.`,
    });

  const recent = transactions
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5);
  res.json({
    balance,
    income,
    expense,
    saved,
    monthly,
    categories,
    recent,
    insights,
  });
});

// ============================================================================
// RECURRING TRANSACTIONS
// ============================================================================
const recurringSchema = z.object({
  title: z.string().min(1).max(120),
  amount: z.number().positive(),
  type: z.enum(["INCOME", "EXPENSE"]),
  category: z.string().min(1),
  frequency: z.enum(["weekly", "monthly", "yearly"]),
  startDate: z.coerce.date(),
  accountId: z.string().optional(),
  cardId: z.string().optional(),
});

app.get("/api/recurring", authenticate, async (req, res) => {
  const user = (req as any).user;
  const rules = await prisma.recurringTransaction.findMany({
    where: { userId: user.id },
    orderBy: { nextRunDate: "asc" },
  });
  res.json(rules);
});

app.post("/api/recurring", authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = recurringSchema.parse(req.body);
  const rule = await prisma.recurringTransaction.create({
    data: { ...data, userId: user.id, nextRunDate: data.startDate },
  });
  res.status(201).json(rule);
});

app.put("/api/recurring/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = z
    .object({ active: z.boolean().optional(), amount: z.number().positive().optional() })
    .parse(req.body);
  const updated = await prisma.recurringTransaction.updateMany({
    where: { id: String(req.params.id), userId: user.id },
    data,
  });
  if (updated.count === 0) return res.status(404).json({ error: "Recorrência não encontrada" });
  res.json({ ok: true });
});

app.delete("/api/recurring/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const deleted = await prisma.recurringTransaction.deleteMany({
    where: { id: String(req.params.id), userId: user.id },
  });
  if (deleted.count === 0) return res.status(404).json({ error: "Recorrência não encontrada" });
  res.json({ ok: true });
});

// Manual trigger for the daily job (also runs automatically — see
// startRecurringJobs below). Admin-only: it processes every user's rules.
app.post("/api/admin/run-recurring", authenticate, requireAdmin, async (_req, res) => {
  const result = await runDueRecurringTransactions();
  res.json(result);
});

// ============================================================================
// CSV / OFX — export and import
// ============================================================================
app.get("/api/reports/csv", authenticate, requireFeature("canUseReports"), async (req, res) => {
  const user = (req as any).user;
  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
  });
  const csv = transactionsToCsv(transactions);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="finix-transacoes.csv"');
  res.send(csv);
});

app.get("/api/reports/ofx", authenticate, requireFeature("canUseReports"), async (req, res) => {
  const user = (req as any).user;
  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
  });
  const ofx = transactionsToOfx(transactions, user.name || "Finix");
  res.setHeader("Content-Type", "application/x-ofx");
  res.setHeader("Content-Disposition", 'attachment; filename="finix-transacoes.ofx"');
  res.send(ofx);
});

app.post(
  "/api/transactions/import",
  authenticate,
  requireFeature("canUseReports"),
  upload.single("file"),
  async (req, res) => {
    const user = (req as any).user;
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });

    const isOfx = /\.(ofx|qfx)$/i.test(req.file.originalname);
    let rows;
    try {
      rows = isOfx
        ? parseOfxTransactions(req.file.buffer.toString("utf-8"))
        : parseCsvTransactions(req.file.buffer);
    } catch (err: any) {
      return res.status(400).json({ error: err.message || "Falha ao ler arquivo" });
    }
    if (rows.length === 0) {
      return res.status(400).json({ error: "Nenhuma transação reconhecida no arquivo" });
    }

    const plan = PLANS[user.plan] || PLANS.FREE;
    if (plan.transactionsLimit !== -1 && user.transactionsUsed + rows.length > plan.transactionsLimit) {
      return res.status(403).json({
        error: `Importar ${rows.length} transações excede o limite mensal do plano ${plan.name}.`,
        upgrade: true,
      });
    }

    const created = await prisma.$transaction(
      rows.map((r) =>
        prisma.transaction.create({
          data: {
            userId: user.id,
            title: r.title,
            amount: r.amount,
            type: r.type,
            category: r.category,
            date: r.date,
            description: "Importado via arquivo",
          },
        }),
      ),
    );
    await prisma.user.update({
      where: { id: user.id },
      data: { transactionsUsed: { increment: created.length } },
    });
    res.json({ imported: created.length });
  },
);

// ============================================================================
// SHARED-GOAL CONTRIBUTIONS (webhook on completion is handled in PUT /api/goals/:id)
// PUSH NOTIFICATIONS (Web Push — self-hosted, VAPID)
// ============================================================================
app.get("/api/push/vapid-public-key", (_req, res) => {
  const key = getVapidPublicKey();
  if (!key) return res.status(501).json({ error: "Push não configurado no servidor" });
  res.json({ publicKey: key });
});

const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

app.post("/api/push/subscribe", authenticate, async (req, res) => {
  if (!isPushConfigured) return res.status(501).json({ error: "Push não configurado no servidor" });
  const user = (req as any).user;
  const data = pushSubscribeSchema.parse(req.body);
  await prisma.pushSubscription.upsert({
    where: { endpoint: data.endpoint },
    create: { userId: user.id, endpoint: data.endpoint, p256dh: data.keys.p256dh, auth: data.keys.auth },
    update: { userId: user.id, p256dh: data.keys.p256dh, auth: data.keys.auth },
  });
  res.status(201).json({ ok: true });
});

app.post("/api/push/unsubscribe", authenticate, async (req, res) => {
  const { endpoint } = z.object({ endpoint: z.string() }).parse(req.body);
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  res.json({ ok: true });
});

app.post("/api/push/test", authenticate, async (req, res) => {
  const user = (req as any).user;
  await sendPushToUser(user.id, { title: "Finix", body: "Notificação de teste — tudo funcionando!" });
  res.json({ ok: true });
});

// ============================================================================
// OUTBOUND WEBHOOKS
// ============================================================================
const webhookSchema = z.object({
  url: z.string().url(),
  events: z.array(
    z.enum([
      "transaction.created",
      "transaction.deleted",
      "goal.created",
      "goal.completed",
      "installment.created",
      "alert.due_soon",
    ]),
  ).min(1),
});

app.get("/api/webhooks", authenticate, async (req, res) => {
  const user = (req as any).user;
  const webhooks = await prisma.webhookSubscription.findMany({ where: { userId: user.id } });
  res.json(webhooks.map((w) => ({ ...w, events: JSON.parse(w.events) })));
});

app.post("/api/webhooks", authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = webhookSchema.parse(req.body);
  const secret = generateWebhookSecret();
  const webhook = await prisma.webhookSubscription.create({
    data: { userId: user.id, url: data.url, events: JSON.stringify(data.events), secret },
  });
  // The signing secret is only ever returned here, at creation time.
  res.status(201).json({ ...webhook, events: data.events });
});

app.delete("/api/webhooks/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const deleted = await prisma.webhookSubscription.deleteMany({
    where: { id: String(req.params.id), userId: user.id },
  });
  if (deleted.count === 0) return res.status(404).json({ error: "Webhook não encontrado" });
  res.json({ ok: true });
});

// ============================================================================
// API KEYS — programmatic read access (Zapier, planilhas, scripts)
// ============================================================================
app.get("/api/api-keys", authenticate, async (req, res) => {
  const user = (req as any).user;
  const keys = await prisma.apiKey.findMany({
    where: { userId: user.id },
    select: { id: true, label: true, keyPrefix: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(keys);
});

app.post("/api/api-keys", authenticate, async (req, res) => {
  const user = (req as any).user;
  const { label } = z.object({ label: z.string().min(1).max(60) }).parse(req.body);
  const rawKey = `fnx_${crypto.randomBytes(24).toString("hex")}`;
  const keyPrefix = rawKey.slice(0, 12);
  const keyHash = await bcrypt.hash(rawKey, 10);
  const keyFingerprint = crypto.createHash("sha256").update(rawKey).digest("hex");

  await prisma.apiKey.create({
    data: { userId: user.id, label, keyPrefix, keyHash, keyFingerprint },
  });
  // Raw key shown exactly once — same pattern as the webhook secret above.
  res.status(201).json({ key: rawKey, label, keyPrefix });
});

app.delete("/api/api-keys/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const deleted = await prisma.apiKey.deleteMany({
    where: { id: String(req.params.id), userId: user.id },
  });
  if (deleted.count === 0) return res.status(404).json({ error: "Chave não encontrada" });
  res.json({ ok: true });
});

// ============================================================================
// OPEN FINANCE (Pluggy) — connected bank accounts.
// Every route 501s until PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET are set.
// ============================================================================
app.post("/api/open-finance/connect-token", authenticate, async (req, res) => {
  if (!openFinance.isConfigured) {
    return res.status(501).json({
      error: "Conexão bancária não configurada. Defina PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET.",
    });
  }
  const user = (req as any).user;
  try {
    const accessToken = await openFinance.createConnectToken(user.id);
    res.json({ accessToken });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

// Called by Pluggy after the user finishes connecting their bank in the
// widget (frontend passes the resulting itemId here — Pluggy also supports
// a server-to-server webhook for the same event, wireable later at
// dashboard.pluggy.ai once this endpoint has a public URL).
app.post("/api/open-finance/connections", authenticate, async (req, res) => {
  if (!openFinance.isConfigured) {
    return res.status(501).json({ error: "Conexão bancária não configurada." });
  }
  const user = (req as any).user;
  const { itemId } = z.object({ itemId: z.string() }).parse(req.body);
  try {
    const item = (await openFinance.fetchItem(itemId)) as any;
    const connection = await prisma.externalConnection.upsert({
      where: { itemId },
      create: {
        userId: user.id,
        itemId,
        status: item.status || "connected",
        institution: item.connector?.name || null,
      },
      update: { status: item.status || "connected" },
    });
    res.status(201).json(connection);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/open-finance/connections", authenticate, async (req, res) => {
  const user = (req as any).user;
  const connections = await prisma.externalConnection.findMany({
    where: { userId: user.id },
    include: { accounts: true },
  });
  res.json(connections);
});

app.post("/api/open-finance/connections/:id/sync", authenticate, async (req, res) => {
  if (!openFinance.isConfigured) {
    return res.status(501).json({ error: "Conexão bancária não configurada." });
  }
  const user = (req as any).user;
  const connection = await prisma.externalConnection.findFirst({
    where: { id: String(req.params.id), userId: user.id },
  });
  if (!connection) return res.status(404).json({ error: "Conexão não encontrada" });

  try {
    const accounts = (await openFinance.fetchAccounts(connection.itemId)) as any[];
    for (const acc of accounts) {
      await prisma.externalAccount.upsert({
        where: { id: `${connection.id}:${acc.id}` },
        create: {
          id: `${connection.id}:${acc.id}`,
          connectionId: connection.id,
          externalId: acc.id,
          name: acc.name || "Conta",
          balance: acc.balance || 0,
          currency: acc.currencyCode || "BRL",
        },
        update: { balance: acc.balance || 0 },
      });
    }
    await prisma.externalConnection.update({
      where: { id: connection.id },
      data: { lastSyncedAt: new Date() },
    });
    res.json({ accounts: accounts.length });
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

app.delete("/api/open-finance/connections/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const deleted = await prisma.externalConnection.deleteMany({
    where: { id: String(req.params.id), userId: user.id },
  });
  if (deleted.count === 0) return res.status(404).json({ error: "Conexão não encontrada" });
  res.json({ ok: true });
});

// ============================================================================
// PREVISÃO DE APERTO FINANCEIRO
// ============================================================================
app.get("/api/forecast", authenticate, async (req, res) => {
  const user = (req as any).user;
  const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
  const forecast = await buildForecast(user.id, days);
  res.json(forecast);
});

// ============================================================================
// CAÇA-FANTASMA DE ASSINATURAS
// ============================================================================
app.get("/api/subscriptions/detected", authenticate, async (req, res) => {
  const user = (req as any).user;
  const detected = await detectZombieSubscriptions(user.id);
  res.json(detected);
});

app.post("/api/subscriptions/dismiss", authenticate, async (req, res) => {
  const user = (req as any).user;
  const { signature } = z.object({ signature: z.string() }).parse(req.body);
  await prisma.subscriptionInsightDismissal.upsert({
    where: { userId_signature: { userId: user.id, signature } },
    create: { userId: user.id, signature },
    update: {},
  });
  res.json({ ok: true });
});

app.post("/api/subscriptions/convert", authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = z
    .object({ title: z.string().min(1), amount: z.number().positive(), category: z.string().min(1) })
    .parse(req.body);
  const rule = await prisma.recurringTransaction.create({
    data: {
      userId: user.id,
      title: data.title,
      amount: data.amount,
      type: "EXPENSE",
      category: data.category,
      frequency: "monthly",
      startDate: new Date(),
      nextRunDate: computeNextRunDate(new Date(), "monthly"),
    },
  });
  res.status(201).json(rule);
});

// ============================================================================
// ROUND-UP ("ARREDONDAMENTO") E MODO AUTÔNOMO/MEI — configurações
// ============================================================================
app.put("/api/settings/roundup", authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = z
    .object({ enabled: z.boolean(), goalId: z.string().nullable().optional() })
    .parse(req.body);
  await prisma.user.update({
    where: { id: user.id },
    data: { roundUpEnabled: data.enabled, roundUpGoalId: data.enabled ? data.goalId : null },
  });
  res.json({ ok: true });
});

app.put("/api/settings/autonomous", authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = z
    .object({
      isAutonomous: z.boolean(),
      taxRegime: z.enum(["MEI", "CARNE_LEAO"]).nullable().optional(),
      meiActivity: z.enum(["COMERCIO_INDUSTRIA", "SERVICOS", "COMERCIO_SERVICOS"]).nullable().optional(),
    })
    .parse(req.body);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      isAutonomous: data.isAutonomous,
      taxRegime: data.isAutonomous ? data.taxRegime : null,
      meiActivity: data.isAutonomous ? data.meiActivity : null,
    },
  });
  res.json({ ok: true });
});

app.get("/api/tax/estimate", authenticate, async (req, res) => {
  const user = (req as any).user;
  if (!user.isAutonomous || !user.taxRegime) {
    return res.status(400).json({ error: "Modo Autônomo não está ativado. Configure em /api/settings/autonomous." });
  }
  const current = await refreshCurrentMonthEstimate(user.id);
  const history = await prisma.taxObligation.findMany({
    where: { userId: user.id },
    orderBy: { referenceMonth: "desc" },
    take: 12,
  });
  const clients = current ? await clientBreakdown(user.id, current.referenceMonth) : [];
  res.json({
    current,
    history,
    clients,
    disclaimer:
      "Estimativa de planejamento — confira o valor oficial no app MEI (Portal do Empreendedor) ou no Carnê-Leão da Receita Federal antes de pagar.",
  });
});

app.post("/api/tax/:id/mark-paid", authenticate, async (req, res) => {
  const user = (req as any).user;
  const updated = await prisma.taxObligation.updateMany({
    where: { id: String(req.params.id), userId: user.id },
    data: { paid: true, paidAt: new Date() },
  });
  if (updated.count === 0) return res.status(404).json({ error: "Obrigação não encontrada" });
  res.json({ ok: true });
});

// ============================================================================
// DÍVIDAS — priorização avalanche/snowball
// ============================================================================
const debtSchema = z.object({
  creditor: z.string().min(1).max(120),
  totalAmount: z.number().positive(),
  remainingAmount: z.number().min(0),
  interestRate: z.number().min(0).optional().default(0),
  minPayment: z.number().min(0).optional().default(0),
  dueDay: z.number().min(1).max(31).optional().nullable(),
  negotiationUrl: z.string().url().optional().nullable(),
});

app.get("/api/debts", authenticate, async (req, res) => {
  const user = (req as any).user;
  const debts = await prisma.debt.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  res.json(debts);
});

app.post("/api/debts", authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = debtSchema.parse(req.body);
  const debt = await prisma.debt.create({ data: { ...data, userId: user.id } });
  res.status(201).json(debt);
});

app.put("/api/debts/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = debtSchema.partial().parse(req.body);
  const updated = await prisma.debt.updateMany({
    where: { id: String(req.params.id), userId: user.id },
    data: { ...data, paidOff: data.remainingAmount === 0 ? true : undefined },
  });
  if (updated.count === 0) return res.status(404).json({ error: "Dívida não encontrada" });
  res.json({ ok: true });
});

app.delete("/api/debts/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const deleted = await prisma.debt.deleteMany({ where: { id: String(req.params.id), userId: user.id } });
  if (deleted.count === 0) return res.status(404).json({ error: "Dívida não encontrada" });
  res.json({ ok: true });
});

app.get("/api/debts/strategy", authenticate, async (req, res) => {
  const user = (req as any).user;
  const method = req.query.method === "snowball" ? "snowball" : "avalanche";
  const extraPayment = Math.max(0, Number(req.query.extraPayment) || 0);
  const debts = await prisma.debt.findMany({ where: { userId: user.id, paidOff: false } });
  const order = prioritizeDebts(debts, method);
  const payoff = simulatePayoff(debts, method, extraPayment);
  res.json({ method, order: order.map((d) => d.id), payoff });
});

// ============================================================================
// PAUSA DE 24H PRA COMPRA POR IMPULSO
// ============================================================================
app.get("/api/transactions/impulse-review", authenticate, async (req, res) => {
  const user = (req as any).user;
  const items = await prisma.transaction.findMany({
    where: { userId: user.id, flaggedImpulse: true, reflectedAt: null },
    orderBy: { createdAt: "desc" },
  });
  res.json(items);
});

app.post("/api/transactions/:id/reflect", authenticate, async (req, res) => {
  const user = (req as any).user;
  const updated = await prisma.transaction.updateMany({
    where: { id: String(req.params.id), userId: user.id },
    data: { reflectedAt: new Date() },
  });
  if (updated.count === 0) return res.status(404).json({ error: "Transação não encontrada" });
  res.json({ ok: true });
});

// ============================================================================
// DESAFIOS EM GRUPO
// ============================================================================
app.get("/api/challenges", authenticate, async (req, res) => {
  const user = (req as any).user;
  const challenges = await prisma.challenge.findMany({
    where: { OR: [{ creatorId: user.id }, { participants: { some: { userId: user.id } } }] },
    include: {
      participants: { include: { user: { select: { id: true, name: true } } }, orderBy: { progressAmount: "desc" } },
      creator: { select: { id: true, name: true } },
    },
    orderBy: { startDate: "desc" },
  });
  res.json(challenges);
});

app.post("/api/challenges", authenticate, async (req, res) => {
  const user = (req as any).user;
  const data = z
    .object({
      title: z.string().min(1).max(120),
      targetAmount: z.number().positive(),
      startDate: z.string().transform((s) => new Date(s)),
      endDate: z.string().transform((s) => new Date(s)),
    })
    .parse(req.body);
  const challenge = await prisma.challenge.create({
    data: { ...data, creatorId: user.id, participants: { create: { userId: user.id } } },
    include: { participants: true },
  });
  res.status(201).json(challenge);
});

app.post("/api/challenges/:id/join", authenticate, async (req, res) => {
  const user = (req as any).user;
  const challenge = await prisma.challenge.findUnique({ where: { id: String(req.params.id) } });
  if (!challenge) return res.status(404).json({ error: "Desafio não encontrado" });
  const participant = await prisma.challengeParticipant.upsert({
    where: { challengeId_userId: { challengeId: challenge.id, userId: user.id } },
    create: { challengeId: challenge.id, userId: user.id },
    update: {},
  });
  res.status(201).json(participant);
});

app.put("/api/challenges/:id/progress", authenticate, async (req, res) => {
  const user = (req as any).user;
  const { amount } = z.object({ amount: z.number() }).parse(req.body);
  const updated = await prisma.challengeParticipant.updateMany({
    where: { challengeId: String(req.params.id), userId: user.id },
    data: { progressAmount: { increment: amount } },
  });
  if (updated.count === 0) return res.status(404).json({ error: "Você não participa deste desafio" });
  res.json({ ok: true });
});

app.delete("/api/challenges/:id", authenticate, async (req, res) => {
  const user = (req as any).user;
  const deleted = await prisma.challenge.deleteMany({ where: { id: String(req.params.id), creatorId: user.id } });
  if (deleted.count === 0) return res.status(404).json({ error: "Desafio não encontrado" });
  res.json({ ok: true });
});

// ============================================================================
// ADMIN
// ============================================================================
app.get("/api/users", authenticate, requireAdmin, async (req, res) => {
  const { search } = req.query;
  const where: any = {};
  if (search)
    where.OR = [
      { name: { contains: search as string } },
      { email: { contains: search as string } },
    ];
  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  res.json(users.map(userPublic));
});

app.get("/api/users/:id", authenticate, requireAdmin, async (req, res) => {
  const userId = String(req.params.id);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
  const transactions = await prisma.transaction.findMany({ where: { userId } });
  const goals = await prisma.goal.findMany({ where: { userId } });
  const categories = await prisma.category.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });
  // Admin's single-user edit view needs the actual image to preview/replace
  // it — unlike the hot auth paths, this is a one-off fetch, so the size is fine.
  res.json({
    user: { ...userPublic(user), photo: user.photo, companyLogo: user.companyLogo },
    transactions,
    goals,
    categories,
  });
});

app.put("/api/users/:id", authenticate, requireAdmin, async (req, res) => {
  const data = userUpdateSchema.parse(req.body);
  const userId = String(req.params.id);
  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser)
    return res.status(404).json({ error: "Usuário não encontrado" });
  const { categories, ...updateData } = data;
  if (
    data.plan === "PRO" &&
    targetUser.plan !== "PRO" &&
    data.hasCompletedOnboarding === undefined
  )
    updateData.hasCompletedOnboarding = false;
  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });
  if (categories) {
    const uniqueCategories = Array.from(
      new Set(categories.map((name) => name.trim()).filter(Boolean)),
    );
    await prisma.category.deleteMany({ where: { userId } });
    if (uniqueCategories.length)
      await prisma.category.createMany({
        data: uniqueCategories.map((name) => ({ userId, name })),
      });
  }
  res.json(userPublic(updated));
});

app.delete("/api/users/:id", authenticate, requireAdmin, async (req, res) => {
  const admin = (req as any).user;
  if (req.params.id === admin.id)
    return res.status(400).json({ error: "Não é possível deletar a si mesmo" });
  await prisma.user.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});

app.get("/api/admin/stats", authenticate, requireAdmin, async (_req, res) => {
  const totalUsers = await prisma.user.count();
  const totalAdmins = await prisma.user.count({ where: { role: "ADMIN" } });
  const totalBlocked = await prisma.user.count({ where: { blocked: true } });
  const totalTx = await prisma.transaction.count();
  const totalGoals = await prisma.goal.count();
  const freeUsers = await prisma.user.count({ where: { plan: "FREE" } });
  const basicUsers = await prisma.user.count({ where: { plan: "BASIC" } });
  const proUsers = await prisma.user.count({ where: { plan: "PRO" } });
  const paidTxs = await prisma.paymentTransaction.findMany({
    where: { paymentStatus: "paid" },
  });
  const totalRevenue = paidTxs.reduce((s, t) => s + t.amount, 0);
  const agg = await prisma.transaction.groupBy({
    by: ["type"],
    _sum: { amount: true },
  });
  const income = agg.find((a) => a.type === "INCOME")?._sum.amount || 0;
  const expense = agg.find((a) => a.type === "EXPENSE")?._sum.amount || 0;
  res.json({
    totalUsers,
    totalAdmins,
    blockedUsers: totalBlocked,
    totalTransactions: totalTx,
    totalGoals,
    globalIncome: income,
    globalExpense: expense,
    freeUsers,
    basicUsers,
    proUsers,
    totalRevenue,
  });
});

// ============================================================================
// AI INSIGHTS
// ============================================================================
app.post(
  "/api/insights/ai",
  authenticate,
  requireFeature("hasAI"),
  async (req, res) => {
    const user = (req as any).user;
    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
    });
    const goals = await prisma.goal.findMany({ where: { userId: user.id } });

    if (transactions.length === 0) {
      return res.json({
        insights: [
          {
            type: "info",
            title: "Sem dados suficientes",
            message:
              "Adicione algumas transações para receber análises personalizadas.",
          },
        ],
      });
    }

    const incomeTx = transactions.filter((t) => t.type === "INCOME");
    const expenseTx = transactions.filter((t) => t.type === "EXPENSE");
    const income = incomeTx.reduce((sum, t) => sum + t.amount, 0);
    const expense = expenseTx.reduce((sum, t) => sum + t.amount, 0);
    const balance = income - expense;
    const spendRatio = income > 0 ? expense / income : 1;
    const avgExpense = expenseTx.length > 0 ? expense / expenseTx.length : 0;
    const topCategory = expenseTx.reduce(
      (acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      },
      {} as Record<string, number>,
    );
    const bestCategory = Object.entries(topCategory).sort(
      (a, b) => b[1] - a[1],
    )[0];
    const now = new Date();
    const recentExpenses = expenseTx.filter(
      (t) =>
        (now.getTime() - new Date(t.date).getTime()) / (1000 * 60 * 60 * 24) <=
        14,
    );

    const localInsights: any[] = [];
    if (income === 0)
      localInsights.push({
        type: "warning",
        title: "Atenção, sem receita registrada",
        message: "Ainda não há nenhuma receita cadastrada.",
      });
    else if (spendRatio >= 0.9)
      localInsights.push({
        type: "warning",
        title: "Cuidado, seus gastos estão muito altos",
        message: `Você já gastou ${(spendRatio * 100).toFixed(0)}% da sua renda registrada.`,
      });
    else if (spendRatio >= 0.75)
      localInsights.push({
        type: "warning",
        title: "Atenção, a dívida do mês pode apertar",
        message: `Seu ritmo de despesas consome ${(spendRatio * 100).toFixed(0)}% da renda.`,
      });
    else if (spendRatio >= 0.5)
      localInsights.push({
        type: "info",
        title: "Bom controle, mas fique atento",
        message: `Você usou ${(spendRatio * 100).toFixed(0)}% da sua renda.`,
      });
    else
      localInsights.push({
        type: "success",
        title: "Ótimo, seu orçamento está equilibrado",
        message: `Suas despesas representam ${(spendRatio * 100).toFixed(0)}% da receita.`,
      });

    if (bestCategory && bestCategory[1] > 0 && expense > 0) {
      const categoryRatio = (bestCategory[1] / expense) * 100;
      if (categoryRatio >= 35)
        localInsights.push({
          type: "warning",
          title: `Atenção: ${bestCategory[0]} domina seus gastos`,
          message: `${bestCategory[0]} responde por ${categoryRatio.toFixed(0)}% das despesas.`,
        });
    }
    if (recentExpenses.length >= 3 && avgExpense > 0) {
      const recentAvg =
        recentExpenses.reduce((sum, t) => sum + t.amount, 0) /
        recentExpenses.length;
      if (recentAvg > avgExpense)
        localInsights.push({
          type: "info",
          title: "Últimos gastos acima da média",
          message:
            "Nas últimas duas semanas você gastou mais do que a sua média habitual.",
        });
    }
    if (balance < 0)
      localInsights.push({
        type: "warning",
        title: "Seu saldo está negativo",
        message: "As despesas superam sua renda registrada.",
      });
    if (goals.length > 0 && spendRatio > 0.6)
      localInsights.push({
        type: "info",
        title: "Meta em risco de atraso",
        message:
          "Com gastos acima de 60% da renda, pode ficar mais difícil atingir metas financeiras.",
      });

    try {
      const apiKey = process.env.EMERGENT_LLM_KEY;
      if (!apiKey) return res.json({ insights: localInsights.slice(0, 4) });

      const summary = transactions
        .slice(0, 12)
        .map(
          (t) =>
            `${t.title}: R$ ${t.amount.toFixed(2)} (${t.type}/${t.category})`,
        )
        .join(", ");
      const prompt = `Você é a assistente financeira do Finix. Analise os dados abaixo e gere 4 insights em português no estilo de uma conversa clara e prática.
Renda total: R$ ${income.toFixed(2)}
Despesas totais: R$ ${expense.toFixed(2)}
Saldo: R$ ${balance.toFixed(2)}
Porcentagem de renda gasta: ${(spendRatio * 100).toFixed(0)}%
Metas cadastradas: ${goals.length}
Últimas transações: ${summary}
Responda apenas com JSON válido no formato:
{ "insights": [{ "type": "success|warning|info", "title": "...", "message": "..." }] }`;

      const response = await fetch(
        "https://integrations.emergentagent.com/llm/v1/messages",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 800,
            messages: [{ role: "user", content: prompt }],
          }),
        },
      );

      const data = (await response.json()) as any;
      let insights: any[] = localInsights.slice(0, 4);
      if (data.content?.[0]) {
        try {
          const jsonMatch = data.content[0].text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed?.insights && Array.isArray(parsed.insights))
              insights = parsed.insights;
          }
        } catch {
          /* usa fallback */
        }
      }
      res.json({ insights });
    } catch (err) {
      console.error("AI Error:", err);
      res.json({ insights: localInsights.slice(0, 4) });
    }
  },
);

// ============================================================================
// EXPORTS (PDF / Excel)
// ============================================================================
app.get(
  "/api/export/pdf",
  authenticate,
  requireFeature("hasPDF"),
  async (req, res) => {
    const user = (req as any).user;
    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
    });
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="finix-relatorio.pdf"',
      );
      res.send(Buffer.concat(chunks));
    });

    const totalIncome = transactions
      .filter((t) => t.type === "INCOME")
      .reduce((s, t) => s + t.amount, 0);
    const totalExpense = transactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((s, t) => s + t.amount, 0);
    const totalNet = totalIncome - totalExpense;

    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor("#111827")
      .text("Relatório Finix — Transações", { align: "left" });
    doc.moveDown(0.6);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#475569")
      .text(`Usuário: ${user.name} (${user.email})`);
    doc.text(`Plano: ${PLANS[user.plan]?.name || user.plan}`);
    doc.text(`Data de geração: ${new Date().toLocaleDateString("pt-BR")}`);
    doc.moveDown(0.8);

    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#111827")
      .text("Resumo", { underline: true });
    doc.moveDown(0.4);

    const summaryRows = [
      { label: "Total de transações", value: `${transactions.length}` },
      { label: "Receitas totais", value: `R$ ${totalIncome.toFixed(2)}` },
      { label: "Despesas totais", value: `R$ ${totalExpense.toFixed(2)}` },
      { label: "Saldo líquido", value: `R$ ${totalNet.toFixed(2)}` },
    ];

    summaryRows.forEach((row) => {
      const y = doc.y;
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#374151")
        .text(row.label, 40, y);
      doc
        .font("Helvetica-Bold")
        .text(row.value, 450, y, { width: 110, align: "right" });
      doc.moveDown(0.9);
    });

    doc.moveDown(0.6);
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#111827")
      .text("Transações", { underline: true });
    doc.moveDown(0.6);

    const tableTop = doc.y;
    const columnPositions = {
      date: 40,
      title: 120,
      type: 310,
      category: 390,
      value: 490,
    };

    doc.save();
    doc
      .fillColor("#f8fafc")
      .rect(40, tableTop - 4, 510, 22)
      .fill();
    doc.restore();

    doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827");
    doc.text("Data", columnPositions.date, tableTop, { width: 80 });
    doc.text("Título", columnPositions.title, tableTop, { width: 180 });
    doc.text("Tipo", columnPositions.type, tableTop, { width: 80 });
    doc.text("Categoria", columnPositions.category, tableTop, { width: 90 });
    doc.text("Valor", columnPositions.value, tableTop, {
      width: 90,
      align: "right",
    });
    doc.moveDown(1.1);

    doc
      .strokeColor("#e5e7eb")
      .lineWidth(0.5)
      .moveTo(40, doc.y)
      .lineTo(550, doc.y)
      .stroke();
    doc.moveDown(0.5);

    doc.font("Helvetica").fontSize(10).fillColor("#1f2937");
    if (transactions.length === 0) {
      doc.text("Nenhuma transação encontrada.", 40, doc.y);
    } else {
      transactions.forEach((t) => {
        const y = doc.y;
        doc.text(
          new Date(t.date).toLocaleDateString("pt-BR"),
          columnPositions.date,
          y,
          { width: 80 },
        );
        doc.text(t.title || "-", columnPositions.title, y, { width: 180 });
        doc.text(t.type, columnPositions.type, y, { width: 80 });
        doc.text(t.category || "-", columnPositions.category, y, { width: 90 });
        doc.text(`R$ ${t.amount.toFixed(2)}`, columnPositions.value, y, {
          width: 90,
          align: "right",
        });
        doc.moveDown(0.8);
        if (doc.y > 720) {
          doc.addPage();
        }
      });
    }

    doc.end();
  },
);

app.get(
  "/api/export/excel",
  authenticate,
  requireFeature("hasExcel"),
  async (req, res) => {
    const user = (req as any).user;
    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
    });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Transações");
    sheet.columns = [
      { header: "Data", key: "date", width: 15 },
      { header: "Título", key: "title", width: 35 },
      { header: "Tipo", key: "type", width: 12 },
      { header: "Categoria", key: "category", width: 18 },
      { header: "Valor", key: "amount", width: 14 },
    ];
    sheet.addRows(
      transactions.map((t) => ({
        date: new Date(t.date).toLocaleDateString("pt-BR"),
        title: t.title,
        type: t.type,
        category: t.category,
        amount: t.amount,
      })),
    );
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="finix-transacoes.xlsx"',
    );
    res.send(Buffer.from(buffer));
  },
);

// ============================================================================
// INTERNAL API
// ============================================================================
const INTERNAL_SECRET = process.env.JWT_SECRET || "finix-dev-secret";

// Constant-time compare — a plain `!==` leaks timing information proportional
// to how many leading bytes match, which is enough to brute-force a secret
// byte-by-byte. These routes have no user-level auth at all (they're the
// gateway's server-to-server trust boundary), so this header is the only gate.
const verifyInternalSecret = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  const provided = String(req.headers["x-internal-secret"] || "");
  const expected = INTERNAL_SECRET;
  const ok =
    provided.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!ok) return res.status(401).json({ error: "unauthorized" });
  next();
};

app.post("/internal/update-user-plan", verifyInternalSecret, async (req, res) => {
  const {
    userId,
    plan,
    stripeCustomerId,
    stripeSubscriptionId,
    planExpiresAt,
  } = req.body;
  if (!userId) return res.status(400).json({ error: "userId obrigatório" });
  const updates: any = {};
  if (plan) {
    if (!PLANS[plan]) return res.status(400).json({ error: "plano inválido" });
    updates.plan = plan;
  }
  if (stripeCustomerId !== undefined)
    updates.stripeCustomerId = stripeCustomerId;
  if (stripeSubscriptionId !== undefined)
    updates.stripeSubscriptionId = stripeSubscriptionId;
  if (planExpiresAt !== undefined)
    updates.planExpiresAt = planExpiresAt ? new Date(planExpiresAt) : null;
  const user = await prisma.user.update({
    where: { id: userId },
    data: updates,
  });
  res.json(userPublic(user));
});

app.post("/internal/create-payment-tx", verifyInternalSecret, async (req, res) => {
  const { userId, userEmail, sessionId, amount, currency, plan, metadata } =
    req.body;
  const tx = await prisma.paymentTransaction.create({
    data: {
      id: uuidv4(),
      userId,
      userEmail,
      sessionId,
      amount,
      currency: currency || "brl",
      plan,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
  res.json(tx);
});

app.post("/internal/update-payment-tx", verifyInternalSecret, async (req, res) => {
  const { sessionId, paymentStatus, status, stripePaymentId } = req.body;
  const existing = await prisma.paymentTransaction.findUnique({
    where: { sessionId },
  });
  if (!existing) return res.status(404).json({ error: "not found" });
  const tx = await prisma.paymentTransaction.update({
    where: { sessionId },
    data: {
      paymentStatus: paymentStatus || existing.paymentStatus,
      status: status || existing.status,
      stripePaymentId: stripePaymentId || existing.stripePaymentId,
    },
  });
  res.json({ ...tx, previousStatus: existing.paymentStatus });
});

app.get("/internal/user-by-id/:id", verifyInternalSecret, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: String(req.params.id) },
  });
  if (!user) return res.status(404).json({ error: "not found" });
  res.json(userPublic(user));
});

app.get("/internal/payment-tx/:sessionId", verifyInternalSecret, async (req, res) => {
  const tx = await prisma.paymentTransaction.findUnique({
    where: { sessionId: String(req.params.sessionId) },
  });
  if (!tx) return res.status(404).json({ error: "not found" });
  res.json(tx);
});

// ============================================================================
// STRIPE
// ============================================================================
app.post("/api/stripe/checkout", authenticate, async (req, res) => {
  if (!stripe) return res.status(500).json({ error: "Stripe não configurado" });
  try {
    const { plan_id } = req.body;
    const user = (req as any).user;
    if (!["BASIC", "PRO", "TEST"].includes(plan_id))
      return res.status(400).json({ error: "Plano inválido" });
    const plan = PLANS[plan_id as keyof typeof PLANS];
    if (!plan) return res.status(400).json({ error: "Plano inválido" });

    if (!plan.stripePriceId) {
      if (plan_id === "TEST") {
        const sessionId = `test-session-${Date.now()}`;
        await prisma.user.update({
          where: { id: user.id },
          data: { plan: "TEST" },
        });
        await prisma.paymentTransaction.create({
          data: {
            userId: user.id,
            userEmail: user.email,
            sessionId,
            amount: plan.price,
            currency: "BRL",
            plan: plan_id,
            paymentStatus: "paid",
            stripePaymentId: sessionId,
          },
        });
        return res.json({
          url: `${FRONTEND_URL}/app/dashboard?success=true&session_id=${sessionId}`,
          sessionId,
        });
      }
      return res.status(400).json({ error: "Plano não configurado no Stripe" });
    }

    let customer;
    if (user.stripeCustomerId) {
      customer = await stripe.customers.retrieve(user.stripeCustomerId);
    } else {
      customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
      });
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customer.id },
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ["card"],
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${FRONTEND_URL}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/plans?canceled=true`,
      metadata: { userId: user.id, plan: plan_id },
    });

    await prisma.paymentTransaction.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        sessionId: session.id,
        amount: plan.price,
        currency: "BRL",
        plan: plan_id,
        paymentStatus: "pending",
        stripePaymentId: session.id,
      },
    });

    res.json({ url: session.url, sessionId: session.id });
  } catch (err: any) {
    console.error("Stripe checkout error:", err);
    res.status(500).json({ error: err.message || "Erro ao criar checkout" });
  }
});

app.post("/api/stripe/change-plan", authenticate, async (req, res) => {
  if (!stripe) return res.status(500).json({ error: "Stripe não configurado" });
  const user = (req as any).user;
  const { plan_id } = req.body;
  if (!["BASIC", "PRO"].includes(plan_id))
    return res
      .status(400)
      .json({ error: "Plano inválido para mudança direta." });
  if (plan_id === user.plan)
    return res.status(400).json({ error: "Você já está neste plano." });
  if (!user.stripeSubscriptionId)
    return res.status(400).json({
      error: "Nenhuma assinatura ativa encontrada. Faça upgrade via checkout.",
    });
  const targetPlan = PLANS[plan_id];
  if (!targetPlan?.stripePriceId)
    return res
      .status(400)
      .json({ error: "Plano de destino não configurado no Stripe." });
  try {
    const subscription = await stripe.subscriptions.retrieve(
      user.stripeSubscriptionId,
    );
    const itemId = subscription.items.data[0]?.id;
    if (!itemId)
      return res
        .status(400)
        .json({ error: "Assinatura sem itens encontrada." });
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      items: [{ id: itemId, price: targetPlan.stripePriceId }],
      proration_behavior: "always_invoice",
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { plan: plan_id },
    });
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });
    return res.json({
      message: `Plano alterado para ${targetPlan.name} com sucesso.`,
      user: userPublic(updatedUser),
    });
  } catch (err: any) {
    console.error("Stripe change-plan error:", err);
    return res
      .status(500)
      .json({ error: err.message || "Erro ao alterar plano." });
  }
});

app.post("/api/stripe/cancel-subscription", authenticate, async (req, res) => {
  if (!stripe) return res.status(500).json({ error: "Stripe não configurado" });
  const user = (req as any).user;
  if (!user.stripeSubscriptionId)
    return res
      .status(400)
      .json({ error: "Nenhuma assinatura ativa encontrada para cancelar." });
  try {
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { plan: "FREE", stripeSubscriptionId: null, planExpiresAt: null },
    });
    return res.json({
      message:
        "Assinatura cancelada. Seu plano foi revertido para o plano gratuito.",
    });
  } catch (err: any) {
    console.error("Stripe cancel subscription error:", err);
    return res
      .status(500)
      .json({ error: err.message || "Erro ao cancelar a assinatura" });
  }
});

async function handleCheckoutCompleted(session: any) {
  const userId = session.metadata.userId;
  const plan = session.metadata.plan;
  await prisma.paymentTransaction.updateMany({
    where: { sessionId: session.id },
    data: {
      paymentStatus: "paid",
      status: "completed",
      stripePaymentId: session.payment_intent,
    },
  });
  const planExpiresAt = new Date();
  planExpiresAt.setMonth(planExpiresAt.getMonth() + 1);
  await prisma.user.update({
    where: { id: userId },
    data: { plan, stripeSubscriptionId: session.subscription, planExpiresAt },
  });
}

async function handleInvoicePaymentSucceeded(invoice: any) {
  const subscription = await stripe!.subscriptions.retrieve(
    invoice.subscription,
  );
  const customer = await stripe!.customers.retrieve(
    subscription.customer as string,
  );
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: (customer as any).id },
  });
  if (user) {
    const planExpiresAt = new Date();
    planExpiresAt.setMonth(planExpiresAt.getMonth() + 1);
    await prisma.user.update({
      where: { id: user.id },
      data: { planExpiresAt },
    });
  }
}

async function handleSubscriptionDeleted(subscription: any) {
  const customer = await stripe!.customers.retrieve(subscription.customer);
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: (customer as any).id },
  });
  if (user)
    await prisma.user.update({
      where: { id: user.id },
      data: { plan: "FREE", stripeSubscriptionId: null, planExpiresAt: null },
    });
}

// ============================================================================
// ERROR HANDLER GLOBAL
// ============================================================================
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("[ERROR]", err);
    // FIX 4: ZodError nunca vira 500
    if (err.name === "ZodError")
      return res
        .status(400)
        .json({ error: "Dados inválidos", details: err.errors });
    res.status(500).json({ error: err.message || "Erro interno" });
  },
);

// ============================================================================
// SERVER START — SEM SEED AUTOMÁTICO EM PRODUÇÃO
// ============================================================================

const PORT = Number(process.env.PORT) || 8000;

let httpServer: ReturnType<typeof app.listen> | null = null;
let isShuttingDown = false;

const connectDatabase = async (): Promise<void> => {
  const maxAttempts = 5;
  const retryDelayMs = 5000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;

      console.log("[DATABASE] ✅ Banco conectado com sucesso");
      return;
    } catch (error) {
      console.error(
        `[DATABASE] ❌ Falha ao conectar (${attempt}/${maxAttempts})`,
        error,
      );

      if (attempt === maxAttempts) {
        throw error;
      }

      await new Promise<void>((resolve) => {
        setTimeout(resolve, retryDelayMs);
      });
    }
  }
};
const createOrUpdateAdmin = async (): Promise<void> => {
  const adminEmail = (process.env.ADMIN_EMAIL || "finixappp@gmail.com")
    .trim()
    .toLowerCase();

  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123";
  if (!process.env.ADMIN_PASSWORD) {
    console.warn(
      "[ADMIN] ⚠️  ADMIN_PASSWORD não definido — usando a senha padrão 'Admin@123'. " +
        "Defina ADMIN_PASSWORD no ambiente com uma senha forte, especialmente em produção " +
        "(esta rotina roda a cada reinício e reescreve a senha do admin para o valor configurado aqui).",
    );
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: {
      email: adminEmail,
    },

    create: {
      id: uuidv4(),
      name: "Administrador Finix",
      email: adminEmail,
      passwordHash,
      role: "ADMIN",
      plan: "PRO",
      blocked: false,
      isVerified: true,
      verificationCode: null,
      verificationExpires: null,
      transactionsUsed: 0,
      transactionsMonth: currentMonthKey(),
      hasCompletedOnboarding: true,
      authProvider: "local",
    },

    update: {
      name: "Administrador Finix",
      passwordHash,
      role: "ADMIN",
      plan: "PRO",
      blocked: false,
      isVerified: true,
      verificationCode: null,
      verificationExpires: null,
    },
  });

  console.log(`[ADMIN] ✅ Administrador configurado: ${admin.email}`);
};

// Single-process in-memory scheduler: fires the recurring-transaction and
// due-alert jobs once at boot (catches up on anything missed while the
// server was down) and then once every 24h. Fine for the current one-replica
// deploy; would need to move to a real cron/queue (or a leader-election
// guard) if the backend ever scales to more than one instance, so it doesn't
// run the same job N times.
const DAY_MS = 24 * 60 * 60 * 1000;
const startBackgroundJobs = () => {
  const runJobs = async () => {
    try {
      const recurring = await runDueRecurringTransactions();
      const alerts = await sendDueAlertNotifications();
      const impulse = await sendDueImpulseReflections();
      console.log(
        `[JOBS] Recorrências criadas: ${recurring.created} · Alertas notificados: ${alerts.notified} · Reflexões de compra: ${impulse.notified}`,
      );
    } catch (err: any) {
      console.error("[JOBS] Falha ao rodar jobs agendados:", err.message);
    }
  };
  runJobs();
  setInterval(runJobs, DAY_MS);
};

const startServer = async (): Promise<void> => {
  try {
    await connectDatabase();

    // Cria ou atualiza a conta de administrador no banco atual
    await createOrUpdateAdmin();

    httpServer = app.listen(PORT, "0.0.0.0", () => {
      console.log(`
╔════════════════════════════════════════╗
║  Finix TS Backend                      ║
║  Rodando na porta ${PORT}
║  Environment: ${process.env.NODE_ENV || "development"}
╚════════════════════════════════════════╝
      `);

      console.log("[SERVER] CORS Origins:", allowedOrigins);
      console.log("[SERVER] Frontend URL:", FRONTEND_URL);
      console.log("[SERVER] JWT Secret configurado:", !!process.env.JWT_SECRET);
      console.log(
        "[SERVER] Database URL configurado:",
        !!process.env.DATABASE_URL,
      );
      console.log(
        "[SERVER] Stripe configurado:",
        !!process.env.STRIPE_SECRET_KEY,
      );
      console.log("[SERVER] ✅ Servidor pronto para requisições");
      startBackgroundJobs();
    });
  } catch (error) {
    console.error("[SERVER] ❌ Não foi possível iniciar a aplicação:", error);

    await prisma.$disconnect();
    process.exit(1);
  }
};

const shutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) return;

  isShuttingDown = true;
  console.log(`[SERVER] ${signal} recebido. Encerrando com segurança...`);

  const forceShutdownTimeout = setTimeout(() => {
    console.error("[SERVER] ❌ Encerramento forçado após 10 segundos");
    process.exit(1);
  }, 10000);

  forceShutdownTimeout.unref();

  try {
    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        httpServer?.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }

    await prisma.$disconnect();
    clearTimeout(forceShutdownTimeout);

    console.log("[SERVER] ✅ Aplicação encerrada corretamente");
    process.exit(0);
  } catch (error) {
    console.error("[SERVER] ❌ Erro durante o encerramento:", error);
    process.exit(1);
  }
};

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("unhandledRejection", (reason) => {
  console.error("[PROCESS] Promise rejeitada sem tratamento:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[PROCESS] Exceção não tratada:", error);
  void shutdown("uncaughtException");
});

void startServer();
