import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { api, apiErrorMessage } from "../services/api";
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  saveSession,
} from "../services/session";
import { User } from "../types";

interface AuthCtx {
  user: User | null | undefined; // undefined = loading, null = not logged in
  login: (
    email: string,
    password: string,
    remember?: boolean,
  ) => Promise<{ requiresTwoFactor: true; pendingToken: string } | void>;
  completeTwoFactorLogin: (
    pendingToken: string,
    codeOrBackup: { token?: string; backupCode?: string },
    remember?: boolean,
  ) => Promise<void>;
  loginWithToken: (
    token: string,
    remember?: boolean,
    refreshToken?: string | null,
  ) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ userId: string; message: string }>;
  setUser: React.Dispatch<React.SetStateAction<User | null | undefined>>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    // An expired access token is fine here: the API client renews it with
    // the refresh token before this request fails.
    if (!getAccessToken() && !getRefreshToken()) {
      setUser(null);
      return;
    }
    api
      .get("/api/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => {
        clearSession();
        setUser(null);
      });
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearSession();
      setUser(null);
      navigate("/login", { replace: true });
    };

    window.addEventListener("finix-auth-unauthorized", handleUnauthorized);
    return () =>
      window.removeEventListener("finix-auth-unauthorized", handleUnauthorized);
  }, [navigate]);

  const login = async (email: string, password: string, remember = true) => {
    try {
      const { data } = await api.post("/api/auth/login", { email, password });
      if (data.requiresTwoFactor) {
        return { requiresTwoFactor: true as const, pendingToken: data.pendingToken };
      }
      saveSession(data, remember);
      setUser(data.user);
    } catch (e) {
      throw new Error(apiErrorMessage(e));
    }
  };

  const completeTwoFactorLogin = async (
    pendingToken: string,
    codeOrBackup: { token?: string; backupCode?: string },
    remember = true,
  ) => {
    try {
      const { data } = await api.post("/api/auth/2fa/login", { pendingToken, ...codeOrBackup });
      saveSession(data, remember);
      setUser(data.user);
    } catch (e) {
      throw new Error(apiErrorMessage(e));
    }
  };

  const loginWithToken = useCallback(
    async (token: string, remember = true, refreshToken: string | null = null) => {
      try {
        saveSession({ token, refreshToken }, remember);
        const { data } = await api.get("/api/auth/me");
        setUser(data);
      } catch (e) {
        clearSession();
        throw new Error(apiErrorMessage(e));
      }
    },
    [],
  );

  const register = async (
    name: string,
    email: string,
    password: string,
  ): Promise<{ userId: string; message: string }> => {
    try {
      const { data } = await api.post("/api/auth/signup", {
        name,
        email,
        password,
      });
      return data;
    } catch (e) {
      throw new Error(apiErrorMessage(e));
    }
  };

  const logout = () => {
    // Revoke the refresh token server-side; the local session ends either way.
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      api.post("/api/auth/logout", { refreshToken }).catch(() => {});
    }
    clearSession();
    setUser(null);
    navigate("/login", { replace: true });
  };

  const refreshUser = useCallback(async () => {
    if (!getAccessToken()) return;
    try {
      const r = await api.get("/api/auth/me");
      setUser((current) => {
        const nextUser = r.data;
        if (JSON.stringify(current) === JSON.stringify(nextUser)) {
          return current;
        }
        return nextUser;
      });
    } catch (e) {
      console.error("Failed to refresh user:", e);
    }
  }, []);

  return (
    <Ctx.Provider
      value={{
        user,
        login,
        completeTwoFactorLogin,
        loginWithToken,
        register,
        setUser,
        logout,
        refreshUser,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export function useAutoRefreshUser(intervalMs = 30000) {
  const { refreshUser } = useAuth();

  useEffect(() => {
    const interval =
      intervalMs > 0 ? window.setInterval(refreshUser, intervalMs) : null;

    const handleFocus = () => refreshUser();
    window.addEventListener("focus", handleFocus);

    return () => {
      if (interval !== null) {
        window.clearInterval(interval);
      }
      window.removeEventListener("focus", handleFocus);
    };
  }, [refreshUser, intervalMs]);
}
