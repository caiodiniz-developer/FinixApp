import request from "supertest";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { app } from "../../src/app";
import { prisma } from "../../src/lib/prisma";
import { createAccessToken } from "../../src/services/tokenService";
import { assertLocalDatabase } from "./testDatabase";

// Second line of defence (the first is globalSetup): if this worker somehow
// ended up pointed at a remote database, stop before the first query.
assertLocalDatabase(process.env.DATABASE_URL || "");

export { app, prisma };

const DAY = 24 * 60 * 60 * 1000;

// One cheap hash for every test user — bcrypt is deliberately slow.
const PASSWORD = "segredo123";
let passwordHash: string | null = null;

interface UserOptions {
  plan?: "FREE" | "BASIC" | "PRO";
  role?: "USER" | "ADMIN";
  /** Days since the account was created. Default 30: past the 7-day trial. */
  ageDays?: number;
  planExpiresAt?: Date | null;
}

/**
 * Creates a user straight in the database and returns a ready-to-use client
 * for it. Going through POST /signup + /login for every test would trip the
 * login rate limiter (10 requests a minute).
 */
export const createUser = async (options: UserOptions = {}) => {
  passwordHash ??= await bcrypt.hash(PASSWORD, 4);
  const user = await prisma.user.create({
    data: {
      name: "Usuário Teste",
      email: `user-${randomUUID()}@test.local`,
      passwordHash,
      isVerified: true,
      plan: options.plan ?? "PRO",
      role: options.role ?? "USER",
      planExpiresAt: options.planExpiresAt ?? null,
      createdAt: new Date(Date.now() - (options.ageDays ?? 30) * DAY),
    },
  });
  const token = createAccessToken(user);
  const auth = { Authorization: `Bearer ${token}` };

  return {
    user,
    password: PASSWORD,
    token,
    get: (path: string) => request(app).get(path).set(auth),
    post: (path: string, body?: object) => request(app).post(path).set(auth).send(body),
    put: (path: string, body?: object) => request(app).put(path).set(auth).send(body),
    del: (path: string) => request(app).delete(path).set(auth),
  };
};

export type TestClient = Awaited<ReturnType<typeof createUser>>;

export const anonymous = () => request(app);

export const transaction = (over: Record<string, unknown> = {}) => ({
  title: "Mercado",
  amount: 120.5,
  type: "EXPENSE",
  category: "Alimentação",
  date: "2026-10-01",
  ...over,
});
