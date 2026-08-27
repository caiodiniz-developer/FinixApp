import { useCallback, useEffect, useRef, useState, lazy, Suspense } from "react";
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank,
  FileDown, FileSpreadsheet, ArrowUpRight, ArrowDownRight,
  Info, AlertTriangle, CheckCircle2, Sparkles, Loader2,
  Plus, Target, X, Activity, Zap, Clock, Flame,
  ChevronRight, Lightbulb, ShieldCheck, Award,
  Download, Receipt, Bell, BarChart3, AreaChart as AreaChartIcon,
  CalendarClock, TriangleAlert,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
  LineChart, Line, ReferenceLine,
} from "recharts";
import { api, apiErrorMessage } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { DashboardData, Insight, Budget, Goal, Forecast } from "../types";
import { currency, dateBR, CATEGORY_COLORS } from "../utils/format";
import { UpgradeModal } from "../components/UpgradeModal";
import { Reveal } from "../components/dashboard/Reveal";
import { CountUpCurrency } from "../components/dashboard/CountUpCurrency";
import { FinancialRadar } from "../components/dashboard/FinancialRadar";
import { SavingsSimulator } from "../components/dashboard/SavingsSimulator";
import { Celebration } from "../components/dashboard/Celebration";
import { Achievements, Achievement } from "../components/dashboard/Achievements";
import { gsap } from "../lib/gsap";
import toast from "react-hot-toast";

// Three.js is a heavy dependency for a purely decorative element — load it
// in its own chunk instead of the main dashboard bundle.
const HealthOrb = lazy(() =>
  import("../components/dashboard/HealthOrb").then(m => ({ default: m.HealthOrb })),
);

interface CalendarDay { date: string; expense: number; revenue: number; net: number; }
interface AlertItem {
  id: string; title: string; description?: string | null;
  amount?: number | null; daysUntilDue?: number | null;
  severity?: "info" | "warning" | "danger"; dueDate?: string | null;
}
interface TopExpense { id: string; title: string; amount: number; category: string; date: string; }

// ─── QUICK-ADD MODAL ──────────────────────────────────────────────────────────
function QuickAddModal({ open, onClose, onAdded, categories, accounts }: {
  open: boolean; onClose: () => void; onAdded: () => void; categories: string[]; accounts: { id: string; name: string }[];
}) {
  const [form, setForm] = useState({ title: "", amount: "", type: "EXPENSE" as "INCOME" | "EXPENSE", category: categories[0] || "Outros", date: new Date().toISOString().split("T")[0], accountId: "" });
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/api/transactions", { ...form, amount: parseFloat(form.amount), accountId: form.accountId || null, paymentMethod: "pix", installments: 1 });
      toast.success("Transação adicionada!");
      onAdded(); onClose();
      setForm(f => ({ ...f, title: "", amount: "" }));
    } catch (e: any) { toast.error(apiErrorMessage(e) || "Erro"); }
    finally { setLoading(false); }
  };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(14px)" }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }} transition={{ type: "spring", damping: 26, stiffness: 340 }}
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-hairline-strong)", boxShadow: "0 40px 80px rgba(0,0,0,0.7)" }}
        onClick={e => e.stopPropagation()}>
        {/* header strip */}
        <div className="px-6 pt-5 pb-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-base" style={{ color: "var(--color-text)" }}>Nova transação</h2>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-low)" }}>Adicione uma receita ou despesa</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-[var(--color-hairline)]" style={{ color: "var(--color-text-low)" }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {/* type toggle */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl" style={{ background: "var(--color-surface-strong)" }}>
            {(["EXPENSE", "INCOME"] as const).map(t => (
              <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t }))}
                className={`py-3 rounded-lg text-xs font-bold transition-all ${form.type === t ? t === "EXPENSE" ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "opacity-40"}`}
                style={{ color: form.type === t ? undefined : "var(--color-text-muted)" }}>
                {t === "EXPENSE" ? "↓ Despesa" : "↑ Receita"}
              </button>
            ))}
          </div>
          <input className="input w-full" placeholder="Descrição da transação..." value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" step="0.01" min="0.01" className="input num" placeholder="Valor R$" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
            <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {(categories.length ? categories : ["Outros"]).map(c => <option key={c}>{c}</option>)}
          </select>
          {accounts.length > 0 && (
            <select className="input" value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}>
              <option value="">Sem conta</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg,#10b981,#059669)", boxShadow: "0 4px 20px rgba(16,185,129,0.3)" }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Salvar transação"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ─── HEALTH RING ──────────────────────────────────────────────────────────────
function HealthRing({ score }: { score: number }) {
  const r = 38, circ = 2 * Math.PI * r, dash = (score / 100) * circ;
  const color = score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";
  const label = score >= 70 ? "Excelente" : score >= 40 ? "Regular" : "Atenção";
  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      <div className="relative w-20 h-20">
        <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" stroke="var(--color-hairline)" strokeWidth="6" />
          <motion.circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
            initial={{ strokeDasharray: `0 ${circ}` }} animate={{ strokeDasharray: `${dash} ${circ}` }}
            transition={{ duration: 1.3, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0 0 6px ${color}60)` }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span className="text-lg font-black leading-none num" style={{ color }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>{score}</motion.span>
          <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-low)" }}>/100</span>
        </div>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{label}</span>
    </div>
  );
}

// ─── SPARKLINE ────────────────────────────────────────────────────────────────
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1), min = Math.min(...values), range = max - min || 1;
  const W = 60, H = 22;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - ((v - min) / range) * (H - 4) - 2}`).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
    </svg>
  );
}

// ─── CHART TOOLTIP ────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl p-3"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border-strong)", boxShadow: "var(--color-shadow)", backdropFilter: "blur(12px)" }}>
      <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-text-low)" }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: "var(--color-text-muted)" }}>{p.name}</span>
          <span className="font-bold ml-auto pl-4 num" style={{ color: p.color }}>{currency(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── SPENDING HEATMAP ─────────────────────────────────────────────────────────
function SpendingHeatmap({ days }: { days: CalendarDay[] }) {
  const [hovered, setHovered] = useState<CalendarDay | null>(null);
  if (days.length === 0) return <div className="h-20 flex items-center justify-center text-xs" style={{ color: "var(--color-text-low)" }}>Sem dados</div>;
  const maxE = Math.max(...days.map(d => d.expense), 1);
  const first = new Date(days[0].date + "T12:00:00");
  const cells: (CalendarDay | null)[] = [...Array(first.getDay()).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  const col = (e: number) => {
    if (e === 0) return "var(--color-hairline)";
    const i = Math.pow(e / maxE, 0.5);
    return `rgba(239,${Math.round(68 * (1 - i * 0.7))},${Math.round(68 * (1 - i * 0.7))},${0.1 + i * 0.65})`;
  };
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-0.5">
        {["D","S","T","Q","Q","S","S"].map((d, i) => (
          <div key={i} className="text-center text-[8px] font-bold uppercase" style={{ color: "var(--color-text-low)" }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => (
          <div key={i} className="aspect-square rounded-md transition-all hover:scale-110 hover:ring-1 hover:ring-[var(--color-hairline-strong)] cursor-default"
            style={{ background: day ? col(day.expense) : "transparent" }}
            onMouseEnter={() => day && setHovered(day)} onMouseLeave={() => setHovered(null)}>
            {day && (
              <div className="w-full h-full flex items-center justify-center text-[8px] font-medium" style={{ color: "var(--color-text-low)" }}>
                {new Date(day.date + "T12:00:00").getDate()}
              </div>
            )}
          </div>
        ))}
      </div>
      <AnimatePresence>
        {hovered && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-2 flex items-center justify-between rounded-xl px-3 py-2 text-xs"
            style={{ background: "var(--color-hairline)", border: "1px solid var(--color-hairline-strong)" }}>
            <span style={{ color: "var(--color-text-muted)" }}>{new Date(hovered.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
            <span className="text-rose-400 font-semibold num">{hovered.expense > 0 ? `- ${currency(hovered.expense)}` : "—"}</span>
            {hovered.revenue > 0 && <span className="text-emerald-400 font-semibold num">+ {currency(hovered.revenue)}</span>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── CATEGORY BARS ────────────────────────────────────────────────────────────
function CategoryBars({ categories }: { categories: { category: string; amount: number }[] }) {
  const COLORS = ["#2563eb","#0891b2","#059669","#d97706","#dc2626","#8b5cf6","#0ea5e9","#be185d"];
  if (categories.length === 0) return <div className="h-20 flex items-center justify-center text-xs" style={{ color: "var(--color-text-low)" }}>Sem dados</div>;
  const total = categories.reduce((s, c) => s + c.amount, 0);
  return (
    <div className="space-y-3">
      {categories.slice(0, 6).map((cat, i) => {
        const pct = total > 0 ? (cat.amount / total) * 100 : 0;
        const color = CATEGORY_COLORS[cat.category] || COLORS[i % COLORS.length];
        return (
          <div key={cat.category}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 6px ${color}80` }} />
                <span className="text-xs font-medium truncate max-w-[100px]" style={{ color: "var(--color-text)" }}>{cat.category}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-[10px]" style={{ color: "var(--color-text-low)" }}>{pct.toFixed(0)}%</span>
                <span className="text-xs font-semibold num" style={{ color: "var(--color-text)" }}>{currency(cat.amount)}</span>
              </div>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--color-hairline)" }}>
              <motion.div className="h-full rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}60` }}
                initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                transition={{ duration: 0.9, ease: "easeOut", delay: i * 0.06 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── METRIC CARD ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color, barPct }: { label: string; value: string; sub: string; color: string; barPct?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="rounded-2xl p-4 flex flex-col gap-2"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--color-shadow)" }}>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-low)" }}>{label}</p>
      <p className="text-xl font-black num leading-none" style={{ color }}>{value}</p>
      {barPct !== undefined && (
        <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--color-hairline)" }}>
          <motion.div className="h-full rounded-full" style={{ background: color }}
            initial={{ width: 0 }} animate={{ width: `${Math.min(barPct, 100)}%` }}
            transition={{ duration: 0.9 }} />
        </div>
      )}
      <p className="text-[10px]" style={{ color: "var(--color-text-low)" }}>{sub}</p>
    </motion.div>
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
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [calDays, setCalDays] = useState<CalendarDay[]>([]);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [topExpenses, setTopExpenses] = useState<TopExpense[]>([]);
  const [csvLoading, setCsvLoading] = useState(false);
  const [chartView, setChartView] = useState<"area" | "bar">("area");
  const heroRef = useRef<HTMLDivElement>(null);

  const isFree = user?.plan === "FREE";
  const canExportPdf = user?.plan !== "FREE";
  const canExportExcel = user?.plan === "PRO";
  const canExportCsv = user?.plan !== "FREE";
  const canUseAi = user?.plan !== "FREE";
  const canAddTx = user?.plan !== "FREE";

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setError(null); setLoading(true);
    try { const r = await api.get("/api/dashboard"); setData(r.data); }
    catch (e: any) { const m = apiErrorMessage(e) || "Erro"; setError(m); toast.error(m); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { if (!user) { setData(null); setLoading(false); return; } fetchAll(); }, [user, fetchAll]);

  useEffect(() => {
    if (!user) return;
    const mp = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    Promise.allSettled([
      api.get("/api/alerts"), api.get("/api/budgets"), api.get("/api/goals"),
      api.get("/api/categories"), api.get(`/api/calendar?month=${mp}`), api.get("/api/accounts"),
      api.get("/api/forecast?days=30"),
    ]).then(([al, bu, go, ca, cl, ac, fc]) => {
      if (al.status === "fulfilled") setAlerts(al.value.data);
      if (bu.status === "fulfilled") setBudgets(bu.value.data.slice(0, 4));
      if (go.status === "fulfilled") setGoals(go.value.data.slice(0, 3));
      if (ca.status === "fulfilled") setCategories(ca.value.data.map((c: any) => c.name));
      if (cl.status === "fulfilled") setCalDays(cl.value.data.dailySummary || []);
      if (ac.status === "fulfilled") setAccounts(ac.value.data);
      if (fc.status === "fulfilled") setForecast(fc.value.data);
    });
  }, [user]);

  // "Maiores gastos" needs the raw transaction list (plan-gated backend-side,
  // same as the Transactions page) — fetched separately so the main
  // dashboard payload stays lean.
  useEffect(() => {
    if (!user || isFree) { setTopExpenses([]); return; }
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const start = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    const end = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate())}`;
    api.get(`/api/transactions?type=EXPENSE&startDate=${start}&endDate=${end}`)
      .then(r => {
        const list: TopExpense[] = (r.data || [])
          .slice()
          .sort((a: any, b: any) => b.amount - a.amount)
          .slice(0, 5);
        setTopExpenses(list);
      })
      .catch(() => setTopExpenses([]));
  }, [user, isFree]);

  // Hero entrance choreography — plays once the dashboard payload lands and
  // the greeting/health ring/chips are actually on screen. Layered on top of
  // the Framer Motion fade on the hero container itself.
  useEffect(() => {
    if (!data || !heroRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from("[data-hero='ring']", { opacity: 0, scale: 0.7, duration: 0.55 })
        .from("[data-hero='eyebrow']", { opacity: 0, y: 8, duration: 0.4 }, "-=0.3")
        .from("[data-hero='heading']", { opacity: 0, y: 10, duration: 0.5 }, "-=0.25")
        .from("[data-hero='date']", { opacity: 0, y: 6, duration: 0.35 }, "-=0.3")
        .from("[data-hero='chip']", { opacity: 0, y: 6, scale: 0.85, duration: 0.35, stagger: 0.08 }, "-=0.15")
        .from("[data-hero='action']", { opacity: 0, y: 8, duration: 0.35, stagger: 0.05 }, "-=0.35");
    }, heroRef);
    return () => ctx.revert();
  }, [data]);

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

  const handleExportCsv = async () => {
    if (!canExportCsv) { setUpgradeOpen(true); return; }
    setCsvLoading(true);
    try {
      const r = await api.get("/api/transactions");
      const rows: any[] = r.data || [];
      const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const header = ["Data", "Título", "Tipo", "Categoria", "Valor"].join(";");
      const lines = rows.map(t => [
        dateBR(t.date), escape(t.title), t.type, escape(t.category),
        String(t.amount).replace(".", ","),
      ].join(";"));
      const csv = "﻿" + [header, ...lines].join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "finix-transacoes.csv"; a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exportado!");
    } catch { toast.error("Erro ao exportar CSV"); }
    finally { setCsvLoading(false); }
  };

  const generateAi = async () => {
    if (!canUseAi) { setUpgradeOpen(true); return; }
    setAiLoading(true);
    try { const r = await api.post("/api/insights/ai"); setAiInsights(r.data.insights || []); toast.success("Análise pronta!"); }
    catch { toast.error("Falha ao gerar análise"); }
    finally { setAiLoading(false); }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
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
    <div className="p-5 rounded-2xl" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
      <p className="font-semibold text-rose-400">{error}</p>
      <button onClick={fetchAll} className="btn-primary mt-3 text-sm">Tentar novamente</button>
    </div>
  );
  if (!data) return null;

  // ── Computed ─────────────────────────────────────────────────────────────
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysRemaining = daysInMonth - dayOfMonth + 1;
  const curMonth = data.monthly[data.monthly.length - 1] || { income: 0, expense: 0 };
  const prevMonth = data.monthly[data.monthly.length - 2] || { income: 0, expense: 0 };
  const dailyRate = dayOfMonth > 0 ? curMonth.expense / dayOfMonth : 0;
  const dailyLimit = curMonth.income > 0 ? (curMonth.income - curMonth.expense) / daysRemaining : 0;
  const projectedEnd = curMonth.income - (curMonth.expense + dailyRate * daysRemaining);
  const avgMonthly = data.monthly.reduce((s, m) => s + m.expense, 0) / (data.monthly.length || 1);
  const runway = avgMonthly > 0 ? data.balance / avgMonthly : 0;
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
  for (const d of [...calDays].sort((a, b) => b.date.localeCompare(a.date))) {
    if (d.expense === 0 && d.revenue === 0) continue;
    if (d.net >= 0) streak++; else break;
  }

  const stats = [
    { label: "Saldo total", value: data.balance, diff: null, inv: false, spark: data.monthly.map(m => m.income - m.expense), color: "#38bdf8", icon: Wallet },
    { label: "Receitas", value: curMonth.income, diff: incomeDiff, inv: false, spark: data.monthly.map(m => m.income), color: "#22c55e", icon: TrendingUp },
    { label: "Despesas", value: curMonth.expense, diff: expenseDiff, inv: true, spark: data.monthly.map(m => m.expense), color: "#f87171", icon: TrendingDown },
    { label: "Economizado", value: data.saved, diff: null, inv: false, spark: data.monthly.map(m => m.income - m.expense), color: "#fbbf24", icon: PiggyBank },
  ];

  const insightCfg = {
    info: { icon: Info, border: "rgba(59,130,246,0.2)", text: "#60a5fa", bg: "rgba(59,130,246,0.05)" },
    warning: { icon: AlertTriangle, border: "rgba(245,158,11,0.2)", text: "#fbbf24", bg: "rgba(245,158,11,0.05)" },
    success: { icon: CheckCircle2, border: "rgba(34,197,94,0.2)", text: "#4ade80", bg: "rgba(34,197,94,0.05)" },
  } as const;

  const PIE_COLORS = ["#2563eb","#0891b2","#059669","#d97706","#dc2626","#0ea5e9"];

  const tips: { icon: React.ElementType; text: string; color: string }[] = [];
  if (streak > 2) tips.push({ icon: Flame, text: `${streak} dias consecutivos positivos`, color: "#fb923c" });
  if (savingsRate > 20) tips.push({ icon: Award, text: `${savingsRate.toFixed(0)}% poupado — acima da média`, color: "#4ade80" });
  else if (savingsRate < 5 && data.income > 0) tips.push({ icon: Lightbulb, text: "Tente poupar ao menos 10% da renda", color: "#fbbf24" });
  if (runway < 3) tips.push({ icon: ShieldCheck, text: `Reserva: ${runway.toFixed(1)} meses — ideal 3-6`, color: "#60a5fa" });
  if (projectedEnd < 0) tips.push({ icon: TrendingDown, text: `Projeção negativa de ${currency(Math.abs(projectedEnd))}`, color: "#f87171" });
  if (budgets.some(b => b.percentage > 100)) tips.push({ icon: AlertTriangle, text: "Limite excedido em algum orçamento", color: "#f87171" });
  if (tips.length === 0) tips.push({ icon: CheckCircle2, text: "Finanças equilibradas. Continue assim!", color: "#4ade80" });

  const bestGoalPct = goals.length > 0
    ? Math.max(...goals.map(g => (g.currentAmount / g.targetAmount) * 100))
    : 0;
  const achievements: Achievement[] = [
    { id: "streak", label: "Sequência positiva", hint: "3+ dias seguidos com saldo positivo", icon: Flame, color: "#fb923c", unlocked: streak >= 3 },
    { id: "saver", label: "Poupador", hint: "Poupando 20%+ da renda", icon: PiggyBank, color: "#a78bfa", unlocked: savingsRate >= 20 },
    { id: "budget", label: "Orçamento em dia", hint: "Nenhum orçamento estourado", icon: ShieldCheck, color: "#22c55e", unlocked: budgets.length > 0 && !budgets.some(b => b.percentage > 100) },
    { id: "health", label: "Saúde excelente", hint: "Score de saúde financeira 70+", icon: Award, color: "#facc15", unlocked: healthScore >= 70 },
    { id: "goal", label: "Meta na metade", hint: "Alguma meta com 50%+ concluída", icon: Target, color: "#34d399", unlocked: bestGoalPct >= 50 },
    { id: "runway", label: "Reserva sólida", hint: "3+ meses de despesas guardados", icon: Wallet, color: "#38bdf8", unlocked: runway >= 3 },
  ];

  const C = "var(--color-surface)";
  const B = "1px solid var(--color-border)";
  const SH = "var(--color-shadow)";
  const CARD = "rounded-2xl p-5 transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5";

  const linkStyle = { color: "#60a5fa", fontSize: "10px", fontWeight: 600, display: "flex", alignItems: "center", gap: 2 };

  return (
    <div className="space-y-4" data-testid="dashboard">
      <Celebration trigger={healthScore >= 70} />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <motion.div ref={heroRef} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl overflow-hidden p-5 sm:p-6"
        style={{ background: C, border: B, boxShadow: SH }}>
        {/* subtle bg glow */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 20% 50%,rgba(14,165,233,0.04) 0%,transparent 60%)" }} />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div data-hero="ring" className="relative shrink-0 w-20 h-20">
              <div className="absolute inset-0 flex items-center justify-center opacity-70 pointer-events-none">
                <Suspense fallback={null}>
                  <HealthOrb score={healthScore} size={92} />
                </Suspense>
              </div>
              <HealthRing score={healthScore} />
            </div>
            <div>
              <p data-hero="eyebrow" className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: "var(--color-text-low)" }}>Saúde financeira</p>
              <h1 data-hero="heading" className="text-2xl font-black leading-tight tracking-tight" style={{ color: "var(--color-text)" }}>
                {user.plan === "PRO" && user.companyName ? user.companyName : `Olá, ${user.name.split(" ")[0]}`}
              </h1>
              <p data-hero="date" className="text-xs mt-0.5 capitalize" style={{ color: "var(--color-text-low)" }}>
                {now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {alerts.count > 0 && (
                  <span data-hero="chip" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-rose-400" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <AlertTriangle className="w-2.5 h-2.5" /> {alerts.count} alertas
                  </span>
                )}
                {streak > 1 && (
                  <span data-hero="chip" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold text-orange-400" style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)" }}>
                    <Flame className="w-2.5 h-2.5" /> {streak} dias
                  </span>
                )}
                {isFree && (
                  <span data-hero="chip" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ color: "var(--color-text-low)", background: "var(--color-hairline)", border: "1px solid var(--color-hairline-strong)" }}>
                    <Zap className="w-2.5 h-2.5" /> Grátis
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canAddTx && (
              <button data-hero="action" onClick={() => setQuickAddOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 active:scale-[0.97]"
                style={{ background: "linear-gradient(135deg,#10b981,#059669)", boxShadow: "0 4px 14px rgba(16,185,129,0.3)" }}>
                <Plus className="w-3.5 h-3.5" /> Transação
              </button>
            )}
            <button data-hero="action" onClick={generateAi} disabled={aiLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:bg-[var(--color-hairline)]"
              style={{ color: "var(--color-text-muted)", border: B }} data-testid="ai-insights-btn">
              {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {aiLoading ? "Analisando..." : "Análise IA"}
            </button>
            <button data-hero="action" onClick={() => handleExport("pdf")} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:bg-[var(--color-hairline)] ${!canExportPdf ? "opacity-30" : ""}`} style={{ color: "var(--color-text-muted)", border: B }} data-testid="export-pdf">
              <FileDown className="w-3.5 h-3.5" /> PDF
            </button>
            <button data-hero="action" onClick={() => handleExport("excel")} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:bg-[var(--color-hairline)] ${!canExportExcel ? "opacity-30" : ""}`} style={{ color: "var(--color-text-muted)", border: B }} data-testid="export-excel">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </button>
            <button data-hero="action" onClick={handleExportCsv} disabled={csvLoading} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:bg-[var(--color-hairline)] ${!canExportCsv ? "opacity-30" : ""}`} style={{ color: "var(--color-text-muted)", border: B }} data-testid="export-csv">
              {csvLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} CSV
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── CONQUISTAS ───────────────────────────────────────────────────── */}
      <Achievements items={achievements} />

      {/* ── STAT CARDS ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -3 }}
            transition={{ delay: i * 0.06, type: "spring", damping: 22 }}
            className="rounded-2xl p-4 relative overflow-hidden group"
            style={{ background: C, border: B, boxShadow: SH }}>
            <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: `radial-gradient(ellipse at 80% 20%,${s.color}12 0%,transparent 60%)` }} />
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--color-text-low)" }}>{s.label}</span>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${s.color}15`, border: `1px solid ${s.color}25` }}>
                  <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} />
                </div>
              </div>
              <div className="text-2xl font-black num leading-none mb-2.5 tracking-tight" style={{ color: "var(--color-text)" }} data-testid={`stat-${s.label}`}>
                <CountUpCurrency value={s.value} />
              </div>
              <div className="flex items-end justify-between">
                {s.diff !== null ? (
                  <span className={`text-[10px] font-bold num ${(s.inv ? s.diff < 0 : s.diff > 0) ? "text-emerald-400" : s.diff === 0 ? "" : "text-rose-400"}`}
                    style={s.diff === 0 ? { color: "var(--color-text-low)" } : {}}>
                    {s.diff > 0 ? "+" : ""}{s.diff.toFixed(1)}%
                  </span>
                ) : <div />}
                <Sparkline values={s.spark} color={s.color} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── METRICS ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard label="Ritmo de gastos" value={`${currency(dailyRate)}/dia`}
          barPct={velocityPct} color={velocityPct < 50 ? "#22c55e" : velocityPct < 80 ? "#f59e0b" : "#ef4444"}
          sub={velocityPct < 50 ? "Ritmo saudável" : velocityPct < 80 ? "Atenção ao ritmo" : "Ritmo acelerado"} />
        <MetricCard label="Disponível hoje"
          value={`${dailyLimit < 0 ? "-" : ""}${currency(Math.abs(dailyLimitSafe))}`}
          barPct={todayPct} color={todayPct > 80 ? "#ef4444" : todayPct > 50 ? "#f59e0b" : "#22c55e"}
          sub={`Hoje: ${currency(todaySpent)} · ${daysRemaining} dias restantes`} />
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -2 }}
          className="rounded-2xl p-4" style={{ background: C, border: B, boxShadow: SH }}>
          <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: "var(--color-text-low)" }}>Projeção & runway</p>
          <div className="space-y-2">
            {[
              { k: "Fim do mês", v: currency(projectedEnd), c: projectedEnd >= 0 ? "#4ade80" : "#f87171" },
              { k: "Reserva", v: runway < 1 ? `${(runway*30).toFixed(0)} dias` : `${runway.toFixed(1)} meses`, c: "#38bdf8" },
              { k: "Poupança", v: `${savingsRate.toFixed(1)}%`, c: savingsRate > 20 ? "#4ade80" : savingsRate > 5 ? "#fbbf24" : "#f87171" },
            ].map(row => (
              <div key={row.k} className="flex justify-between items-center">
                <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>{row.k}</span>
                <span className="text-xs font-bold num" style={{ color: row.c }}>{row.v}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── RAIO-X + SIMULADOR ──────────────────────────────────────────── */}
      <Reveal className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={CARD} style={{ background: C, border: B, boxShadow: SH }}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-bold" style={{ color: "var(--color-text)" }}>Raio-X financeiro</h3>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-low)" }}>Os 5 sinais que compõem sua saúde financeira</p>
            </div>
          </div>
          <div data-testid="financial-radar">
            <FinancialRadar axes={[
              { label: "Poupança", value: savingsRate * 2.5 },
              { label: "Controle", value: 100 - expenseRatio },
              { label: "Orçamento", value: budgetHealth },
              { label: "Consistência", value: streak * 15 },
              { label: "Reserva", value: (runway / 6) * 100 },
            ]} />
          </div>
        </div>

        <div data-testid="savings-simulator">
          <SavingsSimulator income={curMonth.income} expense={curMonth.expense} balance={data.balance} />
        </div>
      </Reveal>

      {/* ── TIPS STRIP ──────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
        className="rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap"
        style={{ background: "var(--color-hairline)", border: "1px solid var(--color-hairline)" }}>
        <Lightbulb className="w-3.5 h-3.5 text-sky-400 shrink-0" />
        <div className="flex gap-3 flex-wrap">
          {tips.map((t, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: t.color }}>
              <t.icon className="w-3 h-3 shrink-0" />{t.text}
              {i < tips.length - 1 && <span style={{ color: "var(--color-text-low)" }} className="ml-2">·</span>}
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
                className="flex gap-2.5 rounded-xl p-3.5" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                <cfg.icon className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: cfg.text }} />
                <div>
                  <div className="text-xs font-bold mb-0.5" style={{ color: cfg.text }}>{ins.title}</div>
                  <div className="text-[11px] leading-relaxed" style={{ color: "var(--color-text-muted)" }}>{ins.message}</div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── CHARTS ──────────────────────────────────────────────────────── */}
      <Reveal className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`lg:col-span-2 ${CARD}`} style={{ background: C, border: B, boxShadow: SH }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold" style={{ color: "var(--color-text)" }}>Fluxo de caixa</h3>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-low)" }}>Receitas vs despesas — últimos 6 meses</p>
            </div>
            <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: "var(--color-hairline)", border: "1px solid var(--color-hairline)" }}>
              <button onClick={() => setChartView("area")} title="Área"
                className="p-1.5 rounded-md transition-colors" data-testid="chart-view-area"
                style={{ background: chartView === "area" ? "rgba(56,189,248,0.15)" : "transparent", color: chartView === "area" ? "#38bdf8" : "var(--color-text-low)" }}>
                <AreaChartIcon className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setChartView("bar")} title="Barras"
                className="p-1.5 rounded-md transition-colors" data-testid="chart-view-bar"
                style={{ background: chartView === "bar" ? "rgba(56,189,248,0.15)" : "transparent", color: chartView === "bar" ? "#38bdf8" : "var(--color-text-low)" }}>
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="h-52">
            <ResponsiveContainer>
              {chartView === "area" ? (
                <AreaChart data={data.monthly} margin={{ top: 4, right: 0, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gI" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} /><stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f87171" stopOpacity={0.25} /><stop offset="100%" stopColor="#f87171" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-hairline)" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--color-text-low)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-text-low)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="income" stroke="#22c55e" fill="url(#gI)" strokeWidth={2} name="Receitas" dot={false} />
                  <Area type="monotone" dataKey="expense" stroke="#f87171" fill="url(#gE)" strokeWidth={2} name="Despesas" dot={false} />
                </AreaChart>
              ) : (
                <BarChart data={data.monthly} margin={{ top: 4, right: 0, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-hairline)" vertical={false} />
                  <XAxis dataKey="month" stroke="var(--color-text-low)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-text-low)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="income" fill="#22c55e" name="Receitas" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" fill="#f87171" name="Despesas" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        <div className={CARD} style={{ background: C, border: B, boxShadow: SH }}>
          <div className="mb-4">
            <h3 className="text-sm font-bold" style={{ color: "var(--color-text)" }}>Por categoria</h3>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-low)" }}>Distribuição de despesas</p>
          </div>
          <div className="h-52">
            {data.categories.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs" style={{ color: "var(--color-text-low)" }}>Sem dados ainda</div>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={data.categories} dataKey="amount" nameKey="category" cx="50%" cy="45%" innerRadius={32} outerRadius={66} paddingAngle={3} strokeWidth={0}>
                    {data.categories.map((c, i) => <Cell key={i} fill={CATEGORY_COLORS[c.category] || PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => currency(Number(v))} contentStyle={{ borderRadius: 10, border: "1px solid var(--color-border-strong)", background: "var(--color-surface)", color: "var(--color-text)", boxShadow: "var(--color-shadow)" }} itemStyle={{ color: "var(--color-text)" }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </Reveal>

      {/* ── HEATMAP + CATEGORY BARS ─────────────────────────────────────── */}
      <Reveal className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={CARD} style={{ background: C, border: B, boxShadow: SH }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold" style={{ color: "var(--color-text)" }}>Mapa de gastos</h3>
              <p className="text-[10px] mt-0.5 capitalize" style={{ color: "var(--color-text-low)" }}>{now.toLocaleDateString("pt-BR",{month:"long",year:"numeric"})}</p>
            </div>
            <div className="flex gap-0.5">
              {[0.1,0.3,0.5,0.7,0.9].map(o => <div key={o} className="w-2.5 h-2.5 rounded-sm" style={{ background: `rgba(239,68,68,${o})` }} />)}
            </div>
          </div>
          <SpendingHeatmap days={calDays} />
        </div>

        <div className={CARD} style={{ background: C, border: B, boxShadow: SH }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold" style={{ color: "var(--color-text)" }}>Categorias</h3>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-low)" }}>Participação nos gastos</p>
            </div>
            <span className="text-[10px] font-bold num" style={{ color: "var(--color-text-low)" }}>{currency(curMonth.expense)}</span>
          </div>
          <CategoryBars categories={data.categories} />
        </div>
      </Reveal>

      {/* ── TOP EXPENSES + UPCOMING DUES ─────────────────────────────────── */}
      <Reveal className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Maiores gastos */}
        <div className={CARD} style={{ background: C, border: B, boxShadow: SH }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold" style={{ color: "var(--color-text)" }}>Maiores gastos</h3>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-low)" }}>Top 5 do mês atual</p>
            </div>
            <Receipt className="w-4 h-4" style={{ color: "var(--color-text-low)" }} />
          </div>
          {isFree ? (
            <div className="flex flex-col items-center py-8 gap-2">
              <Receipt className="w-8 h-8 opacity-10" style={{ color: "var(--color-text)" }} />
              <p className="text-xs text-center" style={{ color: "var(--color-text-low)" }}>Disponível a partir do plano Básico</p>
              <button onClick={() => setUpgradeOpen(true)} style={linkStyle}>Fazer upgrade</button>
            </div>
          ) : topExpenses.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2">
              <Receipt className="w-8 h-8 opacity-10" style={{ color: "var(--color-text)" }} />
              <p className="text-xs" style={{ color: "var(--color-text-low)" }}>Nenhum gasto este mês</p>
            </div>
          ) : (
            <div className="space-y-1" data-testid="top-expenses">
              {topExpenses.map((t, i) => {
                const max = topExpenses[0]?.amount || 1;
                const pct = Math.max(6, (t.amount / max) * 100);
                return (
                  <div key={t.id} className="relative flex items-center gap-2.5 px-2 py-2 rounded-xl overflow-hidden">
                    <div className="absolute inset-y-0 left-0 rounded-xl" style={{ width: `${pct}%`, background: "rgba(239,68,68,0.06)" }} />
                    <div className="relative w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black shrink-0" style={{ background: "rgba(239,68,68,0.12)", color: "#f87171" }}>{i + 1}</div>
                    <div className="relative min-w-0 flex-1">
                      <div className="text-xs font-medium truncate" style={{ color: "var(--color-text)" }}>{t.title}</div>
                      <div className="text-[10px]" style={{ color: "var(--color-text-low)" }}>{t.category} · {dateBR(t.date)}</div>
                    </div>
                    <div className="relative text-xs font-bold text-rose-400 num shrink-0">{currency(t.amount)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Próximos vencimentos */}
        <div className={CARD} style={{ background: C, border: B, boxShadow: SH }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold" style={{ color: "var(--color-text)" }}>Próximos vencimentos</h3>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-low)" }}>Parcelas e cobranças de cartão</p>
            </div>
            <a href="/app/alerts" style={linkStyle}>Ver todos <ChevronRight className="w-3 h-3" /></a>
          </div>
          {isFree ? (
            <div className="flex flex-col items-center py-8 gap-2">
              <Bell className="w-8 h-8 opacity-10" style={{ color: "var(--color-text)" }} />
              <p className="text-xs text-center" style={{ color: "var(--color-text-low)" }}>Disponível a partir do plano Básico</p>
              <button onClick={() => setUpgradeOpen(true)} style={linkStyle}>Fazer upgrade</button>
            </div>
          ) : alerts.alerts.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2">
              <CheckCircle2 className="w-8 h-8 opacity-10" style={{ color: "var(--color-text)" }} />
              <p className="text-xs" style={{ color: "var(--color-text-low)" }}>Tudo em dia por aqui</p>
            </div>
          ) : (
            <div className="space-y-1.5" data-testid="upcoming-dues">
              {alerts.alerts.slice(0, 5).map(a => {
                const sev = a.severity === "danger" ? "#f87171" : a.severity === "info" ? "#60a5fa" : "#fbbf24";
                return (
                  <div key={a.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl" style={{ background: `${sev}0d`, border: `1px solid ${sev}22` }}>
                    <Bell className="w-3.5 h-3.5 shrink-0" style={{ color: sev }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate" style={{ color: "var(--color-text)" }}>{a.title}</div>
                      {a.daysUntilDue != null && (
                        <div className="text-[10px]" style={{ color: sev }}>
                          {a.daysUntilDue <= 0 ? "vence hoje" : `vence em ${a.daysUntilDue} dia${a.daysUntilDue > 1 ? "s" : ""}`}
                        </div>
                      )}
                    </div>
                    {a.amount != null && <div className="text-xs font-bold num shrink-0" style={{ color: sev }}>{currency(a.amount)}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Reveal>

      {/* ── BUDGETS + GOALS + RECENT ────────────────────────────────────── */}
      <Reveal className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Budgets */}
        <div className={CARD} style={{ background: C, border: B, boxShadow: SH }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold" style={{ color: "var(--color-text)" }}>Orçamentos</h3>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-low)" }}>Mês atual</p>
            </div>
            <a href="/app/budgets" style={linkStyle}>Ver todos <ChevronRight className="w-3 h-3" /></a>
          </div>
          {budgets.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2">
              <Wallet className="w-8 h-8 opacity-10" style={{ color: "var(--color-text)" }} />
              <p className="text-xs" style={{ color: "var(--color-text-low)" }}>Nenhum orçamento</p>
              {!isFree && <a href="/app/budgets" style={linkStyle}>Criar</a>}
            </div>
          ) : (
            <div className="space-y-3.5">
              {budgets.map(b => {
                const pct = Math.min(b.percentage, 100);
                const col = b.percentage > 100 ? "#ef4444" : b.percentage >= 80 ? "#f59e0b" : "#22c55e";
                return (
                  <div key={b.id}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="text-xs font-medium truncate max-w-[110px]" style={{ color: "var(--color-text)" }}>{b.category}</span>
                      <span className="text-[10px] num" style={{ color: "var(--color-text-low)" }}>{currency(b.spent)} / {currency(b.limit)}</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--color-hairline)" }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }}
                        className="h-full rounded-full" style={{ background: col, boxShadow: `0 0 8px ${col}50` }} />
                    </div>
                    {b.percentage > 100 && <p className="text-[9px] text-rose-400 mt-0.5 font-semibold">+{(b.percentage-100).toFixed(0)}% acima</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Goals */}
        <div className={CARD} style={{ background: C, border: B, boxShadow: SH }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold" style={{ color: "var(--color-text)" }}>Metas</h3>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-low)" }}>Em progresso</p>
            </div>
            <a href="/app/goals" style={linkStyle}>Ver todas <ChevronRight className="w-3 h-3" /></a>
          </div>
          {goals.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-2">
              <Target className="w-8 h-8 opacity-10" style={{ color: "var(--color-text)" }} />
              <p className="text-xs" style={{ color: "var(--color-text-low)" }}>Nenhuma meta criada</p>
              <a href="/app/goals" style={linkStyle}>Criar meta</a>
            </div>
          ) : (
            <div className="space-y-3.5">
              {goals.map(g => {
                const pct = Math.min((g.currentAmount / g.targetAmount) * 100, 100);
                const dLeft = Math.max(0, Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86400000));
                return (
                  <div key={g.id}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="text-xs font-medium truncate max-w-[130px]" style={{ color: "var(--color-text)" }}>{g.title}</span>
                      <span className="text-[10px] font-bold num" style={{ color: "#34d399" }}>{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--color-hairline)" }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9 }}
                        className="h-full rounded-full" style={{ background: "linear-gradient(90deg,#059669,#10b981)", boxShadow: "0 0 8px rgba(16,185,129,0.4)" }} />
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[9px] num" style={{ color: "var(--color-text-low)" }}>{currency(g.currentAmount)} / {currency(g.targetAmount)}</span>
                      {dLeft > 0 && <span className="text-[9px] flex items-center gap-0.5" style={{ color: "var(--color-text-low)" }}><Clock className="w-2 h-2" />{dLeft}d</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent */}
        <div className={CARD} style={{ background: C, border: B, boxShadow: SH }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold" style={{ color: "var(--color-text)" }}>Recentes</h3>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-low)" }}>Últimas transações</p>
            </div>
            <a href="/app/transactions" style={linkStyle}>Ver todas <ChevronRight className="w-3 h-3" /></a>
          </div>
          <div className="space-y-0.5" data-testid="recent-transactions">
            {data.recent.length === 0 && (
              <div className="flex flex-col items-center py-8 gap-2">
                <Activity className="w-8 h-8 opacity-10" style={{ color: "var(--color-text)" }} />
                <p className="text-xs" style={{ color: "var(--color-text-low)" }}>Nenhuma transação</p>
              </div>
            )}
            {data.recent.map((t, i) => (
              <motion.div key={t.id} initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                className="flex items-center gap-2.5 px-2 py-2 rounded-xl transition-colors cursor-default group"
                style={{ "--hover-bg": "var(--color-hairline)" } as any}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--color-hairline)")}
                onMouseLeave={e => (e.currentTarget.style.background = "")}>
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${t.type === "INCOME" ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
                  {t.type === "INCOME" ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate" style={{ color: "var(--color-text)" }}>{t.title}</div>
                  <div className="text-[10px]" style={{ color: "var(--color-text-low)" }}>{t.category} · {dateBR(t.date)}</div>
                </div>
                <div className={`text-xs font-bold shrink-0 num ${t.type === "INCOME" ? "text-emerald-400" : "text-rose-400"}`}>
                  {t.type === "INCOME" ? "+" : "-"}{currency(t.amount)}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* ── AI INSIGHTS ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {aiInsights && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl p-5" style={{ background: "var(--color-hairline)", border: "1px solid var(--color-hairline-strong)" }}
            data-testid="ai-insights-panel">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)" }}>
                  <Sparkles className="w-4 h-4 text-sky-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: "var(--color-text)" }}>Análise IA · Claude</h3>
                  <p className="text-[10px]" style={{ color: "var(--color-text-low)" }}>Insights personalizados</p>
                </div>
              </div>
              <button onClick={() => setAiInsights(null)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--color-hairline)]" style={{ color: "var(--color-text-low)" }}><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {aiInsights.map((ins, i) => {
                const cfg = insightCfg[ins.type] || insightCfg.info;
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                    className="flex gap-2.5 rounded-xl p-3.5" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                    <cfg.icon className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: cfg.text }} />
                    <div>
                      <div className="text-xs font-bold mb-0.5" style={{ color: cfg.text }}>{ins.title}</div>
                      <div className="text-[11px] leading-relaxed" style={{ color: "var(--color-text-muted)" }}>{ins.message}</div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <QuickAddModal open={quickAddOpen} onClose={() => setQuickAddOpen(false)} onAdded={fetchAll} categories={categories} accounts={accounts} />
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  );
}
