import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, X, Zap, Crown, Sparkles, AlertTriangle,
  Shield, Headphones, BarChart3, Brain, CreditCard,
  RefreshCw, Users, FileText, Clock, Star,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/api";
import toast from "react-hot-toast";

// ─── Plan definitions ────────────────────────────────────────────────────────
const PLANS = [
  {
    id: "FREE",
    name: "Grátis",
    label: "Trial",
    price: 0,
    annualPrice: 0,
    description: "Para conhecer a plataforma",
    icon: Zap,
    accent: "#71717a",
    glow: "rgba(113,113,122,0)",
    border: "rgba(113,113,122,0.2)",
    features: [
      { text: "Dashboard básica", ok: true },
      { text: "7 dias de trial", ok: true },
      { text: "Transações", ok: false },
      { text: "Cartões", ok: false },
      { text: "Relatórios", ok: false },
      { text: "Exportação PDF/Excel", ok: false },
      { text: "IA Fingu", ok: false },
      { text: "Suporte prioritário", ok: false },
    ],
  },
  {
    id: "BASIC",
    name: "Básico",
    label: "Profissional",
    price: 10,
    annualPrice: 8,
    description: "Para autônomos e freelancers",
    icon: Crown,
    accent: "#3b82f6",
    glow: "rgba(59,130,246,0.15)",
    border: "rgba(59,130,246,0.3)",
    features: [
      { text: "1 usuário · 2 contas", ok: true },
      { text: "500 movimentações/mês", ok: true },
      { text: "2 cartões de crédito", ok: true },
      { text: "DRE Gerencial automático", ok: true },
      { text: "Calendário financeiro", ok: true },
      { text: "Importação OFX/XLS/CSV", ok: true },
      { text: "IA Fingu", ok: false },
      { text: "Suporte via e-mail", ok: true },
    ],
    highlighted: false,
  },
  {
    id: "PRO",
    name: "Pro",
    label: "Empresas",
    price: 35,
    annualPrice: 28,
    description: "Para pequenas empresas",
    icon: Sparkles,
    accent: "#f59e0b",
    glow: "rgba(245,158,11,0.18)",
    border: "rgba(245,158,11,0.5)",
    badge: "Mais popular",
    features: [
      { text: "5 usuários · Ilimitado", ok: true },
      { text: "Movimentações ilimitadas", ok: true },
      { text: "Cartões ilimitados", ok: true },
      { text: "DRE por centro de custo", ok: true },
      { text: "Fluxo de caixa projetado", ok: true },
      { text: "Importação + Conciliação", ok: true },
      { text: "IA Fingu — análise e chat", ok: true },
      { text: "Suporte prioritário WhatsApp", ok: true },
    ],
    highlighted: true,
  },
];

const COMPARE = [
  { feature: "Usuários", icon: Users, free: "—", basic: "1", pro: "5" },
  { feature: "Movimentações", icon: RefreshCw, free: "—", basic: "500/mês", pro: "Ilimitadas" },
  { feature: "Contas bancárias", icon: CreditCard, free: "—", basic: "2", pro: "Ilimitadas" },
  { feature: "Cartões de crédito", icon: CreditCard, free: "—", basic: "2", pro: "Ilimitados" },
  { feature: "DRE Gerencial", icon: FileText, free: "—", basic: "✓", pro: "✓" },
  { feature: "IA Fingu", icon: Brain, free: "—", basic: "—", pro: "✓" },
  { feature: "Relatórios PDF/Excel", icon: BarChart3, free: "—", basic: "PDF", pro: "PDF + Excel" },
  { feature: "Suporte", icon: Headphones, free: "—", basic: "E-mail", pro: "WhatsApp + E-mail" },
];

// ─── Downgrade modal ─────────────────────────────────────────────────────────
function DowngradeModal({ onConfirm, onClose, loading }: {
  targetPlan?: typeof PLANS[0]; onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.94, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94 }}
        className="relative w-full max-w-sm rounded-2xl p-7 shadow-2xl"
        style={{ background: "#111113", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1.5 transition-colors hover:bg-white/5" style={{ color: "rgba(255,255,255,0.3)" }}>
          <X className="w-4 h-4" />
        </button>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)" }}>
          <AlertTriangle className="w-6 h-6 text-amber-400" />
        </div>
        <h2 className="text-lg font-black text-white mb-2">Fazer downgrade?</h2>
        <p className="text-sm mb-5" style={{ color: "rgba(255,255,255,0.45)" }}>
          Você perderá acesso à IA Fingu, relatórios avançados, centros de custo e suporte via WhatsApp.
        </p>
        <div className="flex gap-2.5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:bg-white/5"
            style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
            Manter Pro
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "#f59e0b" }}>
            {loading ? "Processando..." : "Confirmar"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Plans page ──────────────────────────────────────────────────────────────
export default function Plans() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [plans, setPlans] = useState(PLANS);
  const [downgradeTarget, setDowngradeTarget] = useState<typeof PLANS[0] | null>(null);
  const [annual, setAnnual] = useState(false);

  useEffect(() => {
    api.get("/api/plans").then(r => {
      const remote = r.data;
      setPlans(cur => cur.map(p => {
        const rm = remote.find((x: any) => x.id === p.id);
        return rm ? { ...p, price: rm.monthlyPrice ?? p.price } : p;
      }));
    }).catch(() => {});
  }, []);

  const handleUpgrade = async (planId: string) => {
    if (planId === "FREE" || planId === user?.plan) return;
    if (user?.plan === "PRO" && planId === "BASIC") {
      setDowngradeTarget(plans.find(p => p.id === "BASIC")!);
      return;
    }
    setLoading(planId);
    try {
      const r = await api.post("/api/stripe/checkout", { plan_id: planId });
      if (r.data?.url) window.location.href = r.data.url;
      else toast.error("Nenhuma URL de pagamento retornada.");
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || "Erro ao iniciar checkout.");
    } finally { setLoading(null); }
  };

  const handleDowngrade = async () => {
    if (!downgradeTarget) return;
    setLoading("downgrade");
    try {
      const r = await api.post("/api/stripe/change-plan", { plan_id: downgradeTarget.id });
      toast.success(r.data?.message || "Plano alterado.");
      await refreshUser();
      setDowngradeTarget(null);
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || "Erro ao alterar plano.");
    } finally { setLoading(null); }
  };

  const handleCancel = async () => {
    if (!user || user.plan === "FREE") return;
    if (!window.confirm("Cancelar assinatura? Você voltará ao plano Grátis.")) return;
    setLoading("cancel");
    try {
      const r = await api.post("/api/stripe/cancel-subscription", {});
      toast.success(r.data?.message || "Assinatura cancelada.");
      await refreshUser();
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || "Erro ao cancelar.");
    } finally { setLoading(null); }
  };

  const currentPlan = plans.find(p => p.id === user?.plan);

  return (
    <>
      <AnimatePresence>
        {downgradeTarget && (
          <DowngradeModal targetPlan={downgradeTarget} onConfirm={handleDowngrade}
            onClose={() => setDowngradeTarget(null)} loading={loading === "downgrade"} />
        )}
      </AnimatePresence>

      <div className="space-y-10 pb-10">

        {/* ── HERO ────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl overflow-hidden text-center py-10 px-6"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.08) 0%, transparent 60%)" }} />

          {/* Stars */}
          <div className="flex items-center justify-center gap-1 mb-4">
            {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
            <span className="ml-2 text-xs font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>4.9/5 · 5.800+ clientes</span>
          </div>

          <h1 className="text-4xl font-black tracking-tight mb-2">
            <span style={{ color: "var(--color-text)" }}>Planos &amp; </span>
            <span style={{ background: "linear-gradient(90deg,#f59e0b,#fbbf24)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Preços
            </span>
          </h1>
          <p className="text-sm max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.4)" }}>
            Escolha o plano ideal para sua realidade. Cancele quando quiser, sem multa.
          </p>

          {/* Current plan badge */}
          {currentPlan && (
            <div className="inline-flex items-center gap-3 mt-5 px-4 py-2.5 rounded-full"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>Plano atual</span>
              <span className="text-sm font-black" style={{ color: "var(--color-text)" }}>{currentPlan.name}</span>
              {user?.plan !== "FREE" && (
                <button onClick={handleCancel} disabled={loading === "cancel"}
                  className="text-[11px] font-bold text-rose-400 hover:text-rose-300 transition disabled:opacity-50 ml-1">
                  {loading === "cancel" ? "…" : "Cancelar"}
                </button>
              )}
            </div>
          )}

          {/* Annual toggle */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <span className="text-sm font-medium" style={{ color: annual ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.8)" }}>Mensal</span>
            <div className="relative w-11 h-6 cursor-pointer" onClick={() => setAnnual(p => !p)}>
              <div className="w-11 h-6 rounded-full transition-colors"
                style={{ background: annual ? "#10b981" : "rgba(255,255,255,0.12)" }} />
              <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                style={{ transform: annual ? "translateX(22px)" : "translateX(2px)" }} />
            </div>
            <span className="text-sm font-medium" style={{ color: annual ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)" }}>Anual</span>
            {annual && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="text-[10px] font-black px-2 py-0.5 rounded-full"
                style={{ background: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(16,185,129,0.25)" }}>
                ECONOMIZE 20%
              </motion.span>
            )}
          </div>
        </motion.div>

        {/* ── CARDS ───────────────────────────────────────────────── */}
        <div className="grid gap-5 md:grid-cols-3">
          {plans.map((plan, idx) => {
            const Icon = plan.icon;
            const isCurrent = plan.id === user?.plan;
            const isDowngrade = user?.plan === "PRO" && plan.id === "BASIC";
            const displayPrice = annual && plan.price > 0 ? plan.annualPrice : plan.price;

            let btnLabel = "Escolher plano";
            if (isCurrent) btnLabel = "Plano atual";
            else if (loading === plan.id) btnLabel = "Redirecionando...";
            else if (loading === "downgrade" && isDowngrade) btnLabel = "Processando...";
            else if (isDowngrade) btnLabel = "Fazer downgrade";
            else if (plan.id === "FREE") btnLabel = "Plano gratuito";

            const btnDisabled = isCurrent || plan.id === "FREE" || !!loading;

            return (
              <motion.div key={plan.id}
                initial={{ opacity: 0, y: 24 }}
                animate={plan.highlighted ? {
                  opacity: 1, y: 0,
                  boxShadow: [
                    `0 0 0 1px ${plan.border}, 0 20px 50px ${plan.glow}`,
                    `0 0 0 1px rgba(245,158,11,0.7), 0 30px 70px rgba(245,158,11,0.28)`,
                    `0 0 0 1px ${plan.border}, 0 20px 50px ${plan.glow}`,
                  ],
                } : { opacity: 1, y: 0 }}
                transition={plan.highlighted
                  ? { boxShadow: { duration: 3, repeat: Infinity }, opacity: { duration: 0.5, delay: idx * 0.08 }, y: { duration: 0.5, delay: idx * 0.08 } }
                  : { delay: idx * 0.08, type: "spring", damping: 22 }
                }
                className={`relative rounded-2xl overflow-hidden flex flex-col ${plan.highlighted ? "md:-translate-y-1" : ""}`}
                style={{
                  background: plan.highlighted
                    ? `radial-gradient(ellipse at 50% 0%, ${plan.glow} 0%, rgba(17,17,19,0) 65%), #111113`
                    : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isCurrent ? plan.border : plan.highlighted ? plan.border : "rgba(255,255,255,0.08)"}`,
                }}>

                {/* Popular badge */}
                {plan.badge && (
                  <div className="absolute top-0 left-0 right-0 text-center py-1.5 text-[10px] font-black uppercase tracking-widest"
                    style={{ background: `linear-gradient(90deg,${plan.accent},#fbbf24)`, color: "#000" }}>
                    {plan.badge}
                  </div>
                )}

                {isCurrent && (
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold"
                    style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", color: "#34d399" }}>
                    Ativo
                  </div>
                )}

                <div className={`flex-1 p-6 flex flex-col gap-5 ${plan.badge ? "pt-10" : ""}`}>
                  {/* Icon + name */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${plan.accent}18`, border: `1px solid ${plan.accent}30` }}>
                      <Icon className="w-5 h-5" style={{ color: plan.accent }} />
                    </div>
                    <div>
                      <div className="font-black text-base" style={{ color: "var(--color-text)" }}>{plan.name}</div>
                      <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: plan.accent }}>{plan.label}</div>
                    </div>
                  </div>

                  {/* Price */}
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      {plan.price === 0 ? (
                        <span className="text-4xl font-black" style={{ color: "var(--color-text)" }}>Grátis</span>
                      ) : (
                        <>
                          <span className="text-xl font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>R$</span>
                          <motion.span key={displayPrice}
                            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                            className="text-4xl font-black num" style={{ color: "var(--color-text)" }}>
                            {displayPrice.toFixed(2).replace(".", ",")}
                          </motion.span>
                          <span className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>/mês</span>
                        </>
                      )}
                    </div>
                    {annual && plan.price > 0 && (
                      <p className="text-[11px] mt-0.5" style={{ color: "#34d399" }}>
                        R$ {(displayPrice * 12).toFixed(2).replace(".", ",")} cobrado anualmente
                      </p>
                    )}
                    <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>{plan.description}</p>
                  </div>

                  {/* CTA */}
                  <button onClick={() => handleUpgrade(plan.id)} disabled={btnDisabled}
                    className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-default"
                    style={
                      isCurrent ? { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }
                        : isDowngrade ? { background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#fbbf24" }
                          : plan.highlighted ? { background: `linear-gradient(135deg,${plan.accent},#fbbf24)`, color: "#000", boxShadow: `0 4px 20px ${plan.glow}` }
                            : plan.id === "FREE" ? { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", cursor: "default" }
                              : { background: `rgba(59,130,246,0.12)`, border: "1px solid rgba(59,130,246,0.3)", color: "#60a5fa" }
                    }>
                    {isCurrent ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <Check className="w-4 h-4" /> {btnLabel}
                      </span>
                    ) : btnLabel}
                  </button>

                  {/* Features */}
                  <ul className="space-y-2">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2.5">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: f.ok ? `${plan.accent}18` : "rgba(255,255,255,0.04)" }}>
                          {f.ok
                            ? <Check className="w-2.5 h-2.5" style={{ color: plan.accent }} />
                            : <X className="w-2.5 h-2.5" style={{ color: "rgba(255,255,255,0.2)" }} />}
                        </div>
                        <span className="text-[13px]" style={{ color: f.ok ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)" }}>
                          {f.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── COMPARISON TABLE ────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
            <h2 className="font-black text-sm uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.5)" }}>
              Comparativo completo
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <th className="py-3 px-5 text-left text-xs font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)", width: "40%" }}>
                    Recurso
                  </th>
                  {["Grátis","Básico","Pro"].map((p, i) => (
                    <th key={p} className="py-3 px-4 text-center text-xs font-bold" style={{ color: i === 2 ? "#fbbf24" : "rgba(255,255,255,0.4)" }}>
                      {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row, i) => (
                  <motion.tr key={row.feature}
                    initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                    transition={{ delay: i * 0.04 }}
                    className="group"
                    style={{ borderBottom: i < COMPARE.length - 1 ? "1px solid rgba(255,255,255,0.04)" : undefined }}>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2.5">
                        <row.icon className="w-3.5 h-3.5 shrink-0" style={{ color: "rgba(255,255,255,0.3)" }} />
                        <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>{row.feature}</span>
                      </div>
                    </td>
                    {[row.free, row.basic, row.pro].map((val, vi) => (
                      <td key={vi} className="py-3.5 px-4 text-center text-sm font-semibold"
                        style={{ color: val === "—" ? "rgba(255,255,255,0.15)" : val === "✓" ? "#34d399" : vi === 2 ? "#fbbf24" : "rgba(255,255,255,0.65)" }}>
                        {val}
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* ── TRUST STRIP ─────────────────────────────────────────── */}
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { icon: Shield, title: "Pagamento seguro", desc: "Processado pelo Stripe com criptografia SSL 256-bit", color: "#10b981" },
            { icon: Clock, title: "Cancele quando quiser", desc: "Sem fidelidade, sem multa — assinatura flexível", color: "#38bdf8" },
            { icon: Headphones, title: "Suporte humano", desc: "Time brasileiro disponível por e-mail e WhatsApp", color: "#f59e0b" },
          ].map((t, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex items-start gap-3 rounded-2xl p-4"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${t.color}18`, border: `1px solid ${t.color}28` }}>
                <t.icon className="w-4.5 h-4.5" style={{ color: t.color, width: 18, height: 18 }} />
              </div>
              <div>
                <div className="text-sm font-bold" style={{ color: "var(--color-text)" }}>{t.title}</div>
                <div className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>{t.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── FAQ ─────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          className="max-w-2xl">
          <h2 className="text-xl font-black mb-5" style={{ color: "var(--color-text)" }}>Perguntas frequentes</h2>
          <div className="space-y-2.5">
            {[
              { q: "Posso mudar de plano a qualquer momento?", a: "Sim. Upgrades entram em vigor imediatamente. Downgrades são aplicados no próximo ciclo de cobrança." },
              { q: "O que acontece ao fazer downgrade do Pro para o Básico?", a: "Você perde IA Fingu, relatórios avançados, DRE por centro de custo e suporte via WhatsApp. Seus dados permanecem salvos." },
              { q: "Há cobrança recorrente?", a: "Sim. Básico e Pro são cobrados mensalmente (ou anualmente com 20% de desconto) via Stripe. Cancele sem multa a qualquer momento." },
              { q: "Preciso de cartão para o trial grátis?", a: "Não. O plano Grátis funciona por 7 dias sem cartão. Cartão só é necessário para planos pagos." },
            ].map((item, i) => (
              <details key={i} className="group rounded-2xl overflow-hidden cursor-pointer"
                style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
                <summary className="flex items-center justify-between p-4 font-semibold text-sm select-none"
                  style={{ color: "var(--color-text)" }}>
                  {item.q}
                  <span className="ml-4 text-lg font-bold transition-transform group-open:rotate-45"
                    style={{ color: "rgba(255,255,255,0.3)" }}>+</span>
                </summary>
                <div className="px-4 pb-4 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="pt-3">{item.a}</div>
                </div>
              </details>
            ))}
          </div>
        </motion.div>

        {/* ── CANCEL ZONE ─────────────────────────────────────────── */}
        {user?.plan !== "FREE" && (
          <motion.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="rounded-2xl p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
            style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.12)" }}>
            <div className="max-w-md">
              <p className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-1.5">Zona de cancelamento</p>
              <p className="text-sm font-bold text-white mb-1">Cancelar assinatura</p>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
                Ao cancelar, você volta ao plano Grátis no final do período atual. Seus dados permanecem salvos por 30 dias.
                {user?.plan === "PRO" && " Considere fazer downgrade para o Básico antes."}
              </p>
            </div>
            <button onClick={handleCancel} disabled={loading === "cancel"}
              className="shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold text-rose-400 transition-all hover:bg-rose-500/10 disabled:opacity-50"
              style={{ border: "1px solid rgba(239,68,68,0.25)" }}>
              {loading === "cancel" ? "Cancelando..." : "Cancelar assinatura"}
            </button>
          </motion.div>
        )}
      </div>
    </>
  );
}
