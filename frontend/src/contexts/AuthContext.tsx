import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { api, apiErrorMessage } from "../services/api";
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
  loginWithToken: (token: string, remember?: boolean) => Promise<void>;
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
    const token =
      localStorage.getItem("finix_token") ||
      sessionStorage.getItem("finix_token");
    if (!token) {
      setUser(null);
      return;
    }
    api
      .get("/api/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => {
        localStorage.removeItem("finix_token");
        sessionStorage.removeItem("finix_token");
        setUser(null);
      });
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem("finix_token");
      sessionStorage.removeItem("finix_token");
      setUser(null);
      navigate("/login", { replace: true });
    };

    window.addEventListener("finix-auth-unauthorized", handleUnauthorized);
    return () =>
      window.removeEventListener("finix-auth-unauthorized", handleUnauthorized);
  }, [navigate]);

  const storeToken = (token: string, remember: boolean) => {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem("finix_token", token);
  };

  const login = async (email: string, password: string, remember = true) => {
    try {
      console.log("[AuthContext] Starting login request for:", email);
      const { data } = await api.post("/api/auth/login", { email, password });
      if (data.requiresTwoFactor) {
        return { requiresTwoFactor: true as const, pendingToken: data.pendingToken };
      }
      console.log("[AuthContext] Login response received:", {
        userId: data.user?.id,
        verified: data.user?.isVerified,
      });
      storeToken(data.token, remember);
      setUser(data.user);
      console.log("[AuthContext] Login completed successfully");
    } catch (e) {
      console.error("[AuthContext] Login error:", e);
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
      storeToken(data.token, remember);
      setUser(data.user);
    } catch (e) {
      throw new Error(apiErrorMessage(e));
    }
  };

  const loginWithToken = async (token: string, remember = true) => {
    try {
      console.log(
        "[AuthContext] Authenticating with token from OAuth callback",
      );
      storeToken(token, remember);
      const { data } = await api.get("/api/auth/me");
      setUser(data);
      console.log(
        "[AuthContext] OAuth login completed successfully for:",
        data?.email,
      );
    } catch (e) {
      console.error("[AuthContext] OAuth login error:", e);
      localStorage.removeItem("finix_token");
      sessionStorage.removeItem("finix_token");
      throw new Error(apiErrorMessage(e));
    }
  };

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
    localStorage.removeItem("finix_token");
    sessionStorage.removeItem("finix_token");
    setUser(null);
    navigate("/login", { replace: true });
  };

  const refreshUser = async () => {
    const token =
      localStorage.getItem("finix_token") ||
      sessionStorage.getItem("finix_token");
    if (!token) return;
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
  };

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
