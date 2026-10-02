import { describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { anonymous, createUser, prisma } from "./helpers";

const newEmail = () => `novo-${randomUUID()}@test.local`;

describe("signup and login", () => {
  it("creates an account that can log in right away, with no e-mail confirmation", async () => {
    const email = newEmail();
    const signup = await anonymous().post("/api/auth/signup").send({ name: "Ana Souza", email, password: "segredo123" });
    expect(signup.status).toBe(201);

    const login = await anonymous().post("/api/auth/login").send({ email, password: "segredo123" });
    expect(login.status).toBe(200);
    expect(login.body.token).toEqual(expect.any(String));
    expect(login.body.refreshToken).toEqual(expect.any(String));
    expect(login.body.user).toMatchObject({ email, plan: "FREE" });
    // never leaks credentials
    expect(login.body.user).not.toHaveProperty("passwordHash");
  });

  it("gives a new FREE account the trial plan", async () => {
    const fresh = await createUser({ plan: "FREE", ageDays: 1 });
    const me = await fresh.get("/api/auth/me");
    expect(me.body.effectivePlan).toBe("BASIC");
    expect(me.body.trialEndsAt).toEqual(expect.any(String));
  });

  it("rejects invalid sign-up data", async () => {
    const bad = [
      { name: "Ana", email: "nao-e-email", password: "segredo123" },
      { name: "Ana", email: newEmail(), password: "123" },
      { name: "A", email: newEmail(), password: "segredo123" },
    ];
    for (const body of bad) {
      const res = await anonymous().post("/api/auth/signup").send(body);
      expect(res.status).toBe(400);
    }
  });

  it("refuses a duplicate e-mail and a wrong password", async () => {
    const existing = await createUser();
    const dup = await anonymous().post("/api/auth/signup").send({ name: "Outra Pessoa", email: existing.user.email, password: "segredo123" });
    expect(dup.status).toBe(400);

    const wrong = await anonymous().post("/api/auth/login").send({ email: existing.user.email, password: "errada" });
    expect(wrong.status).toBe(400);
    expect(wrong.body.token).toBeUndefined();
  });
});

describe("session", () => {
  it("requires a token on protected routes", async () => {
    expect((await anonymous().get("/api/transactions")).status).toBe(401);
    expect((await anonymous().get("/api/auth/me").set("Authorization", "Bearer nope")).status).toBe(401);
  });

  it("locks out a blocked user", async () => {
    const client = await createUser();
    await prisma.user.update({ where: { id: client.user.id }, data: { blocked: true } });
    expect((await client.get("/api/auth/me")).status).toBe(401);
  });

  it("trades a refresh token for a new access token, until logout revokes it", async () => {
    const client = await createUser();
    const login = await anonymous().post("/api/auth/login").send({ email: client.user.email, password: client.password });
    const refreshToken: string = login.body.refreshToken;

    // the refresh token is stored in the background right after login
    await expect
      .poll(async () => (await anonymous().post("/api/auth/refresh-token").send({ refreshToken })).status, { timeout: 5000 })
      .toBe(200);

    const refreshed = await anonymous().post("/api/auth/refresh-token").send({ refreshToken });
    const me = await anonymous().get("/api/auth/me").set("Authorization", `Bearer ${refreshed.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.id).toBe(client.user.id);

    await anonymous().post("/api/auth/logout").send({ refreshToken });
    expect((await anonymous().post("/api/auth/refresh-token").send({ refreshToken })).status).toBe(401);
  });
});

describe("admin area", () => {
  it("is closed to regular users and open to admins", async () => {
    const regular = await createUser();
    const admin = await createUser({ role: "ADMIN" });
    expect((await regular.get("/api/users")).status).toBe(403);
    expect((await regular.get("/api/admin/stats")).status).toBe(403);

    const list = await admin.get("/api/users");
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThanOrEqual(2);
    expect(list.body[0]).not.toHaveProperty("passwordHash");
  });
});
