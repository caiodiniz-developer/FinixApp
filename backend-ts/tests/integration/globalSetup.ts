import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import { assertLocalDatabase, TEST_DATABASE_URL } from "./testDatabase";

/**
 * Prepares the throwaway database once per run: applies the Prisma schema and
 * empties every table.
 *
 * Because this deletes all data, it only ever runs against a database on
 * localhost. The project's own .env points at the production database — this
 * guard is what makes it impossible to wipe it by running the tests.
 */
export default async function globalSetup() {
  // Never read DATABASE_URL here: importing Prisma loads the project's .env,
  // and that one points at production.
  const url = TEST_DATABASE_URL;
  assertLocalDatabase(url);

  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: url },
  });

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    `;
    if (tables.length) {
      const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
    }
  } finally {
    await prisma.$disconnect();
  }
}
