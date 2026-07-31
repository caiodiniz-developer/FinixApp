import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavLink, useNavigate, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, ArrowLeftRight, Target, Shield, LogOut,
  Menu, Sun, Moon, Wallet, User as UserIcon, Crown, Bell,
  CalendarDays, Tag, Plus, TrendingUp, TrendingDown, X,
  BarChart3, Calculator, ChevronDown, ChevronUp, Percent,
  Hash, Repeat, PiggyBank, PanelLeftClose, PanelLeftOpen,
  Landmark, CreditCard as CardIcon, Users,
} from "lucide-react";
import { Logo } from "../components/Logo";
import { useAuth, useAutoRefreshUser } from "../contexts/AuthContext";
import { useUserPhoto } from "../hooks/useUserPhoto";
import { useDashboardTheme } from "../contexts/ThemeContext";
import { api } from "../services/api";
import { currency } from "../utils/format";
import { gsap } from "../lib/gsap";

interface SidebarStats { balance: number; income: number; expense: number; spendPct: number; }
interface GoalItem { id: string; title: string; targetAmount: number; currentAmount: number; deadline: string; }

// ─── SIMULADOR DE PARCELAS ────────────────────────────────────────────────────
function InstallmentCalc() {
  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState("");
  const [parcelas, setParcelas] = useState("12");
  const [taxa, setTaxa] = useState("0");

  const pv = parseFloat(valor) || 0;
  const n = parseInt(parcelas) || 12;
  const i = parseFloat(taxa) / 100;

  let pmt = 0, total = 0, juros = 0;
  if (pv > 0) {
    if (i === 0) { pmt = pv / n; }
    else { pmt = pv * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1); }
    total = pmt * n;
    juros = total - pv;
  }

  return (
    <div className="mx-2 mt-1">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all"
        style={{ color: open ? "#a78bfa" : "var(--color-text-muted)", background: open ? "rgba(124,58,237,0.1)" : "transparent", border: `1px solid ${open ? "rgba(124,58,237,0.25)" : "var(--color-border)"}` }}>
        <span className="flex items-center gap-2"><Calculator className="w-3.5 h-3.5" /> Simulador de parcelas</span>
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {open && (
        <div className="mt-2 rounded-xl p-3 space-y-2.5" style={{ background: "var(--color-surface-strong)", border: "1px solid var(--color-border)" }}>
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--color-text-low)" }}>Valor total (R$)</label>
            <input type="number" min="0" step="0.01" placeholder="0,00" value={valor} onChange={e => setValor(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg text-xs font-semibold outline-none transition-all num"
              style={{ background: "var(--color-hairline)", border: "1px solid var(--color-border)", color: "var(--color-text)" }} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1" style={{ color: "var(--color-text-low)" }}><Hash className="w-2.5 h-2.5" /> Parcelas</label>
              <select value={parcelas} onChange={e => setParcelas(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg text-xs font-semibold outline-none"
                style={{ background: "var(--color-hairline)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}>
                {[1,2,3,4,6,9,12,18,24,36,48].map(v => <option key={v} value={v}>{v}x</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1" style={{ color: "var(--color-text-low)" }}><Percent className="w-2.5 h-2.5" /> Juros/mês</label>
              <select value={taxa} onChange={e => setTaxa(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg text-xs font-semibold outline-none"
                style={{ background: "var(--color-hairline)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}>
                {["0","0.5","1","1.5","2","2.5","3","3.5","4","5"].map(v => <option key={v} value={v}>{v}%</option>)}
              </select>
            </div>
          </div>

          {pv > 0 && (
            <div className="rounded-xl p-3 space-y-1.5" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)" }}>
              <div className="flex justify-between items-center">
                <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Parcela mensal</span>
                <span className="text-sm font-bold text-violet-400 num">{currency(pmt)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Total a pagar</span>
                <span className="text-xs font-semibold num" style={{ color: "var(--color-text)" }}>{currency(total)}</span>
              </div>
              {juros > 0.01 && (
                <div className="flex justify-between items-center pt-1" style={{ borderTop: "1px solid var(--color-hairline)" }}>
                  <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>Juros totais</span>
                  <span className="text-xs font-semibold text-rose-400 num">+{currency(juros)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CONVERSOR DE META ────────────────────────────────────────────────────────
function GoalMiniWidget({ goal }: { goal: GoalItem }) {
  const pct = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
  const remaining = goal.targetAmount - goal.currentAmount;
  const daysLeft = Math.max(0, Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86400000));
  const monthsLeft = daysLeft / 30;
  const perMonth = monthsLeft > 0 ? remaining / monthsLeft : remaining;

  return (
    <div className="mx-2 mt-1 rounded-xl p-3" style={{ background: "var(--color-surface-strong)", border: "1px solid var(--color-border)" }}>
      <div className="flex items-center gap-1.5 mb-2">
        <PiggyBank className="w-3 h-3 text-violet-400" />
        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-low)" }}>Meta mais próxima</span>
      </div>
      <div className="text-xs font-semibold mb-0.5 truncate" style={{ color: "var(--color-text)" }}>{goal.title}</div>
      <div className="text-[10px] mb-2" style={{ color: "var(--color-text-low)" }}>
        {currency(goal.currentAmount)} / {currency(goal.targetAmount)}
      </div>
      <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: "var(--color-border)" }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#7c3aed,#6366f1)" }} />
      </div>
      {remaining > 0 && monthsLeft > 0 && (
        <div className="flex justify-between text-[9px]" style={{ color: "var(--color-text-low)" }}>
          <span>{pct.toFixed(0)}% concluído</span>
          <span className="text-violet-400 font-semibold">{currency(perMonth)}/mês</span>
        </div>
      )}
    </div>
  );
}

// ─── RESUMO RECORRÊNCIAS ──────────────────────────────────────────────────────
function RecurringWidget({ amount, count }: { amount: number; count: number }) {
  if (count === 0) return null;
  return (
    <div className="mx-2 mt-1 rounded-xl px-3 py-2.5 flex items-center justify-between" style={{ background: "var(--color-surface-strong)", border: "1px solid var(--color-border)" }}>
      <div className="flex items-center gap-2">
        <Repeat className="w-3.5 h-3.5 text-amber-400" />
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-low)" }}>Gastos fixos</div>
          <div className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>{count} recorrência{count > 1 ? "s" : ""}</div>
        </div>
      </div>
      <div className="text-xs font-bold text-amber-400 num">{currency(amount)}/mês</div>
    </div>
  );
}

// ─── SLIDING ACTIVE INDICATOR ─────────────────────────────────────────────────
// Animates a background "pill" behind the active nav link with GSAP instead of
// hard-cutting between routes — it measures the active link's box and tweens
// the indicator to match, sliding through the list as the user navigates.
function useActivePill(activePath: string, deps: React.DependencyList) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  useLayoutEffect(() => {
    const container = containerRef.current;
    const pill = pillRef.current;
    const active = itemRefs.current[activePath];
    if (!container || !pill) return;
    if (!active) {
      gsap.to(pill, { opacity: 0, duration: 0.2 });
      return;
    }
    const cRect = container.getBoundingClientRect();
    const aRect = active.getBoundingClientRect();
    const targetY = aRect.top - cRect.top;
    // Snap on first paint (no stale slide-in from y:0), then tween afterwards.
    if (pill.dataset.ready !== "1") {
      gsap.set(pill, { y: targetY, height: aRect.height, opacity: 1 });
      pill.dataset.ready = "1";
    } else {
      gsap.to(pill, { y: targetY, height: aRect.height, opacity: 1, duration: 0.45, ease: "power3.out" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath, ...deps]);

  return { containerRef, pillRef, itemRefs };
}

// ─── MAIN LAYOUT ──────────────────────────────────────────────────────────────
export default function AppLayout() {
  const { theme, toggleTheme } = useDashboardTheme();
  const isDark = theme === "dark";
  const { user, logout } = useAuth();
  useAutoRefreshUser(0);
  const userPhoto = useUserPhoto(user);
  const nav = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("finix_sidebar_collapsed") === "1";
  });
  const [alertCount, setAlertCount] = useState(0);
  const [stats, setStats] = useState<SidebarStats | null>(null);
  const [closestGoal, setClosestGoal] = useState<GoalItem | null>(null);
  const [recurringTotal, setRecurringTotal] = useState(0);
  const [recurringCount, setRecurringCount] = useState(0);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickForm, setQuickForm] = useState({ title: "", amount: "", type: "EXPENSE" as "INCOME" | "EXPENSE", category: "Outros", accountId: "" });
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickAccounts, setQuickAccounts] = useState<{ id: string; name: string }[]>([]);

  const sidebarScopeRef = useRef<HTMLDivElement>(null);
  const { containerRef: navContainerRef, pillRef, itemRefs } = useActivePill(location.pathname, [collapsed, open]);

  React.useEffect(() => {
    if (!user) return;
    api.get("/api/alerts").then(r => setAlertCount(r.data.count || 0)).catch(() => {});
    const t = setInterval(() => api.get("/api/alerts").then(r => setAlertCount(r.data.count || 0)).catch(() => {}), 60000);
    return () => clearInterval(t);
  }, [user]);

  React.useEffect(() => {
    if (!user) return;
    api.get("/api/accounts").then(r => setQuickAccounts(r.data || [])).catch(() => {});
  }, [user]);

  React.useEffect(() => {
    if (!user) return;
    api.get("/api/dashboard").then(r => {
      const d = r.data;
      const cur = d.monthly?.[d.monthly.length - 1] || { income: 0, expense: 0 };
      const spendPct = cur.income > 0 ? Math.min((cur.expense / cur.income) * 100, 100) : 0;
      setStats({ balance: d.balance, income: cur.income, expense: cur.expense, spendPct });
    }).catch(() => {});

    api.get("/api/goals").then(r => {
      const goals: GoalItem[] = r.data || [];
      const active = goals.filter(g => g.currentAmount < g.targetAmount && new Date(g.deadline) > new Date());
      if (active.length > 0) {
        const sorted = [...active].sort((a, b) => (b.currentAmount / b.targetAmount) - (a.currentAmount / a.targetAmount));
        setClosestGoal(sorted[0]);
      }
    }).catch(() => {});

    api.get("/api/transactions?recurring=true&limit=100").then(r => {
      const txs: any[] = r.data?.data || r.data || [];
      const recurring = txs.filter(t => t.recurring && t.type === "EXPENSE");
      setRecurringCount(recurring.length);
      setRecurringTotal(recurring.reduce((s: number, t: any) => s + t.amount, 0));
    }).catch(() => {});
  }, [user]);

  React.useEffect(() => {
    if (location.pathname === "/app/alerts") {
      api.post("/api/alerts/read").catch(() => {});
      setAlertCount(0);
    }
  }, [location.pathname]);

  React.useEffect(() => {
    if (user?.plan === "PRO" && user.primaryColor) {
      document.documentElement.style.setProperty("--brand-primary", user.primaryColor);
    }
  }, [user]);

  React.useEffect(() => {
    if (user && user.role !== "ADMIN" && user.plan === "PRO" && !user.hasCompletedOnboarding) {
      nav("/onboarding", { replace: true });
    }
  }, [user?.plan, user?.hasCompletedOnboarding, user?.role, nav]);

  // Entrance choreography: logo, balance widget and nav groups stagger in on
  // first mount. Runs once — route changes don't replay it.
  useEffect(() => {
    if (!sidebarScopeRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from("[data-reveal='logo']", { opacity: 0, x: -12, duration: 0.5 })
        .from("[data-reveal='balance']", { opacity: 0, y: 10, duration: 0.5 }, "-=0.25")
        .from("[data-reveal='quickadd']", { opacity: 0, y: 8, duration: 0.4 }, "-=0.3")
        .from("[data-reveal='navgroup']", { opacity: 0, x: -8, duration: 0.35, stagger: 0.06 }, "-=0.2")
        .from("[data-reveal='tools']", { opacity: 0, y: 8, duration: 0.4 }, "-=0.15");
    }, sidebarScopeRef);
    return () => ctx.revert();
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(c => {
      const next = !c;
      window.localStorage.setItem("finix_sidebar_collapsed", next ? "1" : "0");
      return next;
    });
  };

  if (!user) return null;

  const refreshStats = () => {
    api.get("/api/dashboard").then(r => {
      const d = r.data;
      const cur = d.monthly?.[d.monthly.length - 1] || { income: 0, expense: 0 };
      setStats({ balance: d.balance, income: cur.income, expense: cur.expense, spendPct: cur.income > 0 ? Math.min((cur.expense / cur.income) * 100, 100) : 0 });
    }).catch(() => {});
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickForm.title || !quickForm.amount) return;
    setQuickLoading(true);
    try {
      await api.post("/api/transactions", {
        ...quickForm, amount: parseFloat(quickForm.amount),
        accountId: quickForm.accountId || null,
        paymentMethod: "pix", installments: 1,
        date: new Date().toISOString().split("T")[0],
      });
      setQuickAddOpen(false);
      setQuickForm({ title: "", amount: "", type: "EXPENSE", category: "Outros", accountId: "" });
      refreshStats();
    } catch { }
    finally { setQuickLoading(false); }
  };

  const navGroups = [
    {
      label: "Principal",
      items: [{ to: "/app/dashboard", icon: LayoutDashboard, label: "Dashboard", testid: "nav-dashboard" }],
    },
    {
      label: "Finanças",
      items: [
        { to: "/app/transactions", icon: ArrowLeftRight, label: "Transações", testid: "nav-transactions" },
        { to: "/app/recurring", icon: Repeat, label: "Recorrências", testid: "nav-recurring" },
        { to: "/app/accounts", icon: Landmark, label: "Contas", testid: "nav-accounts" },
        { to: "/app/cards", icon: CardIcon, label: "Cartões", testid: "nav-cards" },
        { to: "/app/budgets", icon: Wallet, label: "Orçamentos", testid: "nav-budgets" },
        { to: "/app/goals", icon: Target, label: "Metas", testid: "nav-goals" },
        { to: "/app/contacts", icon: Users, label: "Contatos", testid: "nav-contacts" },
        { to: "/app/calendar", icon: CalendarDays, label: "Calendário", testid: "nav-calendar" },
        { to: "/app/alerts", icon: Bell, label: "Alertas", testid: "nav-alerts", badge: alertCount },
      ],
    },
    {
      label: "Gestão",
      items: [
        { to: "/app/categories", icon: Tag, label: "Categorias", testid: "nav-categories" },
        { to: "/app/plans", icon: Crown, label: "Planos", testid: "nav-plans" },
      ],
    },
    {
      label: "Conta",
      items: [
        { to: "/app/profile", icon: UserIcon, label: "Perfil", testid: "nav-profile" },
        ...(user.role === "ADMIN" ? [{ to: "/app/admin", icon: Shield, label: "Admin", testid: "nav-admin" }] : []),
      ],
    },
  ];

  const sidebarWidth = collapsed ? "w-[76px]" : "w-64";

  const Sidebar = (
    <aside ref={sidebarScopeRef} className={`${sidebarWidth} shrink-0 h-full flex flex-col relative transition-[width] duration-300 ease-out`}
      style={{ background: "var(--color-surface)", borderRight: "1px solid var(--color-border)" }}>

      {/* Collapse toggle (desktop only) */}
      <button
        onClick={toggleCollapsed}
        title={collapsed ? "Expandir menu" : "Recolher menu"}
        className="hidden lg:flex absolute -right-3 top-7 z-10 w-6 h-6 rounded-full items-center justify-center transition-transform hover:scale-110 active:scale-95"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)", boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>
        {collapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
      </button>

      {/* Logo */}
      <div data-reveal="logo" className="px-5 pt-5 pb-4 overflow-hidden" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex items-center gap-3">
          <Logo src={user.plan === "PRO" ? (userPhoto.companyLogo ?? undefined) : undefined} altText={user.plan === "PRO" ? user.companyName || "Logo" : undefined} showText={false} size={34} />
          {!collapsed && (user.plan === "PRO" && user.companyName ? (
            <span className="text-sm font-bold truncate" style={{ color: "var(--color-text)" }}>{user.companyName}</span>
          ) : (
            <span className="font-display font-extrabold text-[1.15rem] tracking-tight whitespace-nowrap">
              <span style={{ color: "var(--color-text)" }}>FINI</span>
              <span className="bg-gradient-to-r from-brand-blue to-brand-purple bg-clip-text text-transparent">X</span>
            </span>
          ))}
        </div>
      </div>

      {/* Balance widget */}
      {stats && !collapsed && (
        <div data-reveal="balance" className="mx-3 mt-3 rounded-2xl p-3.5 relative overflow-hidden" style={{ background: "linear-gradient(135deg,rgba(124,58,237,0.12),rgba(99,102,241,0.08))", border: "1px solid rgba(124,58,237,0.2)" }}>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(196,181,253,0.7)" }}>Saldo total</span>
            <BarChart3 className="w-3 h-3 text-violet-400 opacity-60" />
          </div>
          <div className={`text-xl font-black leading-none mb-3 num tracking-tight ${stats.balance >= 0 ? "text-white" : "text-rose-400"}`}>
            {currency(stats.balance)}
          </div>
          <div className="flex gap-3 mb-2.5">
            <div className="flex-1 rounded-lg px-2 py-1.5" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}>
              <div className="flex items-center gap-1 mb-0.5"><TrendingUp className="w-2.5 h-2.5 text-emerald-400" /><span className="text-[8px] font-bold uppercase text-emerald-400/70">Receita</span></div>
              <div className="text-[11px] font-bold text-emerald-400 num">{currency(stats.income)}</div>
            </div>
            <div className="flex-1 rounded-lg px-2 py-1.5" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
              <div className="flex items-center gap-1 mb-0.5"><TrendingDown className="w-2.5 h-2.5 text-rose-400" /><span className="text-[8px] font-bold uppercase text-rose-400/70">Gasto</span></div>
              <div className="text-[11px] font-bold text-rose-400 num">{currency(stats.expense)}</div>
            </div>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden mb-1" style={{ background: "var(--color-hairline-strong)" }}>
            <div className="h-full rounded-full transition-all duration-1000 relative"
              style={{ width: `${stats.spendPct}%`, background: stats.spendPct > 85 ? "linear-gradient(90deg,#f59e0b,#ef4444)" : stats.spendPct > 60 ? "linear-gradient(90deg,#22c55e,#f59e0b)" : "linear-gradient(90deg,#6366f1,#22c55e)" }}>
            </div>
          </div>
          <div className="flex justify-between text-[9px]" style={{ color: "rgba(196,181,253,0.5)" }}>
            <span>comprometido</span><span className="font-semibold">{stats.spendPct.toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* Quick add */}
      <div data-reveal="quickadd" className="px-3 mt-2.5">
        <button onClick={() => setQuickAddOpen(true)} title="Nova transação"
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg,#7c3aed,#6366f1)", boxShadow: "0 4px 16px rgba(124,58,237,0.35)" }}>
          <Plus className="w-3.5 h-3.5 shrink-0" /> {!collapsed && "Nova transação"}
        </button>
      </div>

      {/* Navigation groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 scrollbar-hide">
        <div ref={navContainerRef} className="relative">
          <div ref={pillRef} data-ready="0"
            className="absolute inset-x-0 rounded-xl pointer-events-none opacity-0"
            style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", top: 0, left: 8, right: 8, willChange: "transform,height" }} />

          {navGroups.map((group, gi) => (
            <div key={group.label} data-reveal="navgroup" className={gi > 0 ? "mt-4" : ""}>
              {!collapsed && (
                <div className="px-2 mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--color-text-low)" }}>
                  {group.label}
                </div>
              )}
              {group.items.map((l) => (
                <NavLink key={l.to} to={l.to} data-testid={(l as any).testid}
                  ref={(el) => { itemRefs.current[l.to] = el; }}
                  onClick={() => setOpen(false)}
                  title={collapsed ? l.label : undefined}
                  className={`relative z-[1] flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors mb-0.5`}
                  style={({ isActive }) => isActive
                    ? { color: "#c4b5fd" }
                    : { color: "var(--color-text-muted)" }
                  }>
                  <div className={`flex items-center gap-2.5 ${collapsed ? "" : "min-w-0"}`}>
                    <l.icon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span className="truncate">{l.label}</span>}
                  </div>
                  {(l as any).badge ? (
                    <span className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white ${collapsed ? "absolute -top-1 -right-1" : ""}`}>
                      {(l as any).badge}
                    </span>
                  ) : null}
                </NavLink>
              ))}
            </div>
          ))}

          {/* Financial tools section */}
          {!collapsed && (
            <div data-reveal="navgroup" className="mt-4">
              <div className="px-2 mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--color-text-low)" }}>
                Ferramentas
              </div>
              <InstallmentCalc />
              {closestGoal && <GoalMiniWidget goal={closestGoal} />}
              <RecurringWidget amount={recurringTotal} count={recurringCount} />
            </div>
          )}
        </div>
      </nav>

      {/* User + controls */}
      <div data-reveal="tools" className="p-3 space-y-2" style={{ borderTop: "1px solid var(--color-border)" }}>
        <div className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors ${collapsed ? "justify-center" : ""}`} style={{ background: "var(--color-surface-strong)" }}>
          {userPhoto.photo ? (
            <img src={userPhoto.photo} alt={user.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-black"
              style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold truncate" style={{ color: "var(--color-text)" }}>{user.name}</div>
                <div className="text-[10px] truncate" style={{ color: "var(--color-text-low)" }}>{user.email}</div>
              </div>
              {user.plan && (
                <span data-testid="plan-badge"
                  className={`shrink-0 text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider ${user.plan === "PRO" ? "text-violet-300" : user.plan === "BASIC" ? "text-blue-300" : "text-zinc-500"}`}
                  style={{ background: user.plan === "PRO" ? "rgba(124,58,237,0.18)" : user.plan === "BASIC" ? "rgba(37,99,235,0.18)" : "var(--color-hairline)", border: "1px solid var(--color-hairline-strong)" }}>
                  {user.plan}
                </span>
              )}
            </>
          )}
        </div>

        <div className={`flex gap-1.5 ${collapsed ? "flex-col" : ""}`}>
          {alertCount > 0 && (
            <button onClick={() => nav("/app/alerts")} title="Alertas"
              className="relative p-2 rounded-lg transition-colors hover:bg-rose-500/10"
              style={{ color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}>
              <Bell className="w-3.5 h-3.5" />
              <span className="absolute -top-1.5 -right-1.5 h-4 min-w-[1rem] flex items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white px-1">{alertCount}</span>
            </button>
          )}
          <button data-testid="theme-toggle" onClick={toggleTheme} title="Tema"
            className="p-2 rounded-lg transition-colors hover:bg-[var(--color-hairline)]"
            style={{ color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}>
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          <button data-testid="logout-btn" onClick={logout} title="Sair"
            className={`${collapsed ? "" : "flex-1"} flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-rose-400 transition-colors hover:bg-rose-500/8`}
            style={{ border: "1px solid var(--color-border)" }}>
            <LogOut className="w-3.5 h-3.5" /> {!collapsed && "Sair"}
          </button>
        </div>
      </div>

      {/* Quick Add Modal */}
      {quickAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)" }}
          onClick={() => setQuickAddOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
            style={{ background: "var(--color-surface)", border: "1px solid rgba(124,58,237,0.25)", boxShadow: "0 0 0 1px rgba(124,58,237,0.08), 0 32px 64px rgba(0,0,0,0.6)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-base" style={{ color: "var(--color-text)" }}>Nova transação</h3>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-low)" }}>Registro rápido</p>
              </div>
              <button onClick={() => setQuickAddOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--color-hairline)]"
                style={{ color: "var(--color-text-low)" }}><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleQuickAdd} className="space-y-3">
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl" style={{ background: "var(--color-surface-strong)" }}>
                {(["EXPENSE", "INCOME"] as const).map(t => (
                  <button key={t} type="button" onClick={() => setQuickForm({ ...quickForm, type: t })}
                    className={`py-2.5 rounded-lg text-xs font-bold transition-all ${quickForm.type === t ? t === "EXPENSE" ? "bg-rose-500 text-white shadow-lg" : "bg-emerald-500 text-white shadow-lg" : "opacity-40"}`}
                    style={{ color: quickForm.type === t ? undefined : "var(--color-text-muted)" }}>
                    {t === "EXPENSE" ? "↓ Despesa" : "↑ Receita"}
                  </button>
                ))}
              </div>
              <input className="input w-full" placeholder="Descrição..." value={quickForm.title} onChange={e => setQuickForm({ ...quickForm, title: e.target.value })} required />
              <input type="number" step="0.01" min="0.01" className="input w-full num" placeholder="Valor em R$" value={quickForm.amount} onChange={e => setQuickForm({ ...quickForm, amount: e.target.value })} required />
              {quickAccounts.length > 0 && (
                <select className="input w-full" value={quickForm.accountId} onChange={e => setQuickForm({ ...quickForm, accountId: e.target.value })}>
                  <option value="">Sem conta</option>
                  {quickAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
              <button type="submit" disabled={quickLoading}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg,#7c3aed,#6366f1)", boxShadow: "0 4px 16px rgba(124,58,237,0.3)" }}>
                {quickLoading ? "Salvando..." : "Salvar transação"}
              </button>
            </form>
          </div>
        </div>
      )}
    </aside>
  );

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:block sticky top-0 h-screen">{Sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/70" style={{ backdropFilter: "blur(4px)" }} onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 h-full">{Sidebar}</div>
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden sticky top-0 z-30 backdrop-blur px-4 py-3 flex items-center justify-between"
          style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}>
          <button data-testid="open-sidebar" onClick={() => setOpen(true)} className="p-2 rounded-lg" style={{ color: "var(--color-text-muted)" }}>
            <Menu className="w-5 h-5" />
          </button>
          <Logo size={28} />
          <div className="w-10" />
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
