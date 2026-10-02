import { describe, expect, it } from "vitest";
import { createUser, transaction } from "./helpers";

describe("transactions", () => {
  it("creates, lists, edits and deletes", async () => {
    const client = await createUser();

    const created = await client.post("/api/transactions", transaction());
    expect(created.status).toBe(200);
    const id: string = created.body.id;

    const list = await client.get("/api/transactions");
    expect(list.body.map((t: { id: string }) => t.id)).toContain(id);

    // editing used to answer 500 (a request-only field reached the database)
    const edited = await client.put(`/api/transactions/${id}`, transaction({ title: "Mercado do mês", amount: 300 }));
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ title: "Mercado do mês", amount: 300 });

    expect((await client.del(`/api/transactions/${id}`)).status).toBe(200);
    expect((await client.del(`/api/transactions/${id}`)).status).toBe(404);
  });

  it("rejects invalid data with 400", async () => {
    const client = await createUser();
    expect((await client.post("/api/transactions", transaction({ amount: -5 }))).status).toBe(400);
    expect((await client.post("/api/transactions", transaction({ type: "OUTRO" }))).status).toBe(400);
    expect((await client.post("/api/transactions", { title: "sem valor" })).status).toBe(400);
  });

  it("never shows or changes another user's transactions", async () => {
    const owner = await createUser();
    const other = await createUser();
    const { body } = await owner.post("/api/transactions", transaction());

    expect((await other.get("/api/transactions")).body).toEqual([]);
    expect((await other.put(`/api/transactions/${body.id}`, transaction({ title: "invadido" }))).status).toBe(404);
    expect((await other.del(`/api/transactions/${body.id}`)).status).toBe(404);
    expect((await owner.get("/api/transactions")).body[0].title).toBe("Mercado");
  });

  it("refuses to link a transaction to someone else's account or card", async () => {
    const owner = await createUser();
    const other = await createUser();
    const account = await owner.post("/api/accounts", { name: "Conta do dono" });
    const card = await owner.post("/api/cards", { name: "Cartão do dono", limit: 1000, closingDay: 10, dueDay: 17 });

    expect((await other.post("/api/transactions", transaction({ accountId: account.body.id }))).status).toBe(400);
    expect((await other.post("/api/transactions", transaction({ cardId: card.body.id }))).status).toBe(400);
    expect((await owner.post("/api/transactions", transaction({ accountId: account.body.id }))).status).toBe(200);
  });

  it("filters and paginates", async () => {
    const client = await createUser();
    await client.post("/api/transactions", transaction({ title: "Aluguel", category: "Moradia", date: "2026-09-05" }));
    await client.post("/api/transactions", transaction({ title: "Salário", type: "INCOME", category: "Salário", date: "2026-09-06" }));
    await client.post("/api/transactions", transaction({ title: "Padaria", date: "2026-09-07" }));

    expect((await client.get("/api/transactions?type=INCOME")).body).toHaveLength(1);
    // search ignores case
    expect((await client.get("/api/transactions?search=ALUG")).body).toHaveLength(1);

    const page = await client.get("/api/transactions?limit=2&offset=0");
    expect(page.body).toHaveLength(2);
    expect(page.headers["x-total-count"]).toBe("3");
    // newest first
    expect(page.body[0].title).toBe("Padaria");
  });
});

describe("installments", () => {
  it("turns a 3x purchase into 3 monthly parcelas of one group", async () => {
    const client = await createUser();
    const res = await client.post(
      "/api/transactions",
      transaction({ title: "Notebook", amount: 333.33, installments: 3, paymentMethod: "credito", date: "2027-01-31" }),
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body.map((t: { title: string }) => t.title)).toEqual(["Notebook • 1/3", "Notebook • 2/3", "Notebook • 3/3"]);
    // day 31 falls on the last day of shorter months
    expect(res.body.map((t: { date: string }) => t.date.slice(0, 10))).toEqual(["2027-01-31", "2027-02-28", "2027-03-31"]);
    // every parcela carries the same group id the screens use to group them
    const groups = new Set(res.body.map((t: { installmentGroupId: string }) => t.installmentGroupId));
    expect(groups.size).toBe(1);
    expect([...groups][0]).toEqual(expect.any(String));

    const usage = await client.get("/api/plans/me");
    expect(usage.body.transactionsUsed).toBe(3);
  });

  it("deletes the whole purchase when asked to", async () => {
    const client = await createUser();
    const res = await client.post("/api/transactions", transaction({ title: "Sofá", amount: 100, installments: 4, paymentMethod: "credito" }));
    await client.del(`/api/transactions/${res.body[0].id}?deleteGroup=true`);
    expect((await client.get("/api/transactions")).body).toEqual([]);
  });

  it("shows each upcoming parcela once in the alerts", async () => {
    const client = await createUser();
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await client.post("/api/transactions", transaction({ title: "TV", amount: 100, installments: 2, paymentMethod: "credito", date: soon }));

    const alerts = await client.get("/api/alerts");
    expect(alerts.status).toBe(200);
    const forTv = alerts.body.alerts.filter((a: { title: string }) => a.title.includes("TV"));
    expect(forTv).toHaveLength(1);
    expect(alerts.body.count).toBe(alerts.body.alerts.length);
  });
});

describe("dashboard totals", () => {
  it("adds up income, expense and categories in the database", async () => {
    const client = await createUser();
    await client.post("/api/transactions", transaction({ title: "Salário", type: "INCOME", amount: 5000, category: "Salário" }));
    await client.post("/api/transactions", transaction({ amount: 0.1 }));
    await client.post("/api/transactions", transaction({ amount: 0.2 }));
    await client.post("/api/transactions", transaction({ title: "Aluguel", amount: 1500, category: "Moradia" }));

    const { body } = await client.get("/api/dashboard");
    expect(body.income).toBe(5000);
    // 0.1 + 0.2 + 1500, exact to the centavo
    expect(body.expense).toBe(1500.3);
    expect(body.balance).toBe(3499.7);
    expect(body.categories).toEqual([
      { category: "Moradia", amount: 1500 },
      { category: "Alimentação", amount: 0.3 },
    ]);
    expect(body.recent.length).toBeLessThanOrEqual(5);
  });
});
