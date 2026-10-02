import { useEffect, useState } from "react";
import {
  Check, X, Zap, Crown, Sparkles, AlertTriangle,
  Shield, Headphones, BarChart3, Brain, CreditCard,
  RefreshCw, Users, FileText, Clock,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { api, apiErrorMessage } from "../services/api";
import { confirmDialog } from "../components/confirm";
import toast from "react-hot-toast";

// ─── Plan definitions ────────────────────────────────────────────────────────
const PLANS = [
  {
    id: "FREE",
    name: "Grátis",
    label: "Trial",
    price: 0,
    description: "Para conhecer a plataforma",
    icon: Zap,
    features: [
      { text: "Dashboard básica", ok: true },
      { text: "7 dias de trial", ok: true },
      { text: "Transações", ok: false },
      { text: "Cartões", ok: false },
      { text: "Relatórios", ok: false },
      { text: "Exportação PDF/Excel", ok: false },
      { text: "Finix IA", ok: false },
      { text: "Suporte prioritário", ok: false },
    ],
  },
  {
    id: "BASIC",
    name: "Básico",
    label: "Profissional",
    price: 10,
    description: "Para autônomos e freelancers",
    icon: Crown,
    features: [
      { text: "1 usuário · 2 contas", ok: true },
      { text: "500 movimentações/mês", ok: true },
      { text: "2 cartões de crédito", ok: true },
      { text: "DRE Gerencial automático", ok: true },
      { text: "Calendário financeiro", ok: true },
      { text: "Importação OFX/XLS/CSV", ok: true },
      { text: "Finix IA", ok: false },
      { text: "Suporte via e-mail", ok: true },
    ],
    highlighted: false,
  },
  {
    id: "PRO",
    name: "Pro",
    label: "Empresas",
    price: 35,
    description: "Para pequenas empresas",
    icon: Sparkles,
    badge: "Mais popular",
    features: [
      { text: "5 usuários · Ilimitado", ok: true },
      { text: "Movimentações ilimitadas", ok: true },
      { text: "Cartões ilimitados", ok: true },
      { text: "DRE por centro de custo", ok: true },
      { text: "Fluxo de caixa projetado", ok: true },
      { text: "Importação + Conciliação", ok: true },
      { text: "Finix IA — análise e chat", ok: true },
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
  { feature: "Finix IA", icon: Brain, free: "—", basic: "—", pro: "✓" },
  { feature: "Relatórios PDF/Excel", icon: BarChart3, free: "—", basic: "PDF", pro: "PDF + Excel" },
  { feature: "Suporte", icon: Headphones, free: "—", basic: "E-mail", pro: "WhatsApp + E-mail" },
];

// ─── Downgrade modal ─────────────────────────────────────────────────────────
function DowngradeModal({ onConfirm, onClose, loading }: {
  onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel relative w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} title="Fechar" className="absolute right-4 top-4 p-1.5 rounded-lg transition-colors hover:bg-[var(--color-card-hover)]" style={{ color: "var(--color-text-low)" }}>
          <X className="w-4 h-4" />
        </button>
        <AlertTriangle className="w-6 h-6 mb-4" style={{ color: "var(--color-warning)" }} />
        <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--color-text)" }}>Fazer downgrade?</h2>
        <p className="text-sm mb-5" style={{ color: "var(--color-text-muted)" }}>
          Você perderá acesso à Finix IA, relatórios avançados, centros de custo e suporte via WhatsApp.
        </p>
        <div className="flex gap-2.5">
          <button onClick={onClose} className="btn-outline flex-1 text-sm">Manter Pro</button>
          <button onClick={onConfirm} disabled={loading} className="btn-primary flex-1 text-sm">
            {loading ? "Processando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Plans page ──────────────────────────────────────────────────────────────
export default function Plans() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [plans, setPlans] = useState(PLANS);
  const [downgradeOpen, setDowngradeOpen] = useState(false);

  useEffect(() => {
    api.get("/api/plans").then(r => {
      const remote: { id: string; monthlyPrice?: number }[] = r.data;
      setPlans(cur => cur.map(p => {
        const rm = remote.find(x => x.id === p.id);
        return rm ? { ...p, price: rm.monthlyPrice ?? p.price } : p;
      }));
    }).catch(() => {});
  }, []);

  const handleUpgrade = async (planId: string) => {
    if (planId === "FREE" || planId === user?.plan) return;
    if (user?.plan === "PRO" && planId === "BASIC") {
      setDowngradeOpen(true);
      return;
    }
    setLoading(planId);
    try {
      const r = await api.post("/api/stripe/checkout", { plan_id: planId });
      if (r.data?.url) window.location.href = r.data.url;
      else toast.error("Nenhuma URL de pagamento retornada.");
    } catch (e) {
      toast.error(apiErrorMessage(e) || "Erro ao iniciar checkout.");
    } finally { setLoading(null); }
  };

  const handleDowngrade = async () => {
    setLoading("downgrade");
    try {
      const r = await api.post("/api/stripe/change-plan", { plan_id: "BASIC" });
      toast.success(r.data?.message || "Plano alterado.");
      await refreshUser();
      setDowngradeOpen(false);
    } catch (e) {
      toast.error(apiErrorMessage(e) || "Erro ao alterar plano.");
    } finally { setLoading(null); }
  };

  const handleCancel = async () => {
    if (!user || user.plan === "FREE") return;
    if (!(await confirmDialog({
      title: "Cancelar assinatura?",
      message: "Você mantém o plano até o fim do período já pago e depois volta ao Grátis.",
      confirmLabel: "Cancelar assinatura",
      cancelLabel: "Manter plano",
      danger: true,
    }))) return;
    setLoading("cancel");
    try {
      const r = await api.post("/api/stripe/cancel-subscription", {});
      toast.success(r.data?.message || "Assinatura cancelada.");
      await refreshUser();
    } catch (e) {
      toast.error(apiErrorMessage(e) || "Erro ao cancelar.");
    } finally { setLoading(null); }
  };

  const currentPlan = plans.find(p => p.id === user?.plan);

  return (
    <>
      {downgradeOpen && (
        <DowngradeModal onConfirm={handleDowngrade} onClose={() => setDowngradeOpen(false)} loading={loading === "downgrade"} />
      )}

      <div className="space-y-8 pb-10">
        {/* ── HEADER ──────────────────────────────────────────────── */}
        <header>
          <h1 className="page-title" style={{ color: "var(--color-text)" }}>Planos</h1>
          <p className="page-subtitle" style={{ color: "var(--color-text-low)" }}>
            Escolha o plano ideal para sua realidade. Cancele quando quiser, sem multa.
            {currentPlan && <> Seu plano atual é o <strong style={{ color: "var(--color-text)" }}>{currentPlan.name}</strong>.</>}
          </p>
        </header>

        {/* ── CARDS ───────────────────────────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map(plan => {
            const Icon = plan.icon;
            const isCurrent = plan.id === user?.plan;
            const isDowngrade = user?.plan === "PRO" && plan.id === "BASIC";

            let btnLabel = "Escolher plano";
            if (isCurrent) btnLabel = "Plano atual";
            else if (loading === plan.id) btnLabel = "Redirecionando...";
            else if (loading === "downgrade" && isDowngrade) btnLabel = "Processando...";
            else if (isDowngrade) btnLabel = "Fazer downgrade";
            else if (plan.id === "FREE") btnLabel = "Plano gratuito";

            const btnDisabled = isCurrent || plan.id === "FREE" || !!loading;
            const primaryCta = plan.highlighted && !isCurrent;

            return (
              <section key={plan.id} className="card flex flex-col gap-5"
                style={plan.highlighted ? { borderColor: "var(--color-primary)" } : undefined}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" style={{ color: "var(--color-primary)" }} />
                    <div>
                      <div className="font-semibold" style={{ color: "var(--color-text)" }}>{plan.name}</div>
                      <div className="text-xs" style={{ color: "var(--color-text-low)" }}>{plan.label}</div>
                    </div>
                  </div>
                  {isCurrent ? (
                    <span className="chip" style={{ background: "var(--color-primary-soft)", color: "var(--color-primary)" }}>Ativo</span>
                  ) : plan.badge ? (
                    <span className="chip" style={{ background: "var(--color-hairline-strong)", color: "var(--color-text-muted)" }}>{plan.badge}</span>
                  ) : null}
                </div>

                <div>
                  <div className="flex items-baseline gap-1.5">
                    {plan.price === 0 ? (
                      <span className="text-3xl font-semibold" style={{ color: "var(--color-text)" }}>Grátis</span>
                    ) : (
                      <>
                        <span className="text-sm" style={{ color: "var(--color-text-low)" }}>R$</span>
                        <span className="text-3xl font-semibold num" style={{ color: "var(--color-text)" }}>
                          {plan.price.toFixed(2).replace(".", ",")}
                        </span>
                        <span className="text-sm" style={{ color: "var(--color-text-low)" }}>/mês</span>
                      </>
                    )}
                  </div>
                  <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>{plan.description}</p>
                </div>

                <button onClick={() => handleUpgrade(plan.id)} disabled={btnDisabled}
                  className={`${primaryCta ? "btn-primary" : "btn-outline"} w-full text-sm disabled:opacity-60 disabled:pointer-events-none`}>
                  {isCurrent && <Check className="w-4 h-4" />} {btnLabel}
                </button>

                <ul className="space-y-2.5">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm"
                      style={{ color: f.ok ? "var(--color-text)" : "var(--color-text-low)" }}>
                      {f.ok
                        ? <Check className="w-4 h-4 shrink-0" style={{ color: "var(--color-income)" }} />
                        : <X className="w-4 h-4 shrink-0" style={{ color: "var(--color-border-strong)" }} />}
                      <span className={f.ok ? "" : "line-through"}>{f.text}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        {/* ── COMPARISON TABLE ────────────────────────────────────── */}
        <section className="card !p-0 overflow-hidden">
          <h2 className="px-5 py-4 text-sm font-semibold" style={{ color: "var(--color-text)", borderBottom: "1px solid var(--color-border)" }}>
            Comparativo completo
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <th className="py-3 px-5 text-left text-xs font-medium" style={{ color: "var(--color-text-low)", width: "40%" }}>Recurso</th>
                  {["Grátis", "Básico", "Pro"].map(p => (
                    <th key={p} className="py-3 px-4 text-center text-xs font-medium" style={{ color: "var(--color-text-low)" }}>{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row, i) => (
                  <tr key={row.feature} style={{ borderBottom: i < COMPARE.length - 1 ? "1px solid var(--color-hairline-strong)" : undefined }}>
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2.5" style={{ color: "var(--color-text-muted)" }}>
                        <row.icon className="w-4 h-4 shrink-0" style={{ color: "var(--color-text-low)" }} />
                        {row.feature}
                      </div>
                    </td>
                    {[row.free, row.basic, row.pro].map((val, vi) => (
                      <td key={vi} className="py-3 px-4 text-center font-medium"
                        style={{ color: val === "—" ? "var(--color-border-strong)" : val === "✓" ? "var(--color-income)" : "var(--color-text)" }}>
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── TRUST STRIP ─────────────────────────────────────────── */}
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { icon: Shield, title: "Pagamento seguro", desc: "Processado pelo Stripe, com conexão criptografada" },
            { icon: Clock, title: "Cancele quando quiser", desc: "Sem fidelidade, sem multa — assinatura flexível" },
            { icon: Headphones, title: "Suporte humano", desc: "Time brasileiro disponível por e-mail e WhatsApp" },
          ].map(t => (
            <div key={t.title} className="card !p-4 flex items-start gap-3">
              <t.icon className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--color-primary)" }} />
              <div>
                <div className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>{t.title}</div>
                <div className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--color-text-low)" }}>{t.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── FAQ ─────────────────────────────────────────────────── */}
        <section className="max-w-2xl">
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--color-text)" }}>Perguntas frequentes</h2>
          <div className="space-y-2">
            {[
              { q: "Posso mudar de plano a qualquer momento?", a: "Sim. Upgrades entram em vigor imediatamente, e a troca do Pro para o Básico também é aplicada na hora, com o valor ajustado na fatura." },
              { q: "O que acontece ao fazer downgrade do Pro para o Básico?", a: "Você perde Finix IA, relatórios avançados, DRE por centro de custo e suporte via WhatsApp. Seus dados permanecem salvos." },
              { q: "Há cobrança recorrente?", a: "Sim. Básico e Pro são cobrados mensalmente via Stripe. Cancele sem multa a qualquer momento." },
              { q: "Preciso de cartão para o trial grátis?", a: "Não. Contas novas usam os recursos do plano Básico por 7 dias sem cartão. Cartão só é necessário para assinar um plano pago." },
            ].map(item => (
              <details key={item.q} className="group card !p-0 cursor-pointer">
                <summary className="flex items-center justify-between p-4 font-medium text-sm select-none" style={{ color: "var(--color-text)" }}>
                  {item.q}
                  <span className="ml-4 text-lg transition-transform group-open:rotate-45" style={{ color: "var(--color-text-low)" }}>+</span>
                </summary>
                <p className="px-4 pb-4 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── CANCEL ──────────────────────────────────────────────── */}
        {user?.plan !== "FREE" && (
          <section className="card flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-md">
              <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Cancelar assinatura</p>
              <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                Ao cancelar, você mantém o plano até o fim do período já pago e depois volta ao Grátis. Seus dados continuam salvos.
                {user?.plan === "PRO" && " Considere fazer downgrade para o Básico antes."}
              </p>
            </div>
            <button onClick={handleCancel} disabled={loading === "cancel"}
              className="btn-outline shrink-0 text-sm disabled:opacity-60"
              style={{ color: "var(--color-expense)" }}>
              {loading === "cancel" ? "Cancelando..." : "Cancelar assinatura"}
            </button>
          </section>
        )}
      </div>
    </>
  );
}
