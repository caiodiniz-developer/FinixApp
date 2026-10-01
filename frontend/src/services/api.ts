import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  updateAccessToken,
} from "./session";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Access tokens are short-lived (15 min). When one expires the API answers
// 401; instead of throwing the user back to the login screen we trade the
// refresh token for a new access token and replay the request. All requests
// that fail at the same moment share a single renewal.
let renewal: Promise<string | null> | null = null;

const renewAccessToken = (): Promise<string | null> => {
  if (!renewal) {
    const refreshToken = getRefreshToken();
    renewal = (
      refreshToken
        ? axios
            .post(`${API_URL}/api/auth/refresh-token`, { refreshToken })
            .then((r) => {
              const token: string | undefined = r.data?.token;
              if (!token) return null;
              updateAccessToken(token);
              return token;
            })
            .catch(() => null)
        : Promise.resolve(null)
    ).finally(() => {
      renewal = null;
    });
  }
  return renewal;
};

const PUBLIC_PATHS = ["/login", "/register", "/signup", "/oauth-callback"];

const endSession = () => {
  clearSession();
  const path = window.location.pathname;
  if (path !== "/" && !PUBLIC_PATHS.some((p) => path.startsWith(p))) {
    window.dispatchEvent(new Event("finix-auth-unauthorized"));
  }
};

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const config = err.config as RetriableConfig | undefined;
    const isAuthCall = config?.url?.includes("/api/auth/login") ||
      config?.url?.includes("/api/auth/2fa/login") ||
      config?.url?.includes("/api/auth/refresh-token");

    if (err.response?.status === 401 && config && !isAuthCall) {
      if (!config._retried) {
        config._retried = true;
        const token = await renewAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          return api(config);
        }
      }
      endSession();
    }
    return Promise.reject(err);
  },
);

export function apiErrorMessage(e: any): string {
  // Try different error message formats from backend
  const data = e?.response?.data;
  if (typeof data?.detail === "string") return data.detail;
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.message === "string") return data.message;
  if (Array.isArray(data?.detail))
    return data.detail.map((x: any) => x?.msg || JSON.stringify(x)).join(" ");
  if (e?.message) return e.message;
  return "Algo deu errado";
}
