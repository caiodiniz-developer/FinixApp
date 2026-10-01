import "./config/env";
import { app } from "./app";
import { allowedOrigins, FRONTEND_URL } from "./config/env";
import { prisma } from "./lib/prisma";
import { ensureAdminUser } from "./services/adminBootstrap";
import { startBackgroundJobs } from "./services/jobs";

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
