import { Request, Response, NextFunction } from "express";

interface Entry {
  count: number;
  windowStart: number;
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
  /** What a "client" is for this limiter. Defaults to IP + path. */
  keyBy?: (req: Request) => string;
  message?: string;
}

/**
 * Fixed-window, in-memory rate limiter. One store per limiter, swept on a
 * timer so keys from clients that never come back don't pile up forever.
 * In-memory means per-process: fine for the single-instance deploy, would
 * need a shared store (Redis) with more than one replica.
 *
 * `req.ip` only identifies the real client when Express trusts the hosting
 * proxy — see `trust proxy` in app.ts.
 */
export const createRateLimiter = ({
  windowMs,
  max,
  keyBy = (req) => `${req.ip}:${req.path}`,
  message = "Muitas tentativas. Tente novamente em alguns instantes.",
}: RateLimitOptions) => {
  const store = new Map<string, Entry>();

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now - entry.windowStart > windowMs) store.delete(key);
    }
  }, windowMs);
  sweep.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyBy(req);
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now - entry.windowStart > windowMs) {
      store.set(key, { count: 1, windowStart: now });
      return next();
    }

    if (entry.count >= max) {
      res.setHeader("Retry-After", Math.ceil((entry.windowStart + windowMs - now) / 1000));
      return res.status(429).json({ error: message });
    }

    entry.count += 1;
    next();
  };
};

/** Credential endpoints (login, signup, code verification): 10 per minute per IP+path. */
export const authRateLimit = createRateLimiter({ windowMs: 60 * 1000, max: 10 });

/**
 * Per-account guard on top of the per-IP one: a 6-digit code has only 900k
 * possibilities, so guesses against one e-mail are capped no matter how many
 * IPs they come from.
 */
export const perEmailRateLimit = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
  keyBy: (req) => `${String(req.body?.email || "").trim().toLowerCase()}:${req.path}`,
  message: "Muitas tentativas para este e-mail. Aguarde alguns minutos.",
});
