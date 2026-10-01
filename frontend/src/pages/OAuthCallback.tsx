import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../contexts/AuthContext";

export default function OAuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const [status, setStatus] = useState("Verificando autenticação...");
  const handled = useRef(false);

  useEffect(() => {
    // The tokens are single-use material in the URL — process them once,
    // even if the effect runs twice (React strict mode).
    if (handled.current) return;
    handled.current = true;

    // The API hands the tokens over in the URL fragment (never sent to any
    // server); `?token=` is still accepted for older links.
    const fragment = new URLSearchParams(location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(location.search);
    const token = fragment.get("token") || query.get("token");
    const refreshToken = fragment.get("refreshToken");
    const errorMessage = query.get("message");

    // Don't leave credentials sitting in the address bar / browser history.
    window.history.replaceState(null, "", location.pathname);

    const handleLogin = async () => {
      try {
        if (!token) {
          throw new Error(errorMessage || "Falha ao autenticar via OAuth.");
        }
        setStatus("Concluindo login...");
        await loginWithToken(token, true, refreshToken);
        toast.success("Login via Google concluído!");
        navigate("/app/dashboard", { replace: true });
      } catch (error: any) {
        toast.error(error?.message || "Erro ao autenticar via OAuth.");
        navigate("/login", { replace: true });
      }
    };

    handleLogin();
  }, [location, loginWithToken, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12 text-center">
      <div className="max-w-xl w-full rounded-3xl border border-border bg-surface p-10 shadow-lg">
        <h1 className="text-2xl font-semibold text-text">Autenticando...</h1>
        <p className="mt-4 text-sm text-muted">{status}</p>
      </div>
    </div>
  );
}
