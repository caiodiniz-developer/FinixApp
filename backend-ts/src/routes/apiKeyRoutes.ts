import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middlewares/auth";

const router = Router();

// ============================================================================
// API KEYS — programmatic read access (Zapier, planilhas, scripts)
// ============================================================================
router.get("/api/api-keys", authenticate, async (req, res) => {
  const user = req.user;
  const keys = await prisma.apiKey.findMany({
    where: { userId: user.id },
    select: { id: true, label: true, keyPrefix: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(keys);
});

router.post("/api/api-keys", authenticate, async (req, res) => {
  const user = req.user;
  const { label } = z.object({ label: z.string().min(1).max(60) }).parse(req.body);
  const rawKey = `fnx_${crypto.randomBytes(24).toString("hex")}`;
  const keyPrefix = rawKey.slice(0, 12);
  const keyHash = await bcrypt.hash(rawKey, 10);
  const keyFingerprint = crypto.createHash("sha256").update(rawKey).digest("hex");

  const created = await prisma.apiKey.create({
    data: { userId: user.id, label, keyPrefix, keyHash, keyFingerprint },
  });
  // Raw key shown exactly once — same pattern as the webhook secret above.
  res.status(201).json({ id: created.id, key: rawKey, label, keyPrefix });
});

router.delete("/api/api-keys/:id", authenticate, async (req, res) => {
  const user = req.user;
  const deleted = await prisma.apiKey.deleteMany({
    where: { id: String(req.params.id), userId: user.id },
  });
  if (deleted.count === 0) return res.status(404).json({ error: "Chave não encontrada" });
  res.json({ ok: true });
});

export default router;
