import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank,
  FileDown, FileSpreadsheet, ArrowUpRight, ArrowDownRight,
  Info, AlertTriangle, CheckCircle2, Sparkles, Loader2,
  Plus, Target, X, Flame, ChevronRight, ChevronDown, Lightbulb, ShieldCheck, Award,
  Download, Bell, BarChart3, AreaChart as AreaChartIcon,
  type LucideIcon,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
  LineChart, Line, ReferenceLine,
} from "recharts";
import toast from "react-hot-toast";
import { api } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Insight, activePlan } from "../types";
import { currency, dateBR, CATEGORY_COLORS } from "../utils/format";
import { useDashboardData } from "../hooks/useDashboardData";
import { computeDashboardMetrics } from "../utils/dashboardMetrics";
import { UpgradeModal } from "../components/UpgradeModal";
import { QuickAddModal } from "../components/dashboard/QuickAddModal";
import { FinancialRadar } from "../components/dashboard/FinancialRadar";
import { SavingsSimulator } from "../components/dashboard/SavingsSimulator";
import { Achievements, Achievement } from "../components/dashboard/Achievements";
import { HealthRing, Sparkline, MetricCard } from "../components/dashboard/widgets";
import { ChartTooltip } from "../components/dashboard/ChartTooltip";
import { SpendingHeatmap } from "../components/dashboard/SpendingHeatmap";
import { CategoryBars } from "../components/dashboard/CategoryBars";

// Semantic colours come from the theme; charts need them as plain strings.
const INCOME = "var(--color-income)";
const EXPENSE = "var(--color-expense)";
const PRIMARY = "var(--color-primary)";
const WARNING = "var(--color-warning)";
const PIE_COLORS = ["#2563eb", "#0891b2", "#059669", "#d97706", "#dc2626", "#0ea5e9"];

type Tab = "overview" | "analysis";

// ─── Small building blocks ───────────────────────────────────────────────────
function Panel({ title, subtitle, action, children, className = "" }: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card !p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>{title}</h3>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: "var(--color-text-low)" }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function PanelLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="shrink-0 inline-flex items-center gap-0.5 text-xs font-medium hover:underline" style={{ color: PRIMARY }}>
      {children} <ChevronRight className="w-3.5 h-3.5" />
    </Link>
  );
}

function Empty({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center py-8 gap-2 text-center">
      <Icon className="w-7 h-7" style={{ color: "var(--color-border-strong)" }} />
      <div className="text-xs" style={{ color: "var(--color-text-low)" }}>{children}</div>
    </div>
  );
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-hairline-strong)" }}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, background: color }} />
    </div>
  );
}

const insightTone = {
  info: { icon: Info, color: PRIMARY },
  warning: { icon: AlertTriangle, color: WARNING },
  success: { icon: CheckCircle2, color: INCOME },
} as const;

function InsightCard({ insight }: { insight: Insight }) {
  const tone = insightTone[insight.type] || insightTone.info;
  return (
    <div className="flex gap-2.5 rounded-control p-3.5" style={{ background: "var(--color-card-hover)" }}>
      <tone.icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: tone.color }} />
      <div>
        <div className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>{insight.title}</div>
        <div className="text-xs leading-relaxed mt-0.5" style={{ color: "var(--color-text-muted)" }}>{insight.message}</div>
      </div>
    </div>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [aiInsights, setAiInsights] = useState<Insight[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const [chartView, setChartView] = useState<"area" | "bar">("area");
  const exportRef = useRef<HTMLDivElement>(null);

  const plan = activePlan(user);
  const isFree = plan === "FREE";
  const canExportPdf = plan !== "FREE";
  const canExportExcel = plan === "PRO" || plan === "TEST";
  const canExportCsv = plan !== "FREE";
  const canUseAi = plan !== "FREE";
  const canAddTx = plan !== "FREE";

  const {
    data, loading, error, reload: fetchAll,
    alerts, budgets, goals, categories, accounts, calDays, forecast, topExpenses,
  } = useDashboardData(isFree);

  // Close the export menu when clicking anywhere else.
  useEffect(() => {
    if (!exportOpen) return;
    const close = (e: MouseEvent) => {
      if (!exportRef.current?.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [exportOpen]);

  if (!user) return null;

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async (kind: "pdf" | "excel") => {
    setExportOpen(false);
    if ((kind === "pdf" && !canExportPdf) || (kind === "excel" && !canExportExcel)) { setUpgradeOpen(true); return; }
    try {
      const r = await api.get(`/api/export/${kind}`, { responseType: "blob" });
      download(r.data, kind === "pdf" ? "finix-relatorio.pdf" : "finix-transacoes.xlsx");
      toast.success("Exportado!");
    } catch { toast.error("Erro ao exportar"); }
  };

  const handleExportCsv = async () => {
    setExportOpen(false);
    if (!canExportCsv) { setUpgradeOpen(true); return; }
    setCsvLoading(true);
    try {
      const r = await api.get("/api/transactions");
      const rows: { date: string; title: string; type: string; category: string; amount: number }[] = r.data || [];
      const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const header = ["Data", "Título", "Tipo", "Categoria", "Valor"].join(";");
      const lines = rows.map(t => [
        dateBR(t.date), escape(t.title), t.type, escape(t.category),
        String(t.amount).replace(".", ","),
      ].join(";"));
      const csv = "﻿" + [header, ...lines].join("\r\n");
      download(new Blob([csv], { type: "text/csv;charset=utf-8;" }), "finix-transacoes.csv");
      toast.success("CSV exportado!");
    } catch { toast.error("Erro ao exportar CSV"); }
    finally { setCsvLoading(false); }
  };

  const generateAi = async () => {
    if (!canUseAi) { setUpgradeOpen(true); return; }
    setAiLoading(true);
    try {
      const r = await api.post("/api/insights/ai");
      setAiInsights(r.data.insights || []);
      setTab("overview");
      toast.success("Análise pronta!");
    }
    catch { toast.error("Falha ao gerar análise"); }
    finally { setAiLoading(false); }
  };

  // ── Loading / error ───────────────────────────────────────────────────────
  if (loading) return (
    <div className="space-y-4">
      <div className="skeleton h-14 rounded-card" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-28 rounded-card" />)}</div>
      <div className="grid lg:grid-cols-3 gap-4"><div className="skeleton h-72 lg:col-span-2 rounded-card" /><div className="skeleton h-72 rounded-card" /></div>
      <div className="grid md:grid-cols-2 gap-4">{[1, 2].map(i => <div key={i} className="skeleton h-48 rounded-card" />)}</div>
    </div>
  );
  if (error) return (
    <div className="card">
      <p className="font-semibold" style={{ color: EXPENSE }}>{error}</p>
      <button onClick={fetchAll} className="btn-primary mt-3 text-sm">Tentar novamente</button>
    </div>
  );
  if (!data) return null;

  // ── Derived numbers ───────────────────────────────────────────────────────
  const now = new Date();
  const {
    daysRemaining, curMonth, dailyRate, dailyLimit, projectedEnd, runway, velocityPct,
    savingsRate, expenseRatio, budgetHealth, healthScore, expenseDiff, incomeDiff,
    todaySpent, dailyLimitSafe, todayPct, streak,
  } = computeDashboardMetrics(data, budgets, calDays, now);

  const stats = [
    { label: "Saldo total", value: data.balance, diff: null as number | null, inv: false, spark: data.monthly.map(m => m.income - m.expense), color: PRIMARY, icon: Wallet },
    { label: "Receitas", value: curMonth.income, diff: incomeDiff, inv: false, spark: data.monthly.map(m => m.income), color: INCOME, icon: TrendingUp },
    { label: "Despesas", value: curMonth.expense, diff: expenseDiff, inv: true, spark: data.monthly.map(m => m.expense), color: EXPENSE, icon: TrendingDown },
    { label: "Economizado", value: data.saved, diff: null, inv: false, spark: data.monthly.map(m => m.income - m.expense), color: PRIMARY, icon: PiggyBank },
  ];

  const tips: { icon: LucideIcon; text: string; color: string }[] = [];
  if (streak > 2) tips.push({ icon: Flame, text: `${streak} dias consecutivos positivos`, color: INCOME });
  if (savingsRate > 20) tips.push({ icon: Award, text: `${savingsRate.toFixed(0)}% poupado — acima da média`, color: INCOME });
  else if (savingsRate < 5 && data.income > 0) tips.push({ icon: Lightbulb, text: "Tente poupar ao menos 10% da renda", color: WARNING });
  if (runway < 3) tips.push({ icon: ShieldCheck, text: `Reserva: ${runway.toFixed(1)} meses — ideal 3-6`, color: PRIMARY });
  if (projectedEnd < 0) tips.push({ icon: TrendingDown, text: `Projeção negativa de ${currency(Math.abs(projectedEnd))}`, color: EXPENSE });
  if (budgets.some(b => b.percentage > 100)) tips.push({ icon: AlertTriangle, text: "Limite excedido em algum orçamento", color: EXPENSE });
  if (tips.length === 0) tips.push({ icon: CheckCircle2, text: "Finanças equilibradas. Continue assim!", color: INCOME });

  const bestGoalPct = goals.length > 0 ? Math.max(...goals.map(g => (g.currentAmount / g.targetAmount) * 100)) : 0;
  const achievements: Achievement[] = [
    { id: "streak", label: "Sequência positiva", hint: "3+ dias seguidos com saldo positivo", icon: Flame, color: "#f59e0b", unlocked: streak >= 3 },
    { id: "saver", label: "Poupador", hint: "Poupando 20%+ da renda", icon: PiggyBank, color: "#2563eb", unlocked: savingsRate >= 20 },
    { id: "budget", label: "Orçamento em dia", hint: "Nenhum orçamento estourado", icon: ShieldCheck, color: "#16a34a", unlocked: budgets.length > 0 && !budgets.some(b => b.percentage > 100) },
    { id: "health", label: "Saúde excelente", hint: "Score de saúde financeira 70+", icon: Award, color: "#f59e0b", unlocked: healthScore >= 70 },
    { id: "goal", label: "Meta na metade", hint: "Alguma meta com 50%+ concluída", icon: Target, color: "#16a34a", unlocked: bestGoalPct >= 50 },
    { id: "runway", label: "Reserva sólida", hint: "3+ meses de despesas guardados", icon: Wallet, color: "#2563eb", unlocked: runway >= 3 },
  ];

  const healthLabel = healthScore >= 70 ? "Excelente" : healthScore >= 40 ? "Regular" : "Atenção";
  const upgradeLink = (
    <button onClick={() => setUpgradeOpen(true)} className="text-xs font-medium hover:underline" style={{ color: PRIMARY }}>Fazer upgrade</button>
  );
  const menuItem = "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-colors hover:bg-[var(--color-card-hover)]";

  return (
    <div className="space-y-5" data-testid="dashboard">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight" style={{ color: "var(--color-text)" }}>
            {user.plan === "PRO" && user.companyName ? user.companyName : `Olá, ${user.name.split(" ")[0]}`}
          </h1>
          <p className="text-sm mt-0.5 first-letter:" style={{ color: "var(--color-text-low)" }}>
            {now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
            {alerts.count > 0 && (
              <>
                {" · "}
                <Link to="/app/alerts" className="font-medium hover:underline" style={{ color: WARNING }}>
                  {alerts.count} {alerts.count === 1 ? "alerta" : "alertas"}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={generateAi} disabled={aiLoading} className="btn-outline text-sm" data-testid="ai-insights-btn">
            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {aiLoading ? "Analisando..." : "Análise IA"}
          </button>
          <div className="relative" ref={exportRef}>
            <button onClick={() => setExportOpen(o => !o)} className="btn-outline text-sm" aria-expanded={exportOpen} data-testid="export-menu">
              {csvLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Exportar
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {exportOpen && (
              <div className="glass-strong absolute right-0 mt-2 w-44 rounded-control p-1 z-30" style={{ color: "var(--color-text)" }}>
                <button onClick={() => handleExport("pdf")} className={`${menuItem} ${!canExportPdf ? "opacity-50" : ""}`} data-testid="export-pdf">
                  <FileDown className="w-4 h-4" /> PDF
                </button>
                <button onClick={() => handleExport("excel")} className={`${menuItem} ${!canExportExcel ? "opacity-50" : ""}`} data-testid="export-excel">
                  <FileSpreadsheet className="w-4 h-4" /> Excel
                </button>
                <button onClick={handleExportCsv} className={`${menuItem} ${!canExportCsv ? "opacity-50" : ""}`} data-testid="export-csv">
                  <Download className="w-4 h-4" /> CSV
                </button>
              </div>
            )}
          </div>
          {canAddTx && (
            <button onClick={() => setQuickAddOpen(true)} className="btn-primary text-sm !px-4 !py-2">
              <Plus className="w-4 h-4" /> Transação
            </button>
          )}
        </div>
      </header>

      {/* ── TABS ───────────────────────────────────────────────────────────── */}
      <div className="inline-flex gap-1 p-1 rounded-control" style={{ background: "var(--color-hairline-strong)" }} role="tablist">
        {([["overview", "Visão geral"], ["analysis", "Análises"]] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} data-testid={`tab-${id}`}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150"
            style={tab === id
              ? { background: "var(--color-surface)", color: "var(--color-text)" }
              : { color: "var(--color-text-muted)" }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <>
          {/* ── 1. The numbers of the month ─────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map(s => {
              const good = s.diff !== null && s.diff !== 0 && (s.inv ? s.diff < 0 : s.diff > 0);
              return (
                <div key={s.label} className="glass rounded-card p-4">
                  <div className="flex items-center justify-between">
                    <span className="eyebrow">{s.label}</span>
                    <s.icon className="w-4 h-4" style={{ color: s.color }} />
                  </div>
                  <div className="text-2xl font-semibold num tracking-tight mt-2" style={{ color: "var(--color-text)" }} data-testid={`stat-${s.label}`}>
                    {currency(s.value)}
                  </div>
                  <div className="flex items-end justify-between mt-2 min-h-[1.75rem]">
                    {s.diff !== null ? (
                      <span className="text-xs font-medium num" style={{ color: s.diff === 0 ? "var(--color-text-low)" : good ? INCOME : EXPENSE }}>
                        {s.diff > 0 ? "+" : ""}{s.diff.toFixed(1)}% <span style={{ color: "var(--color-text-low)" }}>vs. mês passado</span>
                      </span>
                    ) : <span />}
                    <Sparkline values={s.spark} color={s.color} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── AI analysis (only after the user asks for it) ───────────────── */}
          {aiInsights && (
            <Panel title="Análise IA" subtitle="Insights personalizados a partir dos seus dados"
              action={
                <button onClick={() => setAiInsights(null)} title="Fechar" className="p-1.5 rounded-lg transition-colors hover:bg-[var(--color-card-hover)]" style={{ color: "var(--color-text-low)" }}>
                  <X className="w-4 h-4" />
                </button>
              }>
              <div className="grid gap-3 sm:grid-cols-2" data-testid="ai-insights-panel">
                {aiInsights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
              </div>
            </Panel>
          )}

          {/* ── 2. Cash flow and where the money goes ───────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Panel className="lg:col-span-2" title="Fluxo de caixa" subtitle="Receitas e despesas dos últimos 6 meses"
              action={
                <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: "var(--color-hairline-strong)" }}>
                  {([["area", AreaChartIcon, "Área"], ["bar", BarChart3, "Barras"]] as const).map(([id, Icon, label]) => (
                    <button key={id} onClick={() => setChartView(id)} title={label} data-testid={`chart-view-${id}`}
                      className="p-1.5 rounded-md transition-colors"
                      style={chartView === id ? { background: "var(--color-surface)", color: PRIMARY } : { color: "var(--color-text-low)" }}>
                      <Icon className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              }>
              <div className="h-60">
                <ResponsiveContainer>
                  {chartView === "area" ? (
                    <AreaChart data={data.monthly} margin={{ top: 4, right: 0, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke="var(--color-hairline-strong)" vertical={false} />
                      <XAxis dataKey="month" stroke="var(--color-text-low)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--color-text-low)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="income" stroke={INCOME} fill={INCOME} fillOpacity={0.08} strokeWidth={2} name="Receitas" dot={false} isAnimationActive={false} />
                      <Area type="monotone" dataKey="expense" stroke={EXPENSE} fill={EXPENSE} fillOpacity={0.08} strokeWidth={2} name="Despesas" dot={false} isAnimationActive={false} />
                    </AreaChart>
                  ) : (
                    <BarChart data={data.monthly} margin={{ top: 4, right: 0, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke="var(--color-hairline-strong)" vertical={false} />
                      <XAxis dataKey="month" stroke="var(--color-text-low)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--color-text-low)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-card-hover)" }} />
                      <Bar dataKey="income" fill={INCOME} name="Receitas" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                      <Bar dataKey="expense" fill={EXPENSE} name="Despesas" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Por categoria" subtitle="Para onde foram as despesas">
              {data.categories.length === 0 ? (
                <Empty icon={PiggyBank}>Sem despesas ainda</Empty>
              ) : (
                <>
                  <div className="h-36">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={data.categories} dataKey="amount" nameKey="category" innerRadius={42} outerRadius={66} paddingAngle={2} strokeWidth={0} isAnimationActive={false}>
                          {data.categories.map((c, i) => <Cell key={i} fill={CATEGORY_COLORS[c.category] || PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => currency(Number(v))} contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)", fontSize: 12 }} itemStyle={{ color: "var(--color-text)" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {data.categories.slice(0, 5).map((c, i) => (
                      <li key={c.category} className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-2 min-w-0" style={{ color: "var(--color-text-muted)" }}>
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CATEGORY_COLORS[c.category] || PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="truncate">{c.category}</span>
                        </span>
                        <span className="num font-medium" style={{ color: "var(--color-text)" }}>{currency(c.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Panel>
          </div>

          {/* ── 3. Everything else ──────────────────────────────────────────── */}
          {data.insights.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.insights.map((ins, i) => (
                <div key={i} className="card !p-0"><InsightCard insight={ins} /></div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Panel title="Recentes" subtitle="Últimas transações" action={<PanelLink to="/app/transactions">Ver todas</PanelLink>}>
              <div data-testid="recent-transactions">
                {data.recent.length === 0 ? (
                  <Empty icon={Wallet}>Nenhuma transação</Empty>
                ) : (
                  <ul className="divide-y" style={{ borderColor: "var(--color-hairline-strong)" }}>
                    {data.recent.map(t => (
                      <li key={t.id} className="flex items-center gap-3 py-2.5" style={{ borderColor: "var(--color-hairline-strong)" }}>
                        {t.type === "INCOME"
                          ? <ArrowUpRight className="w-4 h-4 shrink-0" style={{ color: INCOME }} />
                          : <ArrowDownRight className="w-4 h-4 shrink-0" style={{ color: EXPENSE }} />}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>{t.title}</div>
                          <div className="text-xs" style={{ color: "var(--color-text-low)" }}>{t.category} · {dateBR(t.date)}</div>
                        </div>
                        <div className="text-sm font-medium shrink-0 num" style={{ color: t.type === "INCOME" ? INCOME : "var(--color-text)" }}>
                          {t.type === "INCOME" ? "+" : "-"}{currency(t.amount)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Panel>

            <Panel title="Próximos vencimentos" subtitle="Parcelas e cobranças de cartão" action={<PanelLink to="/app/alerts">Ver todos</PanelLink>}>
              {isFree ? (
                <Empty icon={Bell}>Disponível a partir do plano Básico<div className="mt-2">{upgradeLink}</div></Empty>
              ) : alerts.alerts.length === 0 ? (
                <Empty icon={CheckCircle2}>Tudo em dia por aqui</Empty>
              ) : (
                <ul className="divide-y" data-testid="upcoming-dues">
                  {alerts.alerts.slice(0, 5).map(a => {
                    const tone = a.severity === "danger" ? EXPENSE : a.severity === "info" ? PRIMARY : WARNING;
                    return (
                      <li key={a.id} className="flex items-center gap-3 py-2.5" style={{ borderColor: "var(--color-hairline-strong)" }}>
                        <Bell className="w-4 h-4 shrink-0" style={{ color: tone }} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>{a.title}</div>
                          {a.daysUntilDue != null && (
                            <div className="text-xs" style={{ color: tone }}>
                              {a.daysUntilDue <= 0 ? "vence hoje" : `vence em ${a.daysUntilDue} dia${a.daysUntilDue > 1 ? "s" : ""}`}
                            </div>
                          )}
                        </div>
                        {a.amount != null && <div className="text-sm font-medium num shrink-0" style={{ color: "var(--color-text)" }}>{currency(a.amount)}</div>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            <Panel title="Orçamentos" subtitle="Mês atual" action={<PanelLink to="/app/budgets">Ver todos</PanelLink>}>
              {budgets.length === 0 ? (
                <Empty icon={Wallet}>Nenhum orçamento</Empty>
              ) : (
                <div className="space-y-4">
                  {budgets.map(b => (
                    <div key={b.id}>
                      <div className="flex justify-between items-baseline gap-2 mb-1.5">
                        <span className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>{b.category}</span>
                        <span className="text-xs num shrink-0" style={{ color: "var(--color-text-low)" }}>{currency(b.spent)} / {currency(b.limit)}</span>
                      </div>
                      <ProgressBar pct={b.percentage} color={b.percentage > 100 ? EXPENSE : b.percentage >= 80 ? WARNING : PRIMARY} />
                      {b.percentage > 100 && <p className="text-xs mt-1" style={{ color: EXPENSE }}>{(b.percentage - 100).toFixed(0)}% acima do limite</p>}
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Metas" subtitle="Em progresso" action={<PanelLink to="/app/goals">Ver todas</PanelLink>}>
              {goals.length === 0 ? (
                <Empty icon={Target}>Nenhuma meta criada</Empty>
              ) : (
                <div className="space-y-4">
                  {goals.map(g => {
                    const pct = Math.min((g.currentAmount / g.targetAmount) * 100, 100);
                    const daysLeft = Math.max(0, Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86400000));
                    return (
                      <div key={g.id}>
                        <div className="flex justify-between items-baseline gap-2 mb-1.5">
                          <span className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>{g.title}</span>
                          <span className="text-xs font-medium num shrink-0" style={{ color: "var(--color-text)" }}>{pct.toFixed(0)}%</span>
                        </div>
                        <ProgressBar pct={pct} color={PRIMARY} />
                        <div className="flex justify-between mt-1 text-xs num" style={{ color: "var(--color-text-low)" }}>
                          <span>{currency(g.currentAmount)} / {currency(g.targetAmount)}</span>
                          {daysLeft > 0 && <span>{daysLeft} dias</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>
        </>
      ) : (
        <>
          {/* ── ANÁLISES ────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <section className="card !p-5 flex items-center gap-5">
              <div className="relative shrink-0 w-20 h-20"><HealthRing score={healthScore} /></div>
              <div className="min-w-0">
                <span className="eyebrow">Saúde financeira</span>
                <div className="text-xl font-semibold mt-0.5" style={{ color: "var(--color-text)" }}>{healthLabel}</div>
                <ul className="mt-2 space-y-1">
                  {tips.slice(0, 3).map((t, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
                      <t.icon className="w-3.5 h-3.5 shrink-0 mt-px" style={{ color: t.color }} /> {t.text}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <MetricCard label="Ritmo de gastos" value={`${currency(dailyRate)}/dia`}
                barPct={velocityPct} color={velocityPct < 50 ? INCOME : velocityPct < 80 ? WARNING : EXPENSE}
                sub={velocityPct < 50 ? "Ritmo saudável" : velocityPct < 80 ? "Atenção ao ritmo" : "Ritmo acelerado"} />
              <MetricCard label="Disponível hoje"
                value={`${dailyLimit < 0 ? "-" : ""}${currency(Math.abs(dailyLimitSafe))}`}
                barPct={todayPct} color={todayPct > 80 ? EXPENSE : todayPct > 50 ? WARNING : INCOME}
                sub={`Hoje: ${currency(todaySpent)} · ${daysRemaining} dias restantes`} />
              <section className="card !p-4">
                <span className="eyebrow">Projeção</span>
                <dl className="mt-2 space-y-2 text-sm">
                  {[
                    { k: "Fim do mês", v: currency(projectedEnd), c: projectedEnd >= 0 ? INCOME : EXPENSE },
                    { k: "Reserva", v: runway < 1 ? `${(runway * 30).toFixed(0)} dias` : `${runway.toFixed(1)} meses`, c: "var(--color-text)" },
                    { k: "Poupança", v: `${savingsRate.toFixed(1)}%`, c: "var(--color-text)" },
                  ].map(row => (
                    <div key={row.k} className="flex justify-between items-center">
                      <dt style={{ color: "var(--color-text-muted)" }}>{row.k}</dt>
                      <dd className="font-medium num" style={{ color: row.c }}>{row.v}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          </div>

          <Achievements items={achievements} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel title="Raio-X financeiro" subtitle="Os 5 sinais que compõem sua saúde financeira">
              <div data-testid="financial-radar">
                <FinancialRadar axes={[
                  { label: "Poupança", value: savingsRate * 2.5 },
                  { label: "Controle", value: 100 - expenseRatio },
                  { label: "Orçamento", value: budgetHealth },
                  { label: "Consistência", value: streak * 15 },
                  { label: "Reserva", value: (runway / 6) * 100 },
                ]} />
              </div>
            </Panel>
            <div data-testid="savings-simulator">
              <SavingsSimulator income={curMonth.income} expense={curMonth.expense} balance={data.balance} />
            </div>
          </div>

          {forecast && (
            <Panel title="Previsão dos próximos 30 dias" subtitle="Simulação com as recorrências e parcelas já cadastradas — o que ainda vai acontecer">
              {forecast.riskWindows.length > 0 ? (
                <div className="space-y-2 mb-4">
                  {forecast.riskWindows.map((w, i) => (
                    <div key={i} className="flex items-start gap-2.5 rounded-control p-3" style={{ background: "var(--color-card-hover)" }}>
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: EXPENSE }} />
                      <p className="text-sm" style={{ color: "var(--color-text)" }}>
                        Entre <strong>{dateBR(w.start)}</strong> e <strong>{dateBR(w.end)}</strong> seu saldo projetado fica negativo
                        (chega a {currency(w.lowestBalance)}) — por causa de {w.reason}.
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2.5 rounded-control p-3 mb-4" style={{ background: "var(--color-card-hover)" }}>
                  <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: INCOME }} />
                  <p className="text-sm" style={{ color: "var(--color-text)" }}>Nenhum aperto previsto nos próximos 30 dias.</p>
                </div>
              )}
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={forecast.days}>
                  <XAxis dataKey="date" hide />
                  <YAxis hide domain={["dataMin", "dataMax"]} />
                  <Tooltip
                    formatter={(v: number) => currency(v)}
                    labelFormatter={(l) => dateBR(String(l))}
                    contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }}
                  />
                  <ReferenceLine y={0} stroke={EXPENSE} strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="balance" stroke={PRIMARY} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </Panel>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Panel title="Mapa de gastos" subtitle={now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}>
              <SpendingHeatmap days={calDays} />
            </Panel>
            <Panel title="Categorias" subtitle="Participação nos gastos">
              <CategoryBars categories={data.categories} />
            </Panel>
          </div>

          <Panel title="Maiores gastos" subtitle="Top 5 do mês atual">
            {isFree ? (
              <Empty icon={TrendingDown}>Disponível a partir do plano Básico<div className="mt-2">{upgradeLink}</div></Empty>
            ) : topExpenses.length === 0 ? (
              <Empty icon={TrendingDown}>Nenhum gasto este mês</Empty>
            ) : (
              <ul className="space-y-3" data-testid="top-expenses">
                {topExpenses.map(t => (
                  <li key={t.id}>
                    <div className="flex items-baseline justify-between gap-3 mb-1.5">
                      <span className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>
                        {t.title} <span className="font-normal text-xs" style={{ color: "var(--color-text-low)" }}>· {t.category} · {dateBR(t.date)}</span>
                      </span>
                      <span className="text-sm font-medium num shrink-0" style={{ color: "var(--color-text)" }}>{currency(t.amount)}</span>
                    </div>
                    <ProgressBar pct={(t.amount / (topExpenses[0]?.amount || 1)) * 100} color={EXPENSE} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}

      <QuickAddModal open={quickAddOpen} onClose={() => setQuickAddOpen(false)} onAdded={fetchAll} categories={categories} accounts={accounts} />
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  );
}
