import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Unit tests never touch real services: these values win over any local
    // .env (dotenv does not override variables that are already set).
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      JWT_SECRET: "test-secret",
      STRIPE_SECRET_KEY: "",
      GMAIL_USER: "",
      GMAIL_APP_PASSWORD: "",
      GMAIL_REFRESH_TOKEN: "",
      VAPID_PUBLIC_KEY: "",
      VAPID_PRIVATE_KEY: "",
    },
  },
});
