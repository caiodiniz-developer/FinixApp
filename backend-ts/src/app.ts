import express from "express";
import helmet from "helmet";
import cors from "cors";
import "express-async-errors";
import cookieParser from "cookie-parser";
import { allowedOrigins } from "./config/env";
import authRoutes from "./routes/authRoutes";
import googleRoutes from "./routes/googleRoutes";
import twoFactorRoutes from "./routes/twoFactorRoutes";
import stripeWebhookRoutes from "./routes/stripeWebhookRoutes";
import profileRoutes from "./routes/profileRoutes";
import onboardingRoutes from "./routes/onboardingRoutes";
import planRoutes from "./routes/planRoutes";
import categoryRoutes from "./routes/categoryRoutes";
import transactionRoutes from "./routes/transactionRoutes";
import alertRoutes from "./routes/alertRoutes";
import calendarRoutes from "./routes/calendarRoutes";
import goalRoutes from "./routes/goalRoutes";
import budgetRoutes from "./routes/budgetRoutes";
import accountRoutes from "./routes/accountRoutes";
import cardRoutes from "./routes/cardRoutes";
import contactRoutes from "./routes/contactRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import recurringRoutes from "./routes/recurringRoutes";
import reportRoutes from "./routes/reportRoutes";
import pushRoutes from "./routes/pushRoutes";
import webhookRoutes from "./routes/webhookRoutes";
import apiKeyRoutes from "./routes/apiKeyRoutes";
import openFinanceRoutes from "./routes/openFinanceRoutes";
import insightRoutes from "./routes/insightRoutes";
import subscriptionRoutes from "./routes/subscriptionRoutes";
import settingsRoutes from "./routes/settingsRoutes";
import taxRoutes from "./routes/taxRoutes";
import debtRoutes from "./routes/debtRoutes";
import challengeRoutes from "./routes/challengeRoutes";
import netWorthRoutes from "./routes/netWorthRoutes";
import personalLoanRoutes from "./routes/personalLoanRoutes";
import householdRoutes from "./routes/householdRoutes";
import adminRoutes from "./routes/adminRoutes";
import internalRoutes from "./routes/internalRoutes";
import stripeRoutes from "./routes/stripeRoutes";

export const app = express();

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

app.use(cors(corsOptions));
app.use(cookieParser());

// Responde imediatamente a todo preflight OPTIONS — sem isso, o browser
// recebe 404 no preflight e bloqueia a requisição real.
app.options("*", cors(corsOptions));

// Stripe webhook precisa do body RAW, então vem antes do express.json()
app.use(stripeWebhookRoutes);

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

// Each router below declares its own full "/api/..." paths.
app.use(profileRoutes);
app.use(onboardingRoutes);
app.use(planRoutes);
app.use(categoryRoutes);
app.use(transactionRoutes);
app.use(alertRoutes);
app.use(calendarRoutes);
app.use(goalRoutes);
app.use(budgetRoutes);
app.use(accountRoutes);
app.use(cardRoutes);
app.use(contactRoutes);
app.use(dashboardRoutes);
app.use(recurringRoutes);
app.use(reportRoutes);
app.use(pushRoutes);
app.use(webhookRoutes);
app.use(apiKeyRoutes);
app.use(openFinanceRoutes);
app.use(insightRoutes);
app.use(subscriptionRoutes);
app.use(settingsRoutes);
app.use(taxRoutes);
app.use(debtRoutes);
app.use(challengeRoutes);
app.use(netWorthRoutes);
app.use(personalLoanRoutes);
app.use(householdRoutes);
app.use(adminRoutes);
app.use(internalRoutes);
app.use(stripeRoutes);

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
    // ZodError nunca vira 500
    if (err.name === "ZodError")
      return res
        .status(400)
        .json({ error: "Dados inválidos", details: err.errors });
    res.status(500).json({ error: err.message || "Erro interno" });
  },
);
