import React, { useState } from "react";
import { NavLink, useNavigate, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, ArrowLeftRight, Target, Shield, LogOut,
  Menu, Sun, Moon, Wallet, User as UserIcon, Crown, Bell,
  CalendarDays, Tag, Plus, TrendingUp, TrendingDown, X,
  BarChart3,
} from "lucide-react";
import { Logo } from "../components/Logo";
import { useAuth, useAutoRefreshUser } from "../contexts/AuthContext";
import { useDashboardTheme } from "../contexts/ThemeContext";
import { api } from "../services/api";
import { currency } from "../utils/format";

interface SidebarStats {
  balance: number;
  income: number;
  expense: number;
  spendPct: number;
}

export default function AppLayout() {
  const { theme, toggleTheme } = useDashboardTheme();
  const isDark = theme === "dark";
  const { user, logout } = useAuth();
  useAutoRefreshUser(0);
  const nav = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [stats, setStats] = useState<SidebarStats | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickForm, setQuickForm] = useState({ title: "", amount: "", type: "EXPENSE" as "INCOME" | "EXPENSE" });
  const [quickLoading, setQuickLoading] = useState(false);

  React.useEffect(() => {
    if (!user) return;
    api.get("/api/alerts").then(r => setAlertCount(r.data.count || 0)).catch(() => {});
    const t = setInterval(() => api.get("/api/alerts").then(r => setAlertCount(r.data.count || 0)).catch(() => {}), 60000);
    return () => clearInterval(t);
  }, [user]);

  React.useEffect(() => {
    if (!user) return;
    api.get("/api/dashboard").then(r => {
      const d = r.data;
      const cur = d.monthly?.[d.monthly.length - 1] || { income: 0, expense: 0 };
      const spendPct = cur.income > 0 ? Math.min((cur.expense / cur.income) * 100, 100) : 0;
      setStats({ balance: d.balance, income: cur.income, expense: cur.expense, spendPct });
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

  if (!user) return null;

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickForm.title || !quickForm.amount) return;
    setQuickLoading(true);
    try {
      await api.post("/api/transactions", {
        ...quickForm, amount: parseFloat(quickForm.amount),
        category: "Outros", paymentMethod: "pix", installments: 1,
        date: new Date().toISOString().split("T")[0],
      });
      setQuickAddOpen(false);
      setQuickForm({ title: "", amount: "", type: "EXPENSE" });
      api.get("/api/dashboard").then(r => {
        const d = r.data;
        const cur = d.monthly?.[d.monthly.length - 1] || { income: 0, expense: 0 };
        setStats({ balance: d.balance, income: cur.income, expense: cur.expense, spendPct: cur.income > 0 ? Math.min((cur.expense / cur.income) * 100, 100) : 0 });
      }).catch(() => {});
    } catch { }
    finally { setQuickLoading(false); }
  };

  const navGroups = [
    {
      label: "Principal",
      items: [
        { to: "/app/dashboard", icon: LayoutDashboard, label: "Dashboard", testid: "nav-dashboard" },
      ],
    },
    {
      label: "Finanças",
      items: [
        { to: "/app/transactions", icon: ArrowLeftRight, label: "Transações", testid: "nav-transactions" },
        { to: "/app/budgets", icon: Wallet, label: "Orçamentos", testid: "nav-budgets" },
        { to: "/app/goals", icon: Target, label: "Metas", testid: "nav-goals" },
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

  const Sidebar = (
    <aside className="w-64 shrink-0 h-full flex flex-col" style={{ background: "var(--color-surface)", borderRight: "1px solid var(--color-border)" }}>

      {/* Logo */}
      <div className="px-4 pt-5 pb-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="flex items-center gap-3">
          <Logo src={user.plan === "PRO" ? user.companyLogo : undefined} altText={user.plan === "PRO" ? user.companyName || "Logo" : undefined} showText={user.plan !== "PRO"} size={36} />
          {user.plan === "PRO" && user.companyName && (
            <span className="text-sm font-bold truncate">{user.companyName}</span>
          )}
        </div>
      </div>

      {/* Balance widget */}
      {stats && (
        <div className="mx-3 mt-3 rounded-xl p-3" style={{ background: "var(--color-surface-strong)", border: "1px solid var(--color-border)" }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Saldo total</span>
            <BarChart3 className="w-3 h-3" style={{ color: "var(--color-text-low)" }} />
          </div>
          <div className={`text-lg font-bold leading-none mb-2 ${stats.balance >= 0 ? "text-white" : "text-rose-400"}`}>
            {currency(stats.balance)}
          </div>
          <div className="flex gap-3 text-[10px] mb-2">
            <span className="flex items-center gap-1 text-emerald-400"><TrendingUp className="w-2.5 h-2.5" />{currency(stats.income)}</span>
            <span className="flex items-center gap-1 text-rose-400"><TrendingDown className="w-2.5 h-2.5" />{currency(stats.expense)}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-border)" }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${stats.spendPct}%`, background: stats.spendPct > 85 ? "#ef4444" : stats.spendPct > 60 ? "#f59e0b" : "#22c55e" }} />
          </div>
          <div className="flex justify-between mt-1 text-[9px]" style={{ color: "var(--color-text-low)" }}>
            <span>Gastos do mês</span>
            <span>{stats.spendPct.toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* Quick add button */}
      <div className="px-3 mt-3">
        <button onClick={() => setQuickAddOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
          <Plus className="w-3.5 h-3.5" /> Nova transação
        </button>
      </div>

      {/* Navigation groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4 scrollbar-hide">
        {navGroups.map(group => (
          <div key={group.label}>
            <div className="px-2 mb-1.5 text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-low)" }}>
              {group.label}
            </div>
            {group.items.map((l) => (
              <NavLink key={l.to} to={l.to} data-testid={(l as any).testid}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all mb-0.5 ${
                    isActive
                      ? "text-white"
                      : "hover:text-text"
                  }`
                }
                style={({ isActive }) => isActive
                  ? { background: "rgba(124,58,237,0.18)", color: "#c4b5fd", borderLeft: "2px solid #7c3aed" }
                  : { color: "var(--color-text-muted)" }
                }>
                <div className="flex items-center gap-2.5">
                  <l.icon className="w-4 h-4 shrink-0" />
                  <span>{l.label}</span>
                </div>
                {(l as any).badge ? (
                  <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    {(l as any).badge}
                  </span>
                ) : null}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User + Controls */}
      <div className="p-3 space-y-2" style={{ borderTop: "1px solid var(--color-border)" }}>
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl" style={{ background: "var(--color-surface-strong)" }}>
          {user.photo ? (
            <img src={user.photo} alt={user.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold"
              style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold truncate" style={{ color: "var(--color-text)" }}>{user.name}</div>
            <div className="text-[10px] truncate" style={{ color: "var(--color-text-low)" }}>{user.email}</div>
          </div>
          {user.plan && (
            <span data-testid="plan-badge"
              className={`shrink-0 inline-flex items-center text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                user.plan === "PRO" ? "bg-violet-500/20 text-violet-300" : user.plan === "BASIC" ? "bg-blue-500/20 text-blue-300" : "text-zinc-400"
              }`} style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
              {user.plan}
            </span>
          )}
        </div>

        <div className="flex gap-1.5">
          {alertCount > 0 && (
            <button onClick={() => nav("/app/alerts")} title="Alertas"
              className="relative p-2 rounded-lg transition-colors hover:bg-rose-500/10"
              style={{ color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}>
              <Bell className="w-3.5 h-3.5" />
              <span className="absolute -top-1.5 -right-1.5 h-4 min-w-[1rem] flex items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white px-1">{alertCount}</span>
            </button>
          )}
          <button data-testid="theme-toggle" onClick={toggleTheme} title="Tema"
            className="p-2 rounded-lg transition-colors"
            style={{ color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}>
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          <button data-testid="logout-btn" onClick={logout}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-rose-400 transition-colors hover:bg-rose-500/10"
            style={{ border: "1px solid var(--color-border)" }}>
            <LogOut className="w-3.5 h-3.5" /> Sair
          </button>
        </div>
      </div>

      {/* Quick add modal (inline in sidebar) */}
      {quickAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
          onClick={() => setQuickAddOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl p-5 shadow-2xl" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">Nova transação</h3>
              <button onClick={() => setQuickAddOpen(false)} className="p-1 rounded-lg opacity-60 hover:opacity-100" style={{ color: "var(--color-text-muted)" }}><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleQuickAdd} className="space-y-3">
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl" style={{ background: "var(--color-surface-strong)" }}>
                {(["EXPENSE", "INCOME"] as const).map(t => (
                  <button key={t} type="button" onClick={() => setQuickForm({ ...quickForm, type: t })}
                    className={`py-2 rounded-lg text-xs font-bold transition-all ${quickForm.type === t ? t === "EXPENSE" ? "bg-rose-500 text-white" : "bg-emerald-500 text-white" : "text-muted"}`}>
                    {t === "EXPENSE" ? "↓ Despesa" : "↑ Receita"}
                  </button>
                ))}
              </div>
              <input className="input text-sm" placeholder="Descrição..." value={quickForm.title} onChange={e => setQuickForm({ ...quickForm, title: e.target.value })} required />
              <input type="number" step="0.01" min="0.01" className="input text-sm" placeholder="Valor R$" value={quickForm.amount} onChange={e => setQuickForm({ ...quickForm, amount: e.target.value })} required />
              <button type="submit" disabled={quickLoading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
                {quickLoading ? "Salvando..." : "Salvar"}
              </button>
            </form>
          </div>
        </div>
      )}
    </aside>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:block sticky top-0 h-screen">{Sidebar}</div>

      {/* Mobile sidebar */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 h-full">{Sidebar}</div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile topbar */}
        <header className="lg:hidden sticky top-0 z-30 backdrop-blur px-4 py-3 flex items-center justify-between"
          style={{ background: "rgba(9,9,11,0.8)", borderBottom: "1px solid var(--color-border)" }}>
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
