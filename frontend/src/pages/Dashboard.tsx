import { useCallback, useEffect, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  FileDown,
  FileSpreadsheet,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { api, apiErrorMessage } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { DashboardData, Insight } from "../types";
import { currency, dateBR, CATEGORY_COLORS } from "../utils/format";
import { UpgradeModal } from "../components/UpgradeModal";
import toast from "react-hot-toast";

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState<Insight[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [alerts, setAlerts] = useState<{ count: number; alerts: any[] } | null>(
    null,
  );
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const isFree = user?.plan === "FREE";
  const canExportPdf = user?.plan !== "FREE";
  const canExportExcel = user?.plan === "PRO";
  const canUseAi = user?.plan !== "FREE";

  const fetchDashboard = useCallback(async () => {
    if (!user) return;
    setError(null);
    setLoading(true);
    try {
      const r = await api.get("/api/dashboard");
      setData(r.data);
    } catch (e: any) {
      const message = apiErrorMessage(e) || "Erro ao carregar dashboard";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchDashboard();
    } else {
      setData(null);
      setError(null);
      setLoading(false);
    }
  }, [user, fetchDashboard]);

  useEffect(() => {
    const fetchAlerts = async () => {
      if (!user) return;
      try {
        const r = await api.get("/api/alerts");
        setAlerts(r.data);
      } catch (err: any) {
        console.error("Failed to load alerts", err);
      }
    };
    fetchAlerts();
  }, [user]);

  if (!user) return null;

  const openUpgradeModal = () => setUpgradeOpen(true);

  const handleExport = async (kind: "pdf" | "excel") => {
    if (
      (kind === "pdf" && !canExportPdf) ||
      (kind === "excel" && !canExportExcel)
    ) {
      openUpgradeModal();
      return;
    }

    try {
      const r = await api.get(`/api/export/${kind}`, { responseType: "blob" });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        kind === "pdf" ? "finix-relatorio.pdf" : "finix-transacoes.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exportado!");
    } catch {
      toast.error("Erro ao exportar");
    }
  };

  const generateAi = async () => {
    if (!canUseAi) {
      openUpgradeModal();
      return;
    }

    setAiLoading(true);
    try {
      const r = await api.post("/api/insights/ai");
      setAiInsights(r.data.insights || []);
      toast.success("Análise da IA pronta!");
    } catch (e: any) {
      toast.error("Falha ao gerar análise");
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-10 w-48 sm:w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-28 sm:h-32" />
          ))}
        </div>
        <div className="skeleton h-60 sm:h-80" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="p-6 rounded-2xl border border-red-900/50 bg-red-950/30 text-red-300">
          <p className="font-semibold">Erro ao carregar dashboard</p>
          <p className="mt-2 text-sm">{error}</p>
          <button onClick={fetchDashboard} className="btn-primary mt-4">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 rounded-2xl border border-border bg-surface-strong text-text">
        <p>Dashboard sem dados.</p>
      </div>
    );
  }

  const stats = [
    {
      label: "Saldo total",
      value: data.balance,
      icon: Wallet,
      color: "from-brand-blue to-brand-purple",
      positive: data.balance >= 0,
    },
    {
      label: "Receitas",
      value: data.income,
      icon: TrendingUp,
      color: "from-emerald-500 to-green-500",
      positive: true,
    },
    {
      label: "Despesas",
      value: data.expense,
      icon: TrendingDown,
      color: "from-rose-500 to-red-500",
      positive: false,
      isExp: true,
    },
    {
      label: "Economizado",
      value: data.saved,
      icon: PiggyBank,
      color: "from-amber-500 to-orange-500",
      positive: true,
    },
  ];

  const shadeHexColor = (hex: string, amount: number) => {
    const normalized = hex.replace("#", "");
    const num = parseInt(normalized, 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  };

  return (
    <div className="space-y-6" data-testid="dashboard">
      <div className="card border border-border/80 shadow-sm dark:border-border/80 p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            {user.plan === "PRO" && user.companyName ? (
              <div className="inline-flex flex-col gap-4 rounded-[2rem] border border-brand-blue/10 bg-brand-blue/5 p-5 shadow-sm sm:flex-row sm:items-center">
                <img
                  src={user.companyLogo || "/logo.png"}
                  alt={user.companyName}
                  className="w-16 h-16 rounded-3xl object-cover border border-white shadow-sm"
                />
                <div>
                  <div className="text-[10px] uppercase tracking-[0.35em] text-brand-blue font-semibold">
                    Área da empresa
                  </div>
                  <div className="text-3xl sm:text-4xl font-display font-bold text-text dark:text-white leading-tight">
                    {user.companyName}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h1 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight">
                  Olá, {user?.name}!
                </h1>
              </div>
            )}
            <p className="text-sm sm:text-base text-muted dark:text-muted">
              Acompanhe seu progresso financeiro com análises atualizadas e
              visão clara por categoria.
            </p>
            {alerts && alerts.count > 0 && (
              <div className="inline-flex items-center gap-3 rounded-3xl border border-rose-900/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
                <AlertTriangle className="w-4 h-4" />
                Você tem {alerts.count} alerta{alerts.count > 1 ? "s" : ""}{" "}
                financeiros próximos
              </div>
            )}
            {isFree && (
              <div className="mt-4 rounded-3xl border border-brand-blue/20 bg-brand-blue/10 px-4 py-3 text-sm text-brand-blue/80">
                Seu plano atual é Grátis. Para criar transações, acessar alertas
                e exportar relatórios, faça upgrade para o plano Básico ou Pro.
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 justify-start lg:justify-end">
            <button
              onClick={generateAi}
              disabled={aiLoading}
              className="btn-primary text-sm"
              data-testid="ai-insights-btn"
            >
              {aiLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />{" "}
                  {user.plan === "PRO" ? "Análise IA PRO" : "Análise com IA"}
                </>
              )}
            </button>
            <button
              onClick={() => handleExport("pdf")}
              className={`btn-outline text-sm ${!canExportPdf ? "opacity-70" : ""}`}
              data-testid="export-pdf"
            >
              <FileDown className="w-4 h-4" /> PDF
            </button>
            <button
              onClick={() => handleExport("excel")}
              className={`btn-outline text-sm ${!canExportExcel ? "opacity-70" : ""}`}
              data-testid="export-excel"
            >
              <FileSpreadsheet className="w-4 h-4" /> Excel
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="card relative overflow-hidden border border-border/80 shadow-sm dark:border-border/80"
          >
            <div
              className={`absolute top-0 right-0 w-24 h-24 rounded-full bg-gradient-to-br ${s.color} opacity-10 blur-2xl`}
            />
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {s.label}
                </div>
                <div
                  className="text-2xl sm:text-3xl font-display font-bold mt-2"
                  data-testid={`stat-${s.label}`}
                >
                  {currency(s.value)}
                </div>
              </div>
              <div
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white shadow-md`}
              >
                <s.icon className="w-5 h-5" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {data.insights.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.insights.map((ins, i) => {
            const cfg = {
              info: {
                icon: Info,
                cls: "border-blue-900/50 bg-blue-950/30 text-blue-300",
              },
              warning: {
                icon: AlertTriangle,
                cls: "border-amber-900/50 bg-amber-950/30 text-amber-300",
              },
              success: {
                icon: CheckCircle2,
                cls: "border-emerald-900/50 bg-emerald-950/30 text-emerald-300",
              },
            }[ins.type];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`rounded-2xl border p-4 ${cfg.cls}`}
              >
                <div className="flex gap-3">
                  <cfg.icon className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">{ins.title}</div>
                    <div className="text-xs opacity-90 mt-0.5">
                      {ins.message}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {aiInsights && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className="relative rounded-2xl p-6 overflow-hidden border border-brand-purple/20"
            style={{
              background:
                "linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(124,58,237,0.12) 50%, rgba(34,197,94,0.08) 100%)",
            }}
            data-testid="ai-insights-panel"
          >
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-gradient-to-br from-brand-blue/30 to-brand-purple/30 blur-3xl" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-blue to-brand-purple flex items-center justify-center text-white shadow-glow">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg sm:text-xl">
                    Análise com IA · Claude Sonnet 4.5
                  </h3>
                  <p className="text-xs sm:text-sm text-muted dark:text-muted">
                    Conselhos personalizados baseados nas suas finanças
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAiInsights(null)}
                className="btn-ghost !p-2"
                title="Fechar"
              >
                ✕
              </button>
            </div>
            <div className="relative grid gap-3 md:grid-cols-2">
              {aiInsights.map((ins, i) => {
                const cfg = {
                  info: {
                    icon: Info,
                    cls: "bg-surface-strong border-blue-900/50 text-blue-300",
                  },
                  warning: {
                    icon: AlertTriangle,
                    cls: "bg-surface-strong border-amber-900/50 text-amber-300",
                  },
                  success: {
                    icon: CheckCircle2,
                    cls: "bg-surface-strong border-emerald-900/50 text-emerald-300",
                  },
                }[ins.type] || {
                  icon: Info,
                  cls: "bg-surface-strong border-border",
                };
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className={`rounded-xl border p-4 ${cfg.cls}`}
                  >
                    <div className="flex gap-3">
                      <cfg.icon className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-sm">{ins.title}</div>
                        <div className="text-xs sm:text-sm opacity-90 mt-1 leading-relaxed">
                          {ins.message}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2 border border-border/80 shadow-sm dark:border-border/80">
          <h3 className="font-display font-bold text-lg sm:text-xl">
            Fluxo mensal
          </h3>
          <p className="text-xs sm:text-sm text-muted">
            Receitas vs Despesas nos últimos 6 meses
          </p>
          <div className="h-72 mt-4">
            <ResponsiveContainer>
              <AreaChart data={data.monthly}>
                <defs>
                  <linearGradient id="inc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22C55E" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EF4444" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#E2E8F0"
                  vertical={false}
                />
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} />
                <YAxis
                  stroke="#94A3B8"
                  fontSize={12}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v: any) => currency(Number(v))}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #E2E8F0",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke="#22C55E"
                  fill="url(#inc)"
                  strokeWidth={2.5}
                  name="Receitas"
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  stroke="#EF4444"
                  fill="url(#exp)"
                  strokeWidth={2.5}
                  name="Despesas"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card border border-border/80 shadow-sm dark:border-border/80">
          <h3 className="font-display font-bold text-lg sm:text-xl">
            Gastos por categoria
          </h3>
          <p className="text-xs sm:text-sm text-muted">Distribuição atual</p>
          <div className="h-72 mt-4">
            {data.categories.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted text-sm">
                Sem dados ainda
              </div>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={data.categories}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {data.categories.map((c, i) => (
                      <Cell
                        key={i}
                        fill={
                          user.primaryColor
                            ? shadeHexColor(user.primaryColor, i * 10)
                            : CATEGORY_COLORS[c.category] || "#64748B"
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => currency(Number(v))} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2 border border-border/80 shadow-sm dark:border-border/80">
          <h3 className="font-display font-bold text-lg sm:text-xl">
            Comparativo mensal
          </h3>
          <div className="h-64 mt-4">
            <ResponsiveContainer>
              <BarChart data={data.monthly}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#E2E8F0"
                  vertical={false}
                />
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={12} />
                <YAxis
                  stroke="#94A3B8"
                  fontSize={12}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v: any) => currency(Number(v))}
                  contentStyle={{ borderRadius: 12 }}
                />
                <Bar
                  dataKey="income"
                  fill="#22C55E"
                  radius={[8, 8, 0, 0]}
                  name="Receitas"
                />
                <Bar
                  dataKey="expense"
                  fill="#7C3AED"
                  radius={[8, 8, 0, 0]}
                  name="Despesas"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card border border-border/80 shadow-sm dark:border-border/80">
          <h3 className="font-display font-bold text-lg sm:text-xl">
            Últimas transações
          </h3>
          <div className="mt-4 space-y-2" data-testid="recent-transactions">
            {data.recent.length === 0 && (
              <p className="text-sm text-muted">Nenhuma transação ainda</p>
            )}
            {data.recent.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface dark:hover:bg-surface-strong transition"
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${t.type === "INCOME" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300"}`}
                >
                  {t.type === "INCOME" ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">
                    {t.title}
                  </div>
                  <div className="text-xs text-muted">
                    {t.category} · {dateBR(t.date)}
                  </div>
                </div>
                <div
                  className={`font-bold text-sm ${t.type === "INCOME" ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}`}
                >
                  {t.type === "INCOME" ? "+" : "-"}
                  {currency(t.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  );
}
