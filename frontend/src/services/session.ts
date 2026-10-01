// Where the session lives in the browser. "Lembrar de mim" picks
// localStorage (survives closing the browser); otherwise sessionStorage.
const ACCESS_KEY = "finix_token";
const REFRESH_KEY = "finix_refresh_token";

const stores = (): Storage[] => [localStorage, sessionStorage];

export const getAccessToken = (): string | null =>
  localStorage.getItem(ACCESS_KEY) || sessionStorage.getItem(ACCESS_KEY);

export const getRefreshToken = (): string | null =>
  localStorage.getItem(REFRESH_KEY) || sessionStorage.getItem(REFRESH_KEY);

/** The storage the current session was saved in (defaults to localStorage). */
const activeStore = (): Storage =>
  sessionStorage.getItem(ACCESS_KEY) || sessionStorage.getItem(REFRESH_KEY)
    ? sessionStorage
    : localStorage;

export const saveSession = (
  tokens: { token: string; refreshToken?: string | null },
  remember: boolean,
) => {
  clearSession();
  const store = remember ? localStorage : sessionStorage;
  store.setItem(ACCESS_KEY, tokens.token);
  if (tokens.refreshToken) store.setItem(REFRESH_KEY, tokens.refreshToken);
};

/** Swaps in a renewed access token, keeping the session where it already was. */
export const updateAccessToken = (token: string) => {
  activeStore().setItem(ACCESS_KEY, token);
};

export const clearSession = () => {
  for (const store of stores()) {
    store.removeItem(ACCESS_KEY);
    store.removeItem(REFRESH_KEY);
  }
};
