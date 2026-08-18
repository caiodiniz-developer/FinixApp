import { PrismaClient } from "@prisma/client";

// Single shared instance for the whole process. Prisma's own guidance is to
// never instantiate more than one PrismaClient per app — each instance opens
// its own connection pool against Postgres, so N instances means N separate
// cold-starts and N times the idle connections against Neon's pooler. This
// codebase used to create a new one per service file (11 of them), which is
// exactly the anti-pattern that made every login/signup pay for multiple
// pool warm-ups instead of one.
export const prisma = new PrismaClient();
