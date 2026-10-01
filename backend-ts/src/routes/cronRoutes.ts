import { Router } from "express";
import crypto from "crypto";
import { runScheduledJobs } from "../services/jobs";

const router = Router();

// Constant-time compare — a plain `!==` leaks, through response timing, how
// many leading characters of the secret were right.
const secretMatches = (provided: string, expected: string) => {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Called by an external scheduler (GitHub Actions, cron-job.org, Render cron)
// once a day. Authenticated by a shared secret instead of a user session:
// send it as `Authorization: Bearer <CRON_SECRET>`.
router.post("/api/cron/run-jobs", async (req, res) => {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return res.status(501).json({ error: "CRON_SECRET não configurado no servidor" });
  }
  const provided = String(req.headers.authorization || "").replace(/^Bearer /, "");
  if (!secretMatches(provided, expected)) {
    return res.status(401).json({ error: "unauthorized" });
  }
  res.json(await runScheduledJobs());
});

export default router;
