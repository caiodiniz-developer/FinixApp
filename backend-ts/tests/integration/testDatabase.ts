/** The throwaway database the integration tests run against. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/finix_test";

/**
 * The suite truncates every table, so it only ever runs on localhost. The
 * project's own .env points at the production database — this is what makes
 * it impossible to wipe it by running the tests.
 */
export const assertLocalDatabase = (url: string): void => {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    /* reported below */
  }
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
    throw new Error(
      `Integration tests refuse to run against "${host || url || "(no database url)"}". ` +
        "Set TEST_DATABASE_URL to a local, disposable PostgreSQL database.",
    );
  }
};
