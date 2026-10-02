import { describe, expect, it } from "vitest";
import { anonymous, createUser, prisma, transaction } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;

describe("paywall", () => {
  it("a FREE account past its trial cannot use transactions, cards or exports", async () => {
    const free = await createUser({ plan: "FREE", ageDays: 30 });
    expect((await free.get("/api/transactions")).status).toBe(403);
    expect((await free.post("/api/transactions", transaction())).status).toBe(403);
    expect((await free.get("/api/cards")).status).toBe(403);
    expect((await free.get("/api/export/pdf")).status).toBe(403);
    const blocked = await free.get("/api/alerts");
    expect(blocked.status).toBe(403);
    expect(blocked.body.upgrade).toBe(true);
  });

  it("the same FREE account inside its 7-day trial gets BASIC access", async () => {
    const trial = await createUser({ plan: "FREE", ageDays: 2 });
    expect((await trial.post("/api/transactions", transaction())).status).toBe(200);
    expect((await trial.get("/api/cards")).status).toBe(200);
    // Excel export is PRO-only, trial or not
    expect((await trial.get("/api/export/excel")).status).toBe(403);
  });

  it("BASIC is limited where PRO is not", async () => {
    const basic = await createUser({ plan: "BASIC" });
    const pro = await createUser({ plan: "PRO" });

    expect((await basic.get("/api/export/excel")).status).toBe(403);
    expect((await pro.get("/api/export/excel")).status).toBe(200);

    // BASIC allows 2 accounts
    expect((await basic.post("/api/accounts", { name: "Conta 1" })).status).toBe(200);
    expect((await basic.post("/api/accounts", { name: "Conta 2" })).status).toBe(200);
    const third = await basic.post("/api/accounts", { name: "Conta 3" });
    expect(third.status).toBe(403);
    expect(third.body.upgrade).toBe(true);
  });

  it("an expired paid plan falls back to FREE after the grace period", async () => {
    const expired = await createUser({ plan: "PRO", planExpiresAt: new Date(Date.now() - 10 * DAY) });
    expect((await expired.get("/api/transactions")).status).toBe(403);
    expect((await expired.get("/api/auth/me")).body.effectivePlan).toBe("FREE");

    const inGrace = await createUser({ plan: "PRO", planExpiresAt: new Date(Date.now() - 1 * DAY) });
    expect((await inGrace.get("/api/transactions")).status).toBe(200);
  });

  it("the monthly transaction limit is enforced", async () => {
    const basic = await createUser({ plan: "BASIC" });
    const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    await prisma.user.update({ where: { id: basic.user.id }, data: { transactionsUsed: 500, transactionsMonth: month } });
    const res = await basic.post("/api/transactions", transaction());
    expect(res.status).toBe(403);
    expect(res.body.limit).toBe(500);
  });
});

describe("API keys", () => {
  it("can read but never write", async () => {
    const client = await createUser();
    await client.post("/api/transactions", transaction());
    const { body } = await client.post("/api/api-keys", { label: "Planilha" });
    const key = { "X-Api-Key": body.key as string };

    const read = await anonymous().get("/api/transactions").set(key);
    expect(read.status).toBe(200);
    expect(read.body).toHaveLength(1);

    expect((await anonymous().post("/api/transactions").set(key).send(transaction())).status).toBe(403);
    expect((await anonymous().delete(`/api/transactions/${read.body[0].id}`).set(key)).status).toBe(403);
    expect((await anonymous().get("/api/transactions").set("X-Api-Key", "fnx_invalida")).status).toBe(401);

    // revoking the key closes the door
    expect((await client.del(`/api/api-keys/${body.id}`)).status).toBe(200);
    expect((await anonymous().get("/api/transactions").set(key)).status).toBe(401);
  });
});

describe("user webhooks", () => {
  it("cannot point at internal addresses, and the secret is shown only once", async () => {
    const client = await createUser();
    expect((await client.post("/api/webhooks", { url: "http://127.0.0.1:8000/x", events: ["goal.created"] })).status).toBe(400);
    expect((await client.post("/api/webhooks", { url: "http://169.254.169.254/latest", events: ["goal.created"] })).status).toBe(400);

    const created = await client.post("/api/webhooks", { url: "https://8.8.8.8/hook", events: ["goal.created"] });
    expect(created.status).toBe(201);
    expect(created.body.secret).toEqual(expect.any(String));

    const list = await client.get("/api/webhooks");
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).not.toHaveProperty("secret");
  });
});

describe("categories", () => {
  it("renaming a category carries its transactions and budget along", async () => {
    const client = await createUser();
    const category = await client.post("/api/categories", { name: "Casa" });
    await client.post("/api/transactions", transaction({ title: "Aluguel", category: "Casa", amount: 1500 }));
    await client.post("/api/budgets", { category: "Casa", limit: 2000 });

    const renamed = await client.put(`/api/categories/${category.body.id}`, { name: "Moradia" });
    expect(renamed.status).toBe(200);

    expect((await client.get("/api/transactions?category=Moradia")).body).toHaveLength(1);
    expect((await client.get("/api/transactions?category=Casa")).body).toHaveLength(0);
    expect((await client.get("/api/budgets")).body[0].category).toBe("Moradia");
  });
});

describe("scheduled jobs endpoint", () => {
  it("only runs with the cron secret", async () => {
    expect((await anonymous().post("/api/cron/run-jobs")).status).toBe(401);
    expect((await anonymous().post("/api/cron/run-jobs").set("Authorization", "Bearer errado")).status).toBe(401);

    const ok = await anonymous().post("/api/cron/run-jobs").set("Authorization", "Bearer cron-test-secret");
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({
      recurringCreated: expect.any(Number),
      alertsNotified: expect.any(Number),
      impulseNotified: expect.any(Number),
    });
  });
});
