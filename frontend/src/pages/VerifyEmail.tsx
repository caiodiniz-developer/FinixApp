import { FormEvent, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Mail, ArrowLeft, RefreshCw, Loader2, ShieldCheck, CheckCircle, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "../components/Logo";
import toast from "react-hot-toast";

const API = import.meta.env.VITE_API_URL;

const STEPS = [
  { n: "1", t: "Abra seu e-mail", d: "Verifique a caixa de entrada" },
  { n: "2", t: "Copie o código", d: "6 dígitos enviados por nós" },
  { n: "3", t: "Cole aqui e confirme", d: "Conta ativa em segundos" },
];

export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();

  const [email, setEmail] = useState(location.state?.email || "");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown > 0 && !canResend) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    } else if (countdown === 0) {
      setCanResend(true);
    }
  }, [countdown, canResend]);

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    const fullCode = code.join("");
    if (fullCode.length !== 6) { toast.error("Digite os 6 dígitos do código."); return; }
    if (!email) { toast.error("Digite seu e-mail."); return; }
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: fullCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Erro ao verificar código");
      setIsVerified(true);
      toast.success("E-mail verificado com sucesso!");
      setTimeout(() => navigate("/login"), 3000);
    } catch (err: any) {
      toast.error(err.message || "Erro ao verificar código");
      setCode(["","","","","",""]);
      inputRefs.current[0]?.focus();
    } finally { setIsLoading(false); }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setIsResending(true);
    try {
      const res = await fetch(`${API}/api/auth/resend-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Erro ao reenviar código");
      toast.success("Novo código enviado!");
      setCountdown(60);
      setCanResend(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally { setIsResending(false); }
  };

  const handleCodeChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, "").slice(-1);
    const newCode = [...code];
    newCode[index] = clean;
    setCode(newCode);
    if (clean && index < 5) inputRefs.current[index + 1]?.focus();
    if (clean && index === 5) {
      const full = [...newCode].join("");
      if (full.length === 6) setTimeout(() => document.getElementById("verify-submit")?.click(), 80);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(""));
      inputRefs.current[5]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === "ArrowLeft" && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const filled = code.filter(Boolean).length;

  // ── Success state ──────────────────────────────────────────────────────────
  if (isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-surface">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(16,185,129,0.08) 0%, transparent 65%)" }} />
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center relative z-10 max-w-sm">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", damping: 12, delay: 0.1 }}
            className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ background: "rgba(16,185,129,0.1)", border: "2px solid rgba(16,185,129,0.3)" }}>
            <CheckCircle className="w-10 h-10" style={{ color: "#10b981" }} />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h1 className="text-3xl font-black text-text mb-2">E-mail verificado!</h1>
            <p className="text-sm text-muted">Sua conta foi ativada. Redirecionando para o login…</p>
            <div className="mt-6 flex items-center justify-center gap-1.5">
              {[0,1,2].map(i => (
                <motion.div key={i} className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "#10b981" }}
                  animate={{ scale: [1,1.5,1], opacity: [0.3,1,0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // ── Main ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen grid lg:grid-cols-2">

      {/* ── Left panel — dark, igual ao Login/Register ──────────────── */}
      <div className="hidden lg:flex flex-col justify-between relative overflow-hidden bg-auth-side p-12">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-brand-green/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-[400px] h-[400px] rounded-full bg-brand-blue/15 blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <Logo className="[&_span]:!text-white" />
        </div>

        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.65 }}
          className="relative z-10 space-y-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.25)" }}>
            <ShieldCheck className="w-7 h-7" style={{ color: "#34d399" }} />
          </div>

          <h2 className="text-[40px] font-display font-extrabold leading-tight text-white">
            Confirme sua<br />
            <span style={{ background: "linear-gradient(90deg,#34d399,#38bdf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              identidade.
            </span>
          </h2>
          <p className="text-base text-white/60 leading-relaxed max-w-sm">
            Só mais um passo. Verificamos seu e-mail para proteger sua conta e seus dados financeiros.
          </p>

          <div className="space-y-4 pt-1">
            {STEPS.map((step, i) => (
              <motion.div key={step.n} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full text-xs font-black flex items-center justify-center shrink-0"
                  style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: "#34d399" }}>
                  {step.n}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{step.t}</div>
                  <div className="text-[11px] text-white/40">{step.d}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <div className="relative z-10 flex items-center gap-2 rounded-2xl px-4 py-3"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <Lock className="w-4 h-4 text-white/40" />
          <p className="text-[11px] text-white/40">
            A Finix jamais solicitará este código por WhatsApp ou telefone.
          </p>
        </div>
      </div>

      {/* ── Right panel — light, igual ao Login/Register ─────────────── */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-surface">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
          className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <Logo />
          </div>

          <h1 className="text-3xl font-display font-extrabold tracking-tight text-text">
            Verifique seu e-mail
          </h1>
          <p className="text-muted mt-1 text-sm">
            Enviamos um código de 6 dígitos para{" "}
            {email ? <span className="font-semibold text-brand-blue">{email}</span> : "seu e-mail"}.
          </p>

          <div className="mt-8 space-y-5">

            {/* Email input (se não vier do cadastro) */}
            {!location.state?.email && (
              <div>
                <label className="text-sm font-medium text-text block mb-1.5">E-mail</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    className="input pl-10" placeholder="voce@email.com" />
                </div>
              </div>
            )}

            {/* OTP boxes */}
            <form onSubmit={handleVerify}>
              <div>
                <label className="text-sm font-medium text-text block mb-3">
                  Código de verificação
                </label>

                {/* Boxes com tamanho fixo e centralização — NÃO usa flex-1 */}
                <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
                  {code.map((digit, index) => (
                    <motion.input
                      key={index}
                      ref={el => { inputRefs.current[index] = el; }}
                      id={`code-${index}`}
                      value={digit}
                      onChange={e => handleCodeChange(index, e.target.value)}
                      onKeyDown={e => handleKeyDown(index, e)}
                      className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-black rounded-xl outline-none transition-all"
                      style={{
                        background: digit ? "rgba(16,185,129,0.06)" : "var(--color-background)",
                        border: digit ? "2px solid rgba(16,185,129,0.5)" : "2px solid var(--color-border)",
                        color: "var(--color-text)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                      onFocus={e => {
                        e.target.style.borderColor = "#10b981";
                        e.target.style.boxShadow = "0 0 0 3px rgba(16,185,129,0.12)";
                      }}
                      onBlur={e => {
                        e.target.style.borderColor = digit ? "rgba(16,185,129,0.5)" : "var(--color-border)";
                        e.target.style.boxShadow = "";
                      }}
                      maxLength={1}
                      inputMode="numeric"
                      animate={digit ? { scale: [1, 1.08, 1] } : {}}
                      transition={{ duration: 0.15 }}
                    />
                  ))}
                </div>

                {/* Progress bar */}
                <div className="flex gap-1 mt-4">
                  {code.map((d, i) => (
                    <div key={i} className="flex-1 h-1 rounded-full transition-all"
                      style={{ background: d ? "#10b981" : "var(--color-border)" }} />
                  ))}
                </div>
                <p className="text-[11px] mt-1.5 text-right font-medium"
                  style={{ color: filled === 6 ? "#10b981" : "var(--color-text-muted)" }}>
                  {filled}/6 dígitos
                </p>
              </div>

              <button id="verify-submit" type="submit" disabled={isLoading || filled < 6}
                className="btn-primary w-full !py-3 mt-2">
                {isLoading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : "Verificar e-mail"
                }
              </button>
            </form>

            {/* Resend + Back */}
            <div className="flex gap-2">
              <button onClick={handleResend} disabled={!canResend || isResending}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40"
                style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)", background: "var(--color-surface)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--color-surface-strong)")}
                onMouseLeave={e => (e.currentTarget.style.background = "var(--color-surface)")}>
                {isResending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {canResend ? "Reenviar código" : `Reenviar em ${countdown}s`}
              </button>
              <button onClick={() => navigate("/register")}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)", background: "var(--color-surface)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--color-surface-strong)")}
                onMouseLeave={e => (e.currentTarget.style.background = "var(--color-surface)")}>
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar
              </button>
            </div>

            {/* Email chip */}
            <AnimatePresence>
              {email && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl text-sm"
                  style={{ background: "var(--color-background)", border: "1px solid var(--color-border)" }}>
                  <div className="flex items-center gap-2 text-muted">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-xs">Código enviado para <strong className="text-text">{email}</strong>. Verifique a caixa de entrada e spam.</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
