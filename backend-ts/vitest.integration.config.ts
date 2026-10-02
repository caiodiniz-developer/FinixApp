import { defineConfig } from "vitest/config";
import { TEST_DATABASE_URL } from "./tests/integration/testDatabase";

// Integration tests exercise the real Express app against a real PostgreSQL.
// They need a THROWAWAY database: point TEST_DATABASE_URL at one (the default
// is a local server). tests/integration/globalSetup.ts refuses to run against
// anything that is not on localhost — it wipes every table.

export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/integration/globalSetup.ts"],
    // One database shared by every file: run them one after the other.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: "integration-test-secret",
      STRIPE_SECRET_KEY: "",
      GMAIL_USER: "",
      GMAIL_APP_PASSWORD: "",
      GMAIL_REFRESH_TOKEN: "",
      VAPID_PUBLIC_KEY: "",
      VAPID_PRIVATE_KEY: "",
      EMERGENT_LLM_KEY: "",
      CRON_SECRET: "cron-test-secret",
    },
  },
});
