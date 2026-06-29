import { FormEvent, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Mail, ArrowLeft, RefreshCw, Loader2, ShieldCheck, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "../components/Logo";
import toast from "react-hot-toast";

const API = import.meta.env.VITE_API_URL;

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
    // auto-submit on last digit
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
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const filled = code.filter(Boolean).length;

  // ── Success state ──────────────────────────────────────────────────────────
  if (isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#040406" }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(16,185,129,0.12) 0%, transparent 65%)" }} />
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center relative z-10 max-w-sm">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", damping: 12, delay: 0.1 }}
            className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ background: "rgba(16,185,129,0.15)", border: "2px solid rgba(16,185,129,0.4)" }}>
            <CheckCircle className="w-10 h-10" style={{ color: "#10b981" }} />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h1 className="text-3xl font-black text-white mb-2">E-mail verificado!</h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Sua conta foi ativada com sucesso. Redirecionando…</p>
            <div className="mt-6 flex items-center justify-center gap-1.5">
              {[0,1,2].map(i => (
                <motion.div key={i} className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "#10b981" }}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
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
    <div className="min-h-screen flex" style={{ background: "#040406" }}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[46%] relative overflow-hidden p-12"
        style={{ borderRight: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 30% 40%, rgba(16,185,129,0.1) 0%, transparent 65%)" }} />
        <div className="relative z-10">
          <Logo className="[&_span]:!text-white" />
        </div>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="relative z-10 space-y-5">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
            <ShieldCheck className="w-8 h-8" style={{ color: "#10b981" }} />
          </div>
          <h2 className="text-[40px] font-black leading-[1.1] tracking-tight text-white">
            Proteja sua<br />
            <span style={{ background: "linear-gradient(90deg,#10b981,#38bdf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              conta.
            </span>
          </h2>
          <p className="text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
            A verificação de e-mail garante que somente você tem acesso à sua conta e aos seus dados financeiros.
          </p>
          <div className="space-y-3 pt-2">
            {[
              { n: "1", t: "Abra seu e-mail", d: "Verifique a caixa de entrada" },
              { n: "2", t: "Copie o código", d: "6 dígitos enviados por nós" },
              { n: "3", t: "Cole aqui e confirme", d: "Conta ativa em segundos" },
            ].map(step => (
              <div key={step.n} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full text-xs font-black flex items-center justify-center shrink-0"
                  style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.25)", color: "#34d399" }}>
                  {step.n}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{step.t}</div>
                  <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.3)" }}>{step.d}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
        <div className="relative z-10 text-[11px]" style={{ color: "rgba(255,255,255,0.2)" }}>
          A Finix jamais solicitará seu código por WhatsApp ou telefone.
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.03) 0%, transparent 55%)" }} />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="relative w-full max-w-[380px]">
          <div className="lg:hidden flex justify-center mb-8">
            <Logo className="[&_span]:!text-white" />
          </div>

          {/* Email chip */}
          <AnimatePresence>
            {email && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 mb-6 px-3 py-2 rounded-full w-fit"
                style={{ background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.18)" }}>
                <Mail className="w-3.5 h-3.5" style={{ color: "#38bdf8" }} />
                <span className="text-xs font-semibold" style={{ color: "#7dd3fc" }}>{email}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mb-7">
            <h1 className="text-2xl font-black text-white tracking-tight">Digite seu código</h1>
            <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
              Enviamos um código de 6 dígitos para seu e-mail.
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-5">
            {/* Email input (if not pre-filled) */}
            {!location.state?.email && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Seu e-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(255,255,255,0.25)" }} />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="voce@email.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 outline-none transition-all"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }} />
                </div>
              </div>
            )}

            {/* OTP boxes */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
                Código de verificação
              </label>
              <div className="flex gap-2.5" onPaste={handlePaste}>
                {code.map((digit, index) => (
                  <motion.input key={index}
                    ref={el => { inputRefs.current[index] = el; }}
                    id={`code-${index}`}
                    value={digit}
                    onChange={e => handleCodeChange(index, e.target.value)}
                    onKeyDown={e => handleKeyDown(index, e)}
                    className="flex-1 h-14 text-center text-2xl font-black text-white rounded-xl outline-none transition-all"
                    style={{
                      background: digit ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.04)",
                      border: digit ? "1px solid rgba(16,185,129,0.4)" : "1px solid rgba(255,255,255,0.09)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                    onFocus={e => { e.target.style.borderColor = "rgba(16,185,129,0.6)"; e.target.style.boxShadow = "0 0 0 3px rgba(16,185,129,0.1)"; }}
                    onBlur={e => {
                      if (!digit) { e.target.style.borderColor = "rgba(255,255,255,0.09)"; e.target.style.boxShadow = ""; }
                      else { e.target.style.borderColor = "rgba(16,185,129,0.4)"; e.target.style.boxShadow = ""; }
                    }}
                    maxLength={1}
                    inputMode="numeric"
                    animate={digit ? { scale: [1, 1.08, 1] } : {}}
                    transition={{ duration: 0.15 }}
                  />
                ))}
              </div>
              {/* Progress indicator */}
              <div className="flex gap-1 mt-3">
                {code.map((d, i) => (
                  <div key={i} className="flex-1 h-0.5 rounded-full transition-all"
                    style={{ background: d ? "#10b981" : "rgba(255,255,255,0.07)" }} />
                ))}
              </div>
              <p className="text-[10px] mt-1.5 text-right font-medium"
                style={{ color: filled === 6 ? "#34d399" : "rgba(255,255,255,0.25)" }}>
                {filled}/6 dígitos
              </p>
            </div>

            <button id="verify-submit" type="submit" disabled={isLoading || code.join("").length < 6}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,#10b981,#059669)", boxShadow: "0 4px 20px rgba(16,185,129,0.3)" }}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Verificar e-mail"}
            </button>
          </form>

          {/* Resend + Back */}
          <div className="flex gap-2 mt-4">
            <button onClick={handleResend} disabled={!canResend || isResending}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:bg-white/5 disabled:opacity-40"
              style={{ border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}>
              {isResending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {canResend ? "Reenviar" : `Reenviar em ${countdown}s`}
            </button>
            <button onClick={() => navigate("/register")}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:bg-white/5"
              style={{ border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }}>
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
