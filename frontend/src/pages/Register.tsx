import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { Eye, EyeOff, Loader2, Mail, Lock, User as UserIcon, ArrowRight, Check, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Logo } from "../components/Logo";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";

const schema = yup.object({
  name: yup.string().min(2, "Nome muito curto").required("Informe seu nome"),
  email: yup.string().email("E-mail inválido").required("Informe seu e-mail"),
  password: yup.string().min(6, "Mínimo 6 caracteres").required("Crie uma senha"),
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

const PERKS = [
  "Dashboard completo com gráficos em tempo real",
  "Metas financeiras com progresso automático",
  "Exportação em PDF e Excel",
  "Insights com inteligência artificial",
  "Alertas inteligentes de orçamento",
];

export default function Register() {
  const { register: signup } = useAuth();
  const nav = useNavigate();
  const [show, setShow] = useState(false);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: yupResolver(schema) });

  const password = watch("password", "");
  const strength = password.length >= 10 ? 3 : password.length >= 6 ? 2 : password.length > 0 ? 1 : 0;
  const strengthColors = ["", "#ef4444", "#f59e0b", "#22c55e"];
  const strengthLabels = ["", "Fraca", "Moderada", "Forte"];

  const onSubmit = async (data: Form) => {
    try {
      await signup(data.name, data.email, data.password);
      toast.success("Conta criada! Verifique seu e-mail.");
      nav("/verify-email", { state: { email: data.email } });
    } catch (e: any) {
      toast.error(e.message || "Falha ao cadastrar");
    }
  };

  const handleGoogleSignup = () => {
    window.location.href = `${API_URL}/google`;
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">

      {/* ── Left panel — dark, estilo landing hero ─────────────────── */}
      <div className="hidden lg:flex flex-col justify-between relative overflow-hidden bg-auth-side p-12">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-brand-blue/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-[400px] h-[400px] rounded-full bg-brand-green/20 blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10">
          <Logo className="[&_span]:!text-white" />
        </div>

        {/* Content */}
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.65 }}
          className="relative z-10 space-y-6">
          <div className="chip bg-white/10 text-white border border-white/20 backdrop-blur w-fit">
            <Sparkles className="w-3.5 h-3.5" /> Grátis para sempre
          </div>
          <h2 className="text-[40px] font-display font-extrabold leading-tight text-white">
            Transforme seus<br />gastos em resultados.
          </h2>
          <p className="text-base text-white/65 leading-relaxed max-w-sm">
            Crie sua conta em segundos e tenha clareza total sobre para onde vai seu dinheiro.
          </p>

          <ul className="space-y-3 pt-1">
            {PERKS.map((perk, i) => (
              <motion.li key={perk} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className="flex items-center gap-3 text-white/75 text-sm">
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-brand-green/20 border border-brand-green/30">
                  <Check className="w-3 h-3 text-brand-green" />
                </div>
                {perk}
              </motion.li>
            ))}
          </ul>
        </motion.div>

        {/* Bottom */}
        <div className="relative z-10 flex items-center gap-2 rounded-2xl px-4 py-3"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <span className="text-xl">🔒</span>
          <div>
            <p className="text-xs font-bold text-white">Dados protegidos</p>
            <p className="text-[11px] text-white/45">Stripe · SSL 256-bit · LGPD</p>
          </div>
        </div>
      </div>

      {/* ── Right panel — light ─────────────────────────────────────── */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-surface">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
          className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <Logo />
          </div>

          <h1 className="text-3xl font-display font-extrabold tracking-tight text-text">
            Criar conta
          </h1>
          <p className="text-muted mt-1 text-sm">
            Já tem conta?{" "}
            <Link to="/login" className="text-brand-blue font-semibold hover:underline" data-testid="goto-login">
              Entrar
            </Link>
          </p>

          <div className="mt-7 space-y-4">
            {/* Google button */}
            <button onClick={handleGoogleSignup}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-xl font-semibold text-sm text-text transition-all hover:bg-surface-strong active:scale-[0.98]"
              style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
              <GoogleIcon />
              Cadastrar com Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted font-medium">ou cadastre com e-mail</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" data-testid="register-form">
              <div>
                <label className="text-sm font-medium text-text block mb-1.5">Nome completo</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input {...register("name")} data-testid="register-name"
                    className="input pl-10" placeholder="Seu nome" />
                </div>
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="text-sm font-medium text-text block mb-1.5">E-mail</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input {...register("email")} type="email" data-testid="register-email"
                    className="input pl-10" placeholder="voce@email.com" />
                </div>
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="text-sm font-medium text-text block mb-1.5">Senha</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input {...register("password")} type={show ? "text" : "password"} data-testid="register-password"
                    className="input pl-10 pr-10" placeholder="Mínimo 6 caracteres" />
                  <button type="button" onClick={() => setShow(!show)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors">
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Password strength */}
                {password.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex gap-1 flex-1">
                      {[1,2,3].map(i => (
                        <div key={i} className="h-1 flex-1 rounded-full transition-all"
                          style={{ background: i <= strength ? strengthColors[strength] : "var(--color-border)" }} />
                      ))}
                    </div>
                    <span className="text-[10px] font-semibold" style={{ color: strengthColors[strength] }}>
                      {strengthLabels[strength]}
                    </span>
                  </div>
                )}
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
              </div>

              <button type="submit" disabled={isSubmitting} data-testid="register-submit"
                className="btn-primary w-full !py-3">
                {isSubmitting
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <><span>Criar conta gratuitamente</span><ArrowRight className="w-4 h-4" /></>
                }
              </button>
            </form>

            <p className="text-[11px] text-center text-muted">
              Ao criar uma conta, você concorda com nossos{" "}
              <span className="font-semibold text-brand-blue cursor-pointer">Termos de Uso</span>{" "}
              e{" "}
              <span className="font-semibold text-brand-blue cursor-pointer">Política de Privacidade</span>.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
