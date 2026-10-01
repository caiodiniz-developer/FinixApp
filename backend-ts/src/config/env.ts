import dotenv from "dotenv";

// Must run before any other module reads process.env — several services
// (tokenService, emailService, pushService...) capture their config at
// import time, so this file has to be the very first import of the entry.
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.warn("WARNING: DATABASE_URL is not set. Configure your .env file.");
}

// JWT_SECRET signs every access token. A missing or well-known default value
// means anyone can forge a token for any user — including admin — with zero
// credentials. Refuse to boot in production rather than silently running
// wide open.
const WEAK_JWT_SECRETS = new Set(["finix-dev-secret", "changeme", "secret", "dev-secret", ""]);
if (
  process.env.NODE_ENV === "production" &&
  (!process.env.JWT_SECRET || WEAK_JWT_SECRETS.has(process.env.JWT_SECRET))
) {
  console.error(
    "[FATAL] JWT_SECRET não está definido ou está usando um valor padrão inseguro. " +
      "Defina uma variável de ambiente JWT_SECRET forte e aleatória (ex: `openssl rand -hex 48`) antes de rodar em produção.",
  );
  process.exit(1);
}

export const JWT_SECRET = process.env.JWT_SECRET || "finix-dev-secret";
export const FRONTEND_URL = process.env.FRONTEND_URL || "https://finixapp.vercel.app";

const DEFAULT_ORIGINS = [
  "https://finixapp.vercel.app",
  "https://finixapp.com.br",
  "https://www.finixapp.com.br",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const originOf = (url: string): string | null => {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

// Exact-match allowlist: the defaults, FRONTEND_URL, and anything listed in
// CORS_ORIGINS (comma-separated). No wildcards — "*.vercel.app" would let any
// site hosted on Vercel call this API with the user's credentials.
export const allowedOrigins: string[] = Array.from(
  new Set(
    [...DEFAULT_ORIGINS, FRONTEND_URL, ...(process.env.CORS_ORIGINS || "").split(",")]
      .map((o) => originOf(o.trim()))
      .filter((o): o is string => !!o),
  ),
);
