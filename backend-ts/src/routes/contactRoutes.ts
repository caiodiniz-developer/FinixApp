import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../lib/prisma";
import { PLANS } from "../config/plans";
import { authenticate } from "../middlewares/auth";
import { contactSchema, splitExpenseCreateSchema } from "../schemas";

const router = Router();

// ============================================================================
// CONTACTS & SPLIT EXPENSES (rachar conta)
// ============================================================================
router.get("/api/contacts", authenticate, async (req, res) => {
  const user = req.user;
  const contacts = await prisma.contact.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
  });
  const splits = await prisma.splitExpense.findMany({
    where: { userId: user.id, settled: false },
  });
  const owedByContact: Record<string, number> = {};
  splits.forEach((s) => {
    owedByContact[s.contactId] = (owedByContact[s.contactId] || 0) + s.amount;
  });
  res.json(
    contacts.map((c) => ({ ...c, totalOwed: owedByContact[c.id] || 0 })),
  );
});

router.post("/api/contacts", authenticate, async (req, res) => {
  const user = req.user;
  const data = contactSchema.parse(req.body);
  const plan = PLANS[user.plan] || PLANS.FREE;
  const count = await prisma.contact.count({ where: { userId: user.id } });
  if (count >= plan.contactsLimit)
    return res.status(403).json({
      error: `Plano ${plan.name} permite até ${plan.contactsLimit} contatos. Faça upgrade.`,
      upgrade: true,
    });
  const contact = await prisma.contact.create({
    data: { ...data, id: uuidv4(), userId: user.id },
  });
  res.json(contact);
});

router.put("/api/contacts/:id", authenticate, async (req, res) => {
  const user = req.user;
  const data = contactSchema.parse(req.body);
  const updated = await prisma.contact.updateMany({
    where: { id: String(req.params.id), userId: user.id },
    data,
  });
  if (updated.count === 0)
    return res.status(404).json({ error: "Contato não encontrado" });
  const contact = await prisma.contact.findUnique({
    where: { id: String(req.params.id) },
  });
  res.json(contact);
});

router.delete("/api/contacts/:id", authenticate, async (req, res) => {
  const user = req.user;
  const deleted = await prisma.contact.deleteMany({
    where: { id: String(req.params.id), userId: user.id },
  });
  if (deleted.count === 0)
    return res.status(404).json({ error: "Contato não encontrado" });
  res.json({ ok: true });
});

// "Quem deve quem" líquido: zera de uma vez todas as divisões em aberto com
// este contato, em vez de marcar uma por uma.
router.post("/api/contacts/:id/settle-all", authenticate, async (req, res) => {
  const user = req.user;
  const contact = await prisma.contact.findUnique({ where: { id: String(req.params.id) } });
  if (!contact || contact.userId !== user.id) return res.status(404).json({ error: "Contato não encontrado" });
  const result = await prisma.splitExpense.updateMany({
    where: { userId: user.id, contactId: contact.id, settled: false },
    data: { settled: true, settledAt: new Date() },
  });
  res.json({ settled: result.count });
});

router.get("/api/contacts/:id/splits", authenticate, async (req, res) => {
  const user = req.user;
  const contact = await prisma.contact.findUnique({
    where: { id: String(req.params.id) },
  });
  if (!contact || contact.userId !== user.id)
    return res.status(404).json({ error: "Contato não encontrado" });
  const splits = await prisma.splitExpense.findMany({
    where: { userId: user.id, contactId: contact.id },
    include: { transaction: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(splits);
});

router.post("/api/transactions/:id/split", authenticate, async (req, res) => {
  const user = req.user;
  const tx = await prisma.transaction.findUnique({
    where: { id: String(req.params.id) },
  });
  if (!tx || tx.userId !== user.id)
    return res.status(404).json({ error: "Transação não encontrada" });
  const data = splitExpenseCreateSchema.parse(req.body);
  const contactIds = data.splits.map((s) => s.contactId);
  const ownedCount = await prisma.contact.count({
    where: { id: { in: contactIds }, userId: user.id },
  });
  if (ownedCount !== new Set(contactIds).size)
    return res.status(400).json({ error: "Contato inválido" });
  await prisma.splitExpense.createMany({
    data: data.splits.map((s) => ({
      id: uuidv4(),
      userId: user.id,
      transactionId: tx.id,
      contactId: s.contactId,
      amount: s.amount,
    })),
  });
  const splits = await prisma.splitExpense.findMany({
    where: { transactionId: tx.id, userId: user.id },
    include: { contact: true },
  });
  res.json(splits);
});

router.put("/api/split-expenses/:id", authenticate, async (req, res) => {
  const user = req.user;
  const settled = Boolean(req.body?.settled);
  const updated = await prisma.splitExpense.updateMany({
    where: { id: String(req.params.id), userId: user.id },
    data: { settled, settledAt: settled ? new Date() : null },
  });
  if (updated.count === 0)
    return res.status(404).json({ error: "Registro não encontrado" });
  const split = await prisma.splitExpense.findUnique({
    where: { id: String(req.params.id) },
  });
  res.json(split);
});

router.delete("/api/split-expenses/:id", authenticate, async (req, res) => {
  const user = req.user;
  const deleted = await prisma.splitExpense.deleteMany({
    where: { id: String(req.params.id), userId: user.id },
  });
  if (deleted.count === 0)
    return res.status(404).json({ error: "Registro não encontrado" });
  res.json({ ok: true });
});

export default router;
