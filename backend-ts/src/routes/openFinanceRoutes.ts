import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middlewares/auth";
import * as openFinance from "../services/openFinanceService";

const router = Router();

// ============================================================================
// OPEN FINANCE (Pluggy) — connected bank accounts.
// Every route 501s until PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET are set.
// ============================================================================
router.post("/api/open-finance/connect-token", authenticate, async (req, res) => {
  if (!openFinance.isConfigured) {
    return res.status(501).json({
      error: "Conexão bancária não configurada. Defina PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET.",
    });
  }
  const user = req.user;
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
router.post("/api/open-finance/connections", authenticate, async (req, res) => {
  if (!openFinance.isConfigured) {
    return res.status(501).json({ error: "Conexão bancária não configurada." });
  }
  const user = req.user;
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

router.get("/api/open-finance/connections", authenticate, async (req, res) => {
  const user = req.user;
  const connections = await prisma.externalConnection.findMany({
    where: { userId: user.id },
    include: { accounts: true },
  });
  res.json(connections);
});

router.post("/api/open-finance/connections/:id/sync", authenticate, async (req, res) => {
  if (!openFinance.isConfigured) {
    return res.status(501).json({ error: "Conexão bancária não configurada." });
  }
  const user = req.user;
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

router.delete("/api/open-finance/connections/:id", authenticate, async (req, res) => {
  const user = req.user;
  const deleted = await prisma.externalConnection.deleteMany({
    where: { id: String(req.params.id), userId: user.id },
  });
  if (deleted.count === 0) return res.status(404).json({ error: "Conexão não encontrada" });
  res.json({ ok: true });
});

export default router;
