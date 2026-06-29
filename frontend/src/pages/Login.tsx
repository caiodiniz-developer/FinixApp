import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { Eye, EyeOff, Loader2, Mail, Lock, ArrowRight, TrendingUp, Shield, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { Logo } from "../components/Logo";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";

const schema = yup.object({
  email: yup.string().email("E-mail inválido").required("Informe seu e-mail"),
  password: yup.string().min(6, "Mínimo 6 caracteres").required("Informe a senha"),
});
type Form = yup.InferType<typeof schema>;

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Google "G" logo SVG
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.20455C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z" fill="#4285F4"/>
      <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
      <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957275C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
      <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
    </svg>
  );
}

const STATS = [
  { icon: TrendingUp, label: "Crescimento médio", value: "+18%", color: "#4ade80" },
  { icon: Zap, label: "Insights automáticos", value: "IA", color: "#60a5fa" },
  { icon: Shield, label: "Dados protegidos", value: "SSL", color: "#c4b5fd" },
];

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: yupResolver(schema) });

  const onSubmit = async (data: Form) => {
    try {
      await login(data.email, data.password, remember);
      toast.success("Bem-vindo de volta!");
      nav("/app/dashboard");
    } catch (e: any) {
      toast.error(e.message || "Falha ao entrar");
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API_URL}/google`;
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">

      {/* ── Left panel — dark, estilo landing hero ─────────────────── */}
      <div className="hidden lg:flex flex-col justify-between relative overflow-hidden bg-auth-side p-12">
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-brand-purple/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-brand-green/15 blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10">
          <Logo className="[&_span]:!text-white" />
        </div>

        {/* Content */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.65 }}
          className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white/80"
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
            Plataforma ativa
          </div>
          <h2 className="text-[42px] font-display font-extrabold leading-tight text-white">
            Seu dinheiro<br />sob controle total.
          </h2>
          <p className="text-base text-white/65 leading-relaxed max-w-sm">
            Organize gastos, defina metas e tome decisões financeiras com clareza — em um só lugar.
          </p>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            {STATS.map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + i * 0.1 }}
                className="rounded-2xl p-4"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <s.icon className="w-4 h-4 mb-2.5" style={{ color: s.color }} />
                <div className="text-xl font-extrabold text-white leading-none mb-1">{s.value}</div>
                <div className="text-[10px] text-white/45 leading-tight">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Bottom social proof */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex -space-x-2">
            {["#2563eb","#7c3aed","#059669","#dc2626"].map((c, i) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 text-[10px] font-bold text-white flex items-center justify-center"
                style={{ borderColor: "#0f172a", background: c + "cc" }}>
                {["C","A","R","B"][i]}
              </div>
            ))}
          </div>
          <span className="text-sm text-white/45">+5.800 usuários confiam no Finix</span>
        </div>
      </div>

      {/* ── Right panel — light, coherente com landing ─────────────── */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-surface">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
          className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <Logo />
          </div>

          <h1 className="text-3xl font-display font-extrabold tracking-tight text-text">
            Entrar
          </h1>
          <p className="text-muted mt-1 text-sm">
            Não tem conta?{" "}
            <Link to="/register" className="text-brand-blue font-semibold hover:underline" data-testid="goto-register">
              Cadastre-se grátis
            </Link>
          </p>

          <div className="mt-7 space-y-4">
            {/* Google button */}
            <button onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-xl font-semibold text-sm text-text transition-all hover:bg-surface-strong active:scale-[0.98]"
              style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
              <GoogleIcon />
              Continuar com Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted font-medium">ou continue com e-mail</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" data-testid="login-form">
              <div>
                <label className="text-sm font-medium text-text block mb-1.5">E-mail</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input {...register("email")} type="email" autoComplete="email" data-testid="login-email"
                    className="input pl-10" placeholder="voce@email.com" />
                </div>
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="text-sm font-medium text-text block mb-1.5">Senha</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input {...register("password")} type={show ? "text" : "password"} autoComplete="current-password"
                    data-testid="login-password" className="input pl-10 pr-10" placeholder="••••••••" />
                  <button type="button" onClick={() => setShow(!show)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors"
                    data-testid="toggle-password">
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
              </div>

              <div className="flex items-center gap-2.5">
                <input id="remember" type="checkbox" checked={remember} onChange={() => setRemember(p => !p)}
                  className="h-4 w-4 rounded border-border text-brand-blue focus:ring-brand-blue" />
                <label htmlFor="remember" className="text-sm text-text select-none cursor-pointer">Lembre-se de mim</label>
              </div>

              <button type="submit" disabled={isSubmitting} data-testid="login-submit"
                className="btn-primary w-full !py-3">
                {isSubmitting
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <><span>Entrar</span><ArrowRight className="w-4 h-4" /></>
                }
              </button>
            </form>

            {/* Support */}
            <div className="p-4 rounded-xl text-sm text-text"
              style={{ background: "var(--color-background)", border: "1px solid var(--color-border)" }}>
              <p className="font-semibold">Suporte Finix</p>
              <p className="text-muted mt-1 text-xs">Precisa de ajuda? Fale conosco:</p>
              <div className="flex gap-2 mt-2.5">
                <a href="https://wa.me/5519994737425?text=Olá%20Finix" target="_blank" rel="noreferrer"
                  className="btn-outline text-xs py-1.5">WhatsApp</a>
                <a href="mailto:finixappp@gmail.com" className="btn-outline text-xs py-1.5">E-mail</a>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
