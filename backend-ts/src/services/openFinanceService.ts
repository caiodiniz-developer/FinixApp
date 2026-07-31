// Open Finance connected-accounts integration, via Pluggy (https://pluggy.ai)
// — the most common Brazilian Open Finance aggregator with a free sandbox
// tier. Every function here is a thin wrapper over Pluggy's REST API.
//
// Nothing in this file works without PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET:
// sign up at https://dashboard.pluggy.ai, create an application, and put the
// two keys it gives you into backend-ts/.env. Until then, `isConfigured` is
// false and every route that uses this service responds 501.

const PLUGGY_CLIENT_ID = process.env.PLUGGY_CLIENT_ID;
const PLUGGY_CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET;
const PLUGGY_BASE_URL = "https://api.pluggy.ai";

export const isConfigured = !!(PLUGGY_CLIENT_ID && PLUGGY_CLIENT_SECRET);

if (!isConfigured) {
  console.warn(
    "[OPEN FINANCE] PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET não definidos — " +
      "conexão bancária desativada. Crie uma conta em https://dashboard.pluggy.ai para habilitar.",
  );
}

let cachedApiKey: { key: string; expiresAt: number } | null = null;

/** Pluggy's own service-to-service auth token (NOT the end-user connect
 * token) — short-lived, so it's cached and refreshed a minute before expiry. */
const getApiKey = async (): Promise<string> => {
  if (cachedApiKey && cachedApiKey.expiresAt > Date.now()) return cachedApiKey.key;

  const res = await fetch(`${PLUGGY_BASE_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: PLUGGY_CLIENT_ID, clientSecret: PLUGGY_CLIENT_SECRET }),
  });
  if (!res.ok) throw new Error(`Pluggy auth falhou: ${res.status}`);
  const data = (await res.json()) as { apiKey: string };
  cachedApiKey = { key: data.apiKey, expiresAt: Date.now() + 100 * 60 * 1000 };
  return data.apiKey;
};

/** Token the FRONTEND uses to open Pluggy Connect's widget for a given user —
 * never share the clientSecret with the browser directly. */
export const createConnectToken = async (userId: string): Promise<string> => {
  const apiKey = await getApiKey();
  const res = await fetch(`${PLUGGY_BASE_URL}/connect_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
    body: JSON.stringify({ clientUserId: userId }),
  });
  if (!res.ok) throw new Error(`Falha ao criar connect token: ${res.status}`);
  const data = (await res.json()) as { accessToken: string };
  return data.accessToken;
};

export const fetchItem = async (itemId: string) => {
  const apiKey = await getApiKey();
  const res = await fetch(`${PLUGGY_BASE_URL}/items/${itemId}`, {
    headers: { "X-API-KEY": apiKey },
  });
  if (!res.ok) throw new Error(`Falha ao buscar item: ${res.status}`);
  return res.json();
};

export const fetchAccounts = async (itemId: string) => {
  const apiKey = await getApiKey();
  const res = await fetch(`${PLUGGY_BASE_URL}/accounts?itemId=${itemId}`, {
    headers: { "X-API-KEY": apiKey },
  });
  if (!res.ok) throw new Error(`Falha ao buscar contas: ${res.status}`);
  const data = (await res.json()) as { results: any[] };
  return data.results;
};

export const fetchTransactions = async (accountId: string, from?: string) => {
  const apiKey = await getApiKey();
  const qs = new URLSearchParams({ accountId, ...(from ? { from } : {}) });
  const res = await fetch(`${PLUGGY_BASE_URL}/transactions?${qs}`, {
    headers: { "X-API-KEY": apiKey },
  });
  if (!res.ok) throw new Error(`Falha ao buscar transações: ${res.status}`);
  const data = (await res.json()) as { results: any[] };
  return data.results;
};
