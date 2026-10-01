import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../lib/prisma";
import { currentMonthKey } from "./usageService";

const DEV_FALLBACK_PASSWORD = "Admin@123";

/**
 * Makes sure the admin account exists at boot.
 *
 * The password is only ever written from ADMIN_PASSWORD. When that variable
 * is missing, an existing admin keeps whatever password it already has, and
 * in production no admin is created at all — the old behaviour (reset the
 * admin to a publicly known default on every restart) was an open door.
 */
export const ensureAdminUser = async (): Promise<void> => {
  const adminEmail = (process.env.ADMIN_EMAIL || "finixappp@gmail.com").trim().toLowerCase();
  const configuredPassword = process.env.ADMIN_PASSWORD?.trim() || null;
  const isProduction = process.env.NODE_ENV === "production";

  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: "ADMIN",
        plan: "PRO",
        planExpiresAt: null,
        blocked: false,
        isVerified: true,
        verificationCode: null,
        verificationExpires: null,
        ...(configuredPassword ? { passwordHash: await bcrypt.hash(configuredPassword, 10) } : {}),
      },
    });
    if (!configuredPassword) {
      console.warn("[ADMIN] ADMIN_PASSWORD não definido — senha do admin mantida como está.");
    }
    console.log(`[ADMIN] ✅ Administrador configurado: ${adminEmail}`);
    return;
  }

  if (!configuredPassword && isProduction) {
    console.error(
      "[ADMIN] ❌ Nenhum admin existe e ADMIN_PASSWORD não está definido. " +
        "Defina ADMIN_EMAIL e ADMIN_PASSWORD no ambiente para criar a conta de administrador.",
    );
    return;
  }

  if (!configuredPassword) {
    console.warn(
      `[ADMIN] ⚠️  ADMIN_PASSWORD não definido — criando admin de desenvolvimento com a senha '${DEV_FALLBACK_PASSWORD}'.`,
    );
  }

  await prisma.user.create({
    data: {
      id: uuidv4(),
      name: "Administrador Finix",
      email: adminEmail,
      passwordHash: await bcrypt.hash(configuredPassword || DEV_FALLBACK_PASSWORD, 10),
      role: "ADMIN",
      plan: "PRO",
      blocked: false,
      isVerified: true,
      transactionsUsed: 0,
      transactionsMonth: currentMonthKey(),
      hasCompletedOnboarding: true,
      authProvider: "local",
    },
  });
  console.log(`[ADMIN] ✅ Administrador criado: ${adminEmail}`);
};
