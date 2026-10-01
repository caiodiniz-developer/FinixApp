import "./config/env";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { app } from "./app";
import { allowedOrigins, FRONTEND_URL } from "./config/env";
import { prisma } from "./lib/prisma";
import { ensureAdminUser } from "./services/adminBootstrap";
import { runDueRecurringTransactions } from "./services/recurringService";
import { sendDueAlertNotifications } from "./services/alertNotificationService";
import { sendDueImpulseReflections } from "./services/impulseReflectionService";

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
    await ensureAdminUser();

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
