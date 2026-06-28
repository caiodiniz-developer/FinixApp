import { useCallback, useEffect, useState } from "react";
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank,
  FileDown, FileSpreadsheet, ArrowUpRight, ArrowDownRight,
  Info, AlertTriangle, CheckCircle2, Sparkles, Loader2,
  Plus, Target, X, Activity, Zap, Clock, Flame,
  ChevronRight, Lightbulb, BarChart2, ShieldCheck, Award,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { api, apiErrorMessage } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { DashboardData, Insight, Budget, Goal } from "../types";
import { currency, dateBR, CATEGORY_COLORS } from "../utils/format";
import { UpgradeModal } from "../components/UpgradeModal";
import toast from "react-hot-toast";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface CalendarDay { date: string; expense: number; revenue: number; net: number; }
interface AlertItem {
  id: string; title: string; description?: string | null;
  dueDate?: string | null; amount?: number | null; daysUntilDue?: number | null; severity?: string;
}

// ─── QUICK-ADD MODAL ──────────────────────────────────────────────────────────
function QuickAddModal({ open, onClose, onAdded, categories }: {
  open: boolean; onClose: () => void; onAdded: () => void; categories: string[];
}) {
  const [form, setForm] = useState({ title: "", amount: "", type: "EXPENSE" as "INCOME" | "EXPENSE", category: categories[0] || "Outros", date: new Date().toISOString().split("T")[0] });
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.amount) return;
    setLoading(true);
    try {
      await api.post("/api/transactions", { ...form, amount: parseFloat(form.amount), paymentMethod: "pix", installments: 1 });
      toast.success("Transação adicionada!");
      onAdded(); onClose();
      setForm({ title: "", amount: "", type: "EXPENSE", category: categories[0] || "Outros", date: new Date().toISOString().split("T")[0] });
    } catch (e: any) { toast.error(apiErrorMessage(e) || "Erro"); }
    finally { setLoading(false); }
  };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)" }} onClick={onClose}>
      <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }}
        transition={{ type: "spring", damping: 24, stiffness: 320 }}
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">Nova transação</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg opacity-60 hover:opacity-100" style={{ color: "var(--color-text-muted)" }}><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl" style={{ background: "var(--color-surface-strong)" }}>
            {(["EXPENSE", "INCOME"] as const).map(t => (
              <button key={t} type="button" onClick={() => setForm({ ...form, type: t })}
                className={`py-2.5 rounded-lg text-sm font-bold transition-all ${form.type === t ? t === "EXPENSE" ? "bg-rose-500 text-white" : "bg-emerald-500 text-white" : "opacity-50"}`}>
                {t === "EXPENSE" ? "↓ Despesa" : "↑ Receita"}
              </button>
            ))}
          </div>
          <input className="input" placeholder="Descrição..." value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" step="0.01" min="0.01" className="input" placeholder="R$" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
            <input type="date" className="input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>
          <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
            {(categories.length ? categories : ["Outros"]).map(c => <option key={c}>{c}</option>)}
          </select>
          <button type="submit" disabled={loading} className="btn-primary w-full !py-2.5">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Salvar</>}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ─── HEALTH RING ──────────────────────────────────────────────────────────────
function HealthRing({ score }: { score: number }) {
  const r = 36, circ = 2 * Math.PI * r, dash = (score / 100) * circ;
  const color = score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="relative w-20 h-20 shrink-0">
      <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
        <motion.circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circ}` }} animate={{ strokeDasharray: `${dash} ${circ}` }}
          transition={{ duration: 1.2, ease: "easeOut" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-black leading-none" style={{ color }}>{score}</span>
        <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-low)" }}>/100</span>
      </div>
    </div>
  );
}

// ─── SPARKLINE ────────────────────────────────────────────────────────────────
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1), min = Math.min(...values), range = max - min || 1;
  const W = 56, H = 20;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - ((v - min) / range) * (H - 3) - 1.5}`).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="opacity-60">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── CHART TOOLTIP ────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl p-3 shadow-2xl text-sm" style={{ background: "var(--color-surface-strong)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}>
      <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: "var(--color-text-muted)" }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="font-semibold text-xs" style={{ color: p.color }}>{p.name}: {currency(p.value)}</p>
      ))}
    </div>
  );
};

// ─── SPENDING HEATMAP ─────────────────────────────────────────────────────────
function SpendingHeatmap({ days }: { days: CalendarDay[] }) {
  const [hovered, setHovered] = useState<CalendarDay | null>(null);
  if (days.length === 0) return <div className="flex items-center justify-center h-20 text-xs" style={{ color: "var(--color-text-low)" }}>Sem dados</div>;
  const maxE = Math.max(...days.map(d => d.expense), 1);
  const firstDay = new Date(days[0].date + "T12:00:00");
  const cells: (CalendarDay | null)[] = [...Array(firstDay.getDay()).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  const getColor = (e: number) => {
    if (e === 0) return "rgba(255,255,255,0.04)";
    const i = Math.pow(e / maxE, 0.55);
    return `rgba(${Math.round(239 * i + 25 * (1 - i))},${Math.round(68 * i + 25 * (1 - i))},${Math.round(68 * i + 38 * (1 - i))},${0.12 + i * 0.65})`;
  };
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-0.5">{["D","S","T","Q","Q","S","S"].map((d,i) => <div key={i} className="text-center text-[8px] font-bold uppercase" style={{ color: "var(--color-text-low)" }}>{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => (
          <div key={i} className="relative aspect-square rounded transition-transform hover:scale-110 cursor-default"
            style={{ background: day ? getColor(day.expense) : "transparent" }}
            onMouseEnter={() => day && setHovered(day)} onMouseLeave={() => setHovered(null)}>
            {day && <span className="absolute inset-0 flex items-center justify-center text-[8px]" style={{ color: "var(--color-text-low)" }}>{new Date(day.date + "T12:00:00").getDate()}</span>}
          </div>
        ))}
      </div>
      <AnimatePresence>
        {hovered && (
          <motion.div initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-2 flex items-center justify-between rounded-lg px-3 py-1.5 text-xs"
            style={{ background: "var(--color-surface-strong)", border: "1px solid var(--color-border)" }}>
            <span style={{ color: "var(--color-text-muted)" }}>{new Date(hovered.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
            <span className="text-rose-400 font-semibold">{hovered.expense > 0 ? `- ${currency(hovered.expense)}` : "—"}</span>
            {hovered.revenue > 0 && <span className="text-emerald-400 font-semibold">+ {currency(hovered.revenue)}</span>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── CATEGORY BARS ────────────────────────────────────────────────────────────
function CategoryBars({ categories }: { categories: { category: string; amount: number }[] }) {
  const COLORS = ["#7c3aed","#2563eb","#059669","#d97706","#dc2626","#0891b2","#be185d","#7c3aed"];
  if (categories.length === 0) return <div className="flex items-center justify-center h-20 text-xs" style={{ color: "var(--color-text-low)" }}>Sem dados</div>;
  const total = categories.reduce((s, c) => s + c.amount, 0);
  return (
    <div className="space-y-2.5">
      {categories.slice(0, 6).map((cat, i) => {
        const pct = total > 0 ? (cat.amount / total) * 100 : 0;
        const color = CATEGORY_COLORS[cat.category] || COLORS[i % COLORS.length];
        return (
          <div key={cat.category}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-xs font-medium truncate max-w-[100px]" style={{ color: "var(--color-text)" }}>{cat.category}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px]" style={{ color: "var(--color-text-low)" }}>{pct.toFixed(0)}%</span>
                <span className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>{currency(cat.amount)}</span>
              </div>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--color-border)" }}>
              <motion.div className="h-full rounded-full" style={{ background: color }}
                initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: i * 0.05 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── SECTION HEADER ───────────────────────────────────────────────────────────
function SectionHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h3 className="font-semibold text-sm" style={{ color: "var(--color-text)" }}>{title}</h3>
        {sub && <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-low)" }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState<Insight[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [alerts, setAlerts] = useState<{ count: number; alerts: AlertItem[] }>({ count: 0, alerts: [] });
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [calDays, setCalDays] = useState<CalendarDay[]>([]);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const isFree = user?.plan === "FREE";
  const canExportPdf = user?.plan !== "FREE";
  const canExportExcel = user?.plan === "PRO";
  const canUseAi = user?.plan !== "FREE";
  const canAddTx = user?.plan !== "FREE";

  const fetchDashboard = useCallback(async () => {
    if (!user) return;
    setError(null); setLoading(true);
    try { const r = await api.get("/api/dashboard"); setData(r.data); }
    catch (e: any) { const msg = apiErrorMessage(e) || "Erro ao carregar"; setError(msg); toast.error(msg); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { if (!user) { setData(null); setLoading(false); return; } fetchDashboard(); }, [user, fetchDashboard]);

  useEffect(() => {
    if (!user) return;
    const now = new Date();
    const mp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    Promise.allSettled([
      api.get("/api/alerts"), api.get("/api/budgets"), api.get("/api/goals"),
      api.get("/api/categories"), api.get(`/api/calendar?month=${mp}`),
    ]).then(([al, bu, go, ca, cl]) => {
      if (al.status === "fulfilled") setAlerts(al.value.data);
      if (bu.status === "fulfilled") setBudgets(bu.value.data.slice(0, 4));
      if (go.status === "fulfilled") setGoals(go.value.data.slice(0, 3));
      if (ca.status === "fulfilled") setCategories(ca.value.data.map((c: any) => c.name));
      if (cl.status === "fulfilled") setCalDays(cl.value.data.dailySummary || []);
    });
  }, [user]);

  if (!user) return null;

  const handleExport = async (kind: "pdf" | "excel") => {
    if ((kind === "pdf" && !canExportPdf) || (kind === "excel" && !canExportExcel)) { setUpgradeOpen(true); return; }
    try {
      const r = await api.get(`/api/export/${kind}`, { responseType: "blob" });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement("a"); a.href = url;
      a.download = kind === "pdf" ? "finix-relatorio.pdf" : "finix-transacoes.xlsx";
      a.click(); URL.revokeObjectURL(url); toast.success("Exportado!");
    } catch { toast.error("Erro ao exportar"); }
  };

  const generateAi = async () => {
    if (!canUseAi) { setUpgradeOpen(true); return; }
    setAiLoading(true);
    try { const r = await api.post("/api/insights/ai"); setAiInsights(r.data.insights || []); toast.success("Análise pronta!"); }
    catch { toast.error("Falha ao gerar análise"); }
    finally { setAiLoading(false); }
  };

  // Loading
  if (loading) return (
    <div className="space-y-4">
      <div className="skeleton h-28 rounded-2xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[1,2,3,4].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
      <div className="grid sm:grid-cols-3 gap-3">{[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
      <div className="grid lg:grid-cols-3 gap-4"><div className="skeleton h-52 lg:col-span-2 rounded-xl" /><div className="skeleton h-52 rounded-xl" /></div>
      <div className="grid lg:grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="skeleton h-48 rounded-xl" />)}</div>
    </div>
  );
  if (error) return (
    <div className="p-5 rounded-2xl border-rose-900/40 bg-rose-950/20 text-rose-300" style={{ border: "1px solid" }}>
      <p className="font-semibold">{error}</p>
      <button onClick={fetchDashboard} className="btn-primary mt-3 text-sm">Tentar novamente</button>
    </div>
  );
  if (!data) return null;

  // Computed
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysRemaining = daysInMonth - dayOfMonth + 1;
  const curMonth = data.monthly[data.monthly.length - 1] || { income: 0, expense: 0 };
  const prevMonth = data.monthly[data.monthly.length - 2] || { income: 0, expense: 0 };
  const dailyRate = dayOfMonth > 0 ? curMonth.expense / dayOfMonth : 0;
  const dailyLimit = curMonth.income > 0 ? (curMonth.income - curMonth.expense) / daysRemaining : 0;
  const projectedEndBalance = curMonth.income - (curMonth.expense + dailyRate * daysRemaining);
  const avgMonthly6 = data.monthly.reduce((s, m) => s + m.expense, 0) / (data.monthly.length || 1);
  const runway = avgMonthly6 > 0 ? data.balance / avgMonthly6 : 0;
  const velocityPct = curMonth.income > 0 ? Math.min((dailyRate / (curMonth.income / daysInMonth)) * 100, 100) : 0;
  const savingsRate = data.income > 0 ? (data.saved / data.income) * 100 : 0;
  const expenseRatio = data.income > 0 ? (data.expense / data.income) * 100 : 100;
  const budgetHealth = budgets.length > 0 ? (budgets.filter(b => b.percentage < 80).length / budgets.length) * 100 : 100;
  const healthScore = Math.round(Math.min(100, Math.max(0, (Math.max(0, 100 - expenseRatio) * 0.5) + Math.min(savingsRate * 2, 30) + budgetHealth * 0.2)));
  const expenseDiff = prevMonth.expense > 0 ? ((curMonth.expense - prevMonth.expense) / prevMonth.expense) * 100 : 0;
  const incomeDiff = prevMonth.income > 0 ? ((curMonth.income - prevMonth.income) / prevMonth.income) * 100 : 0;
  const todayKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const todaySpent = calDays.find(d => d.date === todayKey)?.expense || 0;
  const dailyLimitSafe = Math.max(dailyLimit, 0);
  const todayPct = dailyLimitSafe > 0 ? Math.min((todaySpent / dailyLimitSafe) * 100, 100) : 0;
  let streak = 0;
  for (const d of [...calDays].sort((a,b) => b.date.localeCompare(a.date))) {
    if (d.expense === 0 && d.revenue === 0) continue;
    if (d.net >= 0) streak++; else break;
  }

  const stats = [
    { label: "Saldo total", value: data.balance, diff: null, invertDiff: false, spark: data.monthly.map(m => m.income - m.expense), sparkColor: "#a78bfa", accent: "#a78bfa", icon: Wallet },
    { label: "Receitas", value: curMonth.income, diff: incomeDiff, invertDiff: false, spark: data.monthly.map(m => m.income), sparkColor: "#22c55e", accent: "#22c55e", icon: TrendingUp },
    { label: "Despesas", value: curMonth.expense, diff: expenseDiff, invertDiff: true, spark: data.monthly.map(m => m.expense), sparkColor: "#ef4444", accent: "#ef4444", icon: TrendingDown },
    { label: "Economizado", value: data.saved, diff: null, invertDiff: false, spark: data.monthly.map(m => m.income - m.expense), sparkColor: "#f59e0b", accent: "#f59e0b", icon: PiggyBank },
  ];

  const insightCfg = {
    info: { icon: Info, border: "rgba(59,130,246,0.2)", text: "text-blue-400", bg: "rgba(59,130,246,0.06)" },
    warning: { icon: AlertTriangle, border: "rgba(245,158,11,0.2)", text: "text-amber-400", bg: "rgba(245,158,11,0.06)" },
    success: { icon: CheckCircle2, border: "rgba(34,197,94,0.2)", text: "text-emerald-400", bg: "rgba(34,197,94,0.06)" },
  } as const;

  const PIE_COLORS = ["#7c3aed","#2563eb","#059669","#d97706","#dc2626","#0891b2"];

  // smart tips
  const tips: { icon: React.ElementType; text: string; color: string }[] = [];
  if (streak > 2) tips.push({ icon: Flame, text: `${streak} dias com saldo positivo`, color: "text-orange-400" });
  if (savingsRate > 20) tips.push({ icon: Award, text: `${savingsRate.toFixed(0)}% poupado este mês`, color: "text-emerald-400" });
  else if (savingsRate < 5 && data.income > 0) tips.push({ icon: Lightbulb, text: "Tente poupar ao menos 10% da renda", color: "text-amber-400" });
  if (runway < 3) tips.push({ icon: ShieldCheck, text: `Reserva cobre ${runway.toFixed(1)} meses — construa mais`, color: "text-blue-400" });
  if (projectedEndBalance < 0) tips.push({ icon: TrendingDown, text: `Projeção: ${currency(Math.abs(projectedEndBalance))} negativo no fim do mês`, color: "text-rose-400" });
  if (budgets.some(b => b.percentage > 100)) tips.push({ icon: BarChart2, text: "Orçamento excedido em alguma categoria", color: "text-rose-400" });
  if (tips.length === 0) tips.push({ icon: CheckCircle2, text: "Finanças equilibradas. Continue monitorando!", color: "text-emerald-400" });

  const card = { background: "var(--color-surface)", border: "1px solid var(--color-border)" };

  return (
    <div className="space-y-4" data-testid="dashboard">

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        style={card}>
        <div className="flex items-center gap-4">
          <HealthRing score={healthScore} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--color-text-low)" }}>Saúde financeira</p>
            <h1 className="text-2xl font-bold leading-tight">
              {user.plan === "PRO" && user.companyName ? user.companyName : `Olá, ${user.name.split(" ")[0]}`}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              {now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {alerts.count > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-rose-400" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <AlertTriangle className="w-2.5 h-2.5" /> {alerts.count} alertas
                </span>
              )}
              {streak > 1 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-orange-400" style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)" }}>
                  <Flame className="w-2.5 h-2.5" /> {streak} dias
                </span>
              )}
              {isFree && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ color: "var(--color-text-low)", background: "var(--color-surface-strong)", border: "1px solid var(--color-border)" }}>
                  <Zap className="w-2.5 h-2.5" /> Grátis
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAddTx && (
            <button onClick={() => setQuickAddOpen(true)} className="btn-primary text-xs !py-2 !px-3">
              <Plus className="w-3.5 h-3.5" /> Transação
            </button>
          )}
          <button onClick={generateAi} disabled={aiLoading} className="btn-outline text-xs !py-2 !px-3" data-testid="ai-insights-btn">
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {aiLoading ? "Analisando..." : "Análise IA"}
          </button>
          <button onClick={() => handleExport("pdf")} className={`btn-outline text-xs !py-2 !px-3 ${!canExportPdf ? "opacity-40" : ""}`} data-testid="export-pdf">
            <FileDown className="w-3.5 h-3.5" /> PDF
          </button>
          <button onClick={() => handleExport("excel")} className={`btn-outline text-xs !py-2 !px-3 ${!canExportExcel ? "opacity-40" : ""}`} data-testid="export-excel">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </button>
        </div>
      </motion.div>

      {/* ── STAT CARDS ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, type: "spring", damping: 22 }}
            className="rounded-xl p-4" style={{ ...card, borderLeft: `3px solid ${s.accent}` }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--color-text-low)" }}>{s.label}</span>
              <s.icon className="w-3.5 h-3.5 opacity-40" style={{ color: s.accent }} />
            </div>
            <div className="text-xl font-bold leading-none mb-2" data-testid={`stat-${s.label}`} style={{ color: "var(--color-text)" }}>
              {currency(s.value)}
            </div>
            <div className="flex items-end justify-between">
              {s.diff !== null ? (
                <span className={`text-[10px] font-semibold ${(s.invertDiff ? s.diff < 0 : s.diff > 0) ? "text-emerald-400" : s.diff === 0 ? "" : "text-rose-400"}`}
                  style={s.diff === 0 ? { color: "var(--color-text-low)" } : {}}>
                  {s.diff > 0 ? "+" : ""}{s.diff.toFixed(1)}%
                </span>
              ) : <div />}
              <Sparkline values={s.spark} color={s.accent} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── SMART METRICS ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-xl p-4" style={card}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--color-text-low)" }}>Velocidade de gastos</p>
          <p className="text-xl font-bold mb-1" style={{ color: "var(--color-text)" }}>{currency(dailyRate)}<span className="text-xs font-normal ml-1" style={{ color: "var(--color-text-muted)" }}>/dia</span></p>
          <div className="h-1.5 rounded-full mb-1" style={{ background: "var(--color-border)" }}>
            <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${velocityPct}%` }} transition={{ duration: 0.8 }}
              style={{ background: velocityPct < 50 ? "#22c55e" : velocityPct < 80 ? "#f59e0b" : "#ef4444" }} />
          </div>
          <p className="text-[10px]" style={{ color: "var(--color-text-low)" }}>
            {velocityPct < 50 ? "Ritmo saudável" : velocityPct < 80 ? "Atenção ao ritmo" : "Ritmo acelerado"}
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
          className="rounded-xl p-4" style={card}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--color-text-low)" }}>Limite diário disponível</p>
          <p className={`text-xl font-bold mb-1 ${dailyLimit < 0 ? "text-rose-400" : "text-emerald-400"}`}>
            {dailyLimit < 0 ? "-" : ""}{currency(Math.abs(dailyLimitSafe))}
          </p>
          <div className="h-1.5 rounded-full mb-1" style={{ background: "var(--color-border)" }}>
            <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${todayPct}%` }} transition={{ duration: 0.8 }}
              style={{ background: todayPct > 80 ? "#ef4444" : todayPct > 50 ? "#f59e0b" : "#22c55e" }} />
          </div>
          <div className="flex justify-between text-[10px]" style={{ color: "var(--color-text-low)" }}>
            <span>Hoje: {currency(todaySpent)}</span><span>{daysRemaining} dias</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
          className="rounded-xl p-4" style={card}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--color-text-low)" }}>Projeção & runway</p>
          <div className="space-y-1.5">
            {[
              { label: "Fim do mês", val: currency(projectedEndBalance), color: projectedEndBalance >= 0 ? "text-emerald-400" : "text-rose-400" },
              { label: "Reserva", val: runway < 1 ? `${(runway * 30).toFixed(0)} dias` : `${runway.toFixed(1)} meses`, color: "text-violet-400" },
              { label: "Poupança", val: `${savingsRate.toFixed(1)}%`, color: savingsRate > 20 ? "text-emerald-400" : savingsRate > 5 ? "text-amber-400" : "text-rose-400" },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-center">
                <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{row.label}</span>
                <span className={`text-xs font-semibold ${row.color}`}>{row.val}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── SMART TIPS STRIP ────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
        className="rounded-xl px-4 py-3 flex items-center gap-2 flex-wrap" style={card}>
        <Lightbulb className="w-3.5 h-3.5 shrink-0 text-amber-400" />
        <div className="flex gap-2 flex-wrap">
          {tips.map((t, i) => (
            <span key={i} className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${t.color}`}>
              <t.icon className="w-3 h-3 shrink-0" />{t.text}
              {i < tips.length - 1 && <span className="text-zinc-700 mx-1">·</span>}
            </span>
          ))}
        </div>
      </motion.div>

      {/* ── SYSTEM INSIGHTS ─────────────────────────────────────────────── */}
      {data.insights.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {data.insights.map((ins, i) => {
            const cfg = insightCfg[ins.type] || insightCfg.info;
            return (
              <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="flex gap-2.5 rounded-xl border p-3"
                style={{ background: cfg.bg, borderColor: cfg.border }}>
                <cfg.icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${cfg.text}`} />
                <div>
                  <div className={`text-xs font-semibold mb-0.5 ${cfg.text}`}>{ins.title}</div>
                  <div className="text-[11px] leading-relaxed" style={{ color: "var(--color-text-muted)" }}>{ins.message}</div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── CHARTS ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl p-5" style={card}>
          <SectionHeader title="Fluxo de caixa" sub="Receitas vs despesas — últimos 6 meses" />
          <div className="h-52">
            <ResponsiveContainer>
              <AreaChart data={data.monthly} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gI" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} /><stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} /><stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--color-text-low)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-text-low)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="income" stroke="#22c55e" fill="url(#gI)" strokeWidth={2} name="Receitas" dot={false} />
                <Area type="monotone" dataKey="expense" stroke="#ef4444" fill="url(#gE)" strokeWidth={2} name="Despesas" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl p-5" style={card}>
          <SectionHeader title="Por categoria" sub="Distribuição de despesas" />
          <div className="h-52">
            {data.categories.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs" style={{ color: "var(--color-text-low)" }}>Sem dados ainda</div>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={data.categories} dataKey="amount" nameKey="category" cx="50%" cy="44%" innerRadius={34} outerRadius={66} paddingAngle={3} strokeWidth={0}>
                    {data.categories.map((c, i) => <Cell key={i} fill={CATEGORY_COLORS[c.category] || PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => currency(Number(v))} contentStyle={{ borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--color-surface-strong)" }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── HEATMAP + CATEGORY BARS ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <div className="rounded-xl p-5" style={card}>
          <SectionHeader title="Mapa de gastos"
            sub={now.toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}
            action={
              <div className="flex items-center gap-1">
                {[0.12,0.3,0.5,0.7,0.9].map(o => <div key={o} className="w-2.5 h-2.5 rounded-sm" style={{background:`rgba(239,68,68,${o})`}}/>)}
              </div>
            }
          />
          <SpendingHeatmap days={calDays} />
        </div>

        <div className="rounded-xl p-5" style={card}>
          <SectionHeader title="Breakdown" sub="Participação por categoria"
            action={<span className="text-[10px]" style={{ color: "var(--color-text-low)" }}>{currency(curMonth.expense)} total</span>}
          />
          <CategoryBars categories={data.categories} />
        </div>
      </div>

      {/* ── BUDGETS + GOALS + RECENT ────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Budgets */}
        <div className="rounded-xl p-5" style={card}>
          <SectionHeader title="Orçamentos" sub="Mês atual"
            action={<a href="/app/budgets" className="text-[10px] font-semibold text-violet-400 hover:underline flex items-center gap-0.5">Ver todos<ChevronRight className="w-3 h-3"/></a>}
          />
          {budgets.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2">
              <Wallet className="w-7 h-7 opacity-20" style={{ color: "var(--color-text-muted)" }} />
              <p className="text-xs" style={{ color: "var(--color-text-low)" }}>Nenhum orçamento</p>
              {!isFree && <a href="/app/budgets" className="text-xs text-violet-400 font-semibold hover:underline">Criar</a>}
            </div>
          ) : (
            <div className="space-y-3">
              {budgets.map(b => {
                const pct = Math.min(b.percentage, 100);
                const col = b.percentage > 100 ? "#ef4444" : b.percentage >= 80 ? "#f59e0b" : "#22c55e";
                return (
                  <div key={b.id}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-medium truncate max-w-[110px]" style={{ color: "var(--color-text)" }}>{b.category}</span>
                      <span className="text-[10px]" style={{ color: "var(--color-text-low)" }}>{currency(b.spent)}/{currency(b.limit)}</span>
                    </div>
                    <div className="h-1 rounded-full" style={{background:"var(--color-border)"}}>
                      <motion.div initial={{width:0}} animate={{width:`${pct}%`}} transition={{duration:0.8}} className="h-full rounded-full" style={{background:col}}/>
                    </div>
                    {b.percentage > 100 && <p className="text-[9px] text-rose-400 mt-0.5">+{(b.percentage-100).toFixed(0)}% acima</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Goals */}
        <div className="rounded-xl p-5" style={card}>
          <SectionHeader title="Metas" sub="Em progresso"
            action={<a href="/app/goals" className="text-[10px] font-semibold text-violet-400 hover:underline flex items-center gap-0.5">Ver todas<ChevronRight className="w-3 h-3"/></a>}
          />
          {goals.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2">
              <Target className="w-7 h-7 opacity-20" style={{ color: "var(--color-text-muted)" }} />
              <p className="text-xs" style={{ color: "var(--color-text-low)" }}>Nenhuma meta criada</p>
              <a href="/app/goals" className="text-xs text-violet-400 font-semibold hover:underline">Criar meta</a>
            </div>
          ) : (
            <div className="space-y-3">
              {goals.map(g => {
                const pct = Math.min((g.currentAmount/g.targetAmount)*100,100);
                const dLeft = Math.ceil((new Date(g.deadline).getTime()-Date.now())/86400000);
                return (
                  <div key={g.id}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-medium truncate max-w-[130px]" style={{ color: "var(--color-text)" }}>{g.title}</span>
                      <span className="text-[10px] text-violet-400">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1 rounded-full" style={{background:"var(--color-border)"}}>
                      <motion.div initial={{width:0}} animate={{width:`${pct}%`}} transition={{duration:0.9}}
                        className="h-full rounded-full" style={{background:"linear-gradient(90deg,#7c3aed,#4f46e5)"}}/>
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[9px]" style={{ color: "var(--color-text-low)" }}>{currency(g.currentAmount)} / {currency(g.targetAmount)}</span>
                      {dLeft > 0 && <span className="text-[9px] flex items-center gap-0.5" style={{ color: "var(--color-text-low)" }}><Clock className="w-2 h-2"/>{dLeft}d</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent */}
        <div className="rounded-xl p-5" style={card}>
          <SectionHeader title="Recentes" sub="Últimas transações"
            action={<a href="/app/transactions" className="text-[10px] font-semibold text-violet-400 hover:underline flex items-center gap-0.5">Ver todas<ChevronRight className="w-3 h-3"/></a>}
          />
          <div className="space-y-1" data-testid="recent-transactions">
            {data.recent.length === 0 && (
              <div className="flex flex-col items-center py-8 gap-2">
                <Activity className="w-7 h-7 opacity-20" style={{ color: "var(--color-text-muted)" }} />
                <p className="text-xs" style={{ color: "var(--color-text-low)" }}>Nenhuma transação</p>
              </div>
            )}
            {data.recent.map((t,i) => (
              <motion.div key={t.id} initial={{opacity:0,x:6}} animate={{opacity:1,x:0}} transition={{delay:i*0.04}}
                className="flex items-center gap-2.5 p-2 rounded-lg transition-colors"
                style={{ cursor: "default" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--color-surface-strong)")}
                onMouseLeave={e => (e.currentTarget.style.background = "")}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${t.type==="INCOME"?"bg-emerald-500/10":"bg-rose-500/10"}`}>
                  {t.type==="INCOME"?<ArrowUpRight className="w-3 h-3 text-emerald-400"/>:<ArrowDownRight className="w-3 h-3 text-rose-400"/>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate" style={{ color: "var(--color-text)" }}>{t.title}</div>
                  <div className="text-[10px]" style={{ color: "var(--color-text-low)" }}>{t.category} · {dateBR(t.date)}</div>
                </div>
                <div className={`text-xs font-semibold shrink-0 ${t.type==="INCOME"?"text-emerald-400":"text-rose-400"}`}>
                  {t.type==="INCOME"?"+":"-"}{currency(t.amount)}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── AI INSIGHTS ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {aiInsights && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="rounded-xl p-5" style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.18)" }}
            data-testid="ai-insights-panel">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Análise IA · Claude</h3>
                  <p className="text-[10px]" style={{ color: "var(--color-text-low)" }}>Insights personalizados</p>
                </div>
              </div>
              <button onClick={() => setAiInsights(null)} className="p-1.5 rounded-lg opacity-50 hover:opacity-100" style={{ color: "var(--color-text-muted)" }}><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {aiInsights.map((ins, i) => {
                const cfg = insightCfg[ins.type] || insightCfg.info;
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                    className="rounded-xl p-3.5 flex gap-2.5" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                    <cfg.icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${cfg.text}`} />
                    <div>
                      <div className={`text-xs font-semibold mb-0.5 ${cfg.text}`}>{ins.title}</div>
                      <div className="text-[11px] leading-relaxed" style={{ color: "var(--color-text-muted)" }}>{ins.message}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODALS ──────────────────────────────────────────────────────── */}
      <QuickAddModal open={quickAddOpen} onClose={() => setQuickAddOpen(false)} onAdded={fetchDashboard} categories={categories} />
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  );
}
