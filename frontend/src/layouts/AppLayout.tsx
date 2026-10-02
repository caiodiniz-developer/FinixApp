import toast from "react-hot-toast";
import React, { useState } from "react";
import { NavLink, useNavigate, Outlet, useLocation } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import {
  LayoutDashboard, ArrowLeftRight, Target, Shield, LogOut,
  Menu, Sun, Moon, Wallet, Crown, Bell,
  CalendarDays, Tag, Plus, X, ChevronDown, MoreHorizontal,
  PanelLeftClose, PanelLeftOpen,
  Landmark, CreditCard as CardIcon, Users, Ghost, Trophy,
  Wallet2, Sparkles, Heart, Repeat, Scale,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "../components/Logo";
import { useAuth, useAutoRefreshUser } from "../contexts/AuthContext";
import { useUserPhoto } from "../hooks/useUserPhoto";
import { useDashboardTheme } from "../contexts/ThemeContext";
import { api, apiErrorMessage } from "../services/api";
import { todayISO } from "../utils/format";

interface NavItem { to: string; icon: LucideIcon; label: string; testid: string; badge?: number; }

const MORE_OPEN_KEY = "finix_sidebar_more_open";

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
  const [moreOpen, setMoreOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(MORE_OPEN_KEY) === "1";
  });
  const [alertCount, setAlertCount] = useState(0);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickForm, setQuickForm] = useState({ title: "", amount: "", type: "EXPENSE" as "INCOME" | "EXPENSE", category: "Outros", accountId: "" });
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickAccounts, setQuickAccounts] = useState<{ id: string; name: string }[]>([]);

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
    // The Alerts page itself marks notices as read once it has shown them.
    if (location.pathname === "/app/alerts") setAlertCount(0);
  }, [location.pathname]);

  React.useEffect(() => {
    if (user && user.role !== "ADMIN" && user.plan === "PRO" && !user.hasCompletedOnboarding) {
      nav("/onboarding", { replace: true });
    }
  }, [user, nav]);

  const toggleCollapsed = () => {
    setCollapsed(c => {
      const next = !c;
      window.localStorage.setItem("finix_sidebar_collapsed", next ? "1" : "0");
      return next;
    });
  };

  const toggleMore = () => {
    setMoreOpen(o => {
      const next = !o;
      window.localStorage.setItem(MORE_OPEN_KEY, next ? "1" : "0");
      return next;
    });
  };

  if (!user) return null;

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickForm.title || !quickForm.amount) return;
    setQuickLoading(true);
    try {
      await api.post("/api/transactions", {
        ...quickForm, amount: parseFloat(quickForm.amount),
        accountId: quickForm.accountId || null,
        paymentMethod: "pix", installments: 1,
        date: todayISO(),
      });
      setQuickAddOpen(false);
      setQuickForm({ title: "", amount: "", type: "EXPENSE", category: "Outros", accountId: "" });
      // Screens showing balances listen for this to reload.
      window.dispatchEvent(new Event("finix-transaction-created"));
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
    finally { setQuickLoading(false); }
  };

  // The eight screens people open every day stay visible; everything else
  // lives under "Mais" so the menu doesn't read as a wall of links.
  const mainItems: NavItem[] = [
    { to: "/app/dashboard", icon: LayoutDashboard, label: "Dashboard", testid: "nav-dashboard" },
    { to: "/app/transactions", icon: ArrowLeftRight, label: "Transações", testid: "nav-transactions" },
    { to: "/app/accounts", icon: Landmark, label: "Contas", testid: "nav-accounts" },
    { to: "/app/cards", icon: CardIcon, label: "Cartões", testid: "nav-cards" },
    { to: "/app/budgets", icon: Wallet, label: "Orçamentos", testid: "nav-budgets" },
    { to: "/app/goals", icon: Target, label: "Metas", testid: "nav-goals" },
    { to: "/app/calendar", icon: CalendarDays, label: "Calendário", testid: "nav-calendar" },
    { to: "/app/alerts", icon: Bell, label: "Alertas", testid: "nav-alerts", badge: alertCount },
  ];

  const moreItems: NavItem[] = [
    { to: "/app/recurring", icon: Repeat, label: "Recorrências", testid: "nav-recurring" },
    { to: "/app/contacts", icon: Users, label: "Contatos", testid: "nav-contacts" },
    { to: "/app/net-worth", icon: Wallet2, label: "Patrimônio", testid: "nav-networth" },
    { to: "/app/debts", icon: Scale, label: "Dívidas", testid: "nav-debts" },
    { to: "/app/subscriptions", icon: Ghost, label: "Assinaturas", testid: "nav-subscriptions" },
    { to: "/app/challenges", icon: Trophy, label: "Desafios", testid: "nav-challenges" },
    { to: "/app/household", icon: Heart, label: "Casal/Família", testid: "nav-household" },
    { to: "/app/year-review", icon: Sparkles, label: "Resumo do ano", testid: "nav-year-review" },
    { to: "/app/categories", icon: Tag, label: "Categorias", testid: "nav-categories" },
    { to: "/app/plans", icon: Crown, label: "Planos", testid: "nav-plans" },
    ...(user.role === "ADMIN" ? [{ to: "/app/admin", icon: Shield, label: "Admin", testid: "nav-admin" }] : []),
  ];

  // Never hide the page the user is currently on.
  const inMore = moreItems.some((i) => location.pathname.startsWith(i.to));
  const showMore = moreOpen || inMore;

  const renderItem = (l: NavItem) => (
    <NavLink key={l.to} to={l.to} data-testid={l.testid}
      onClick={() => setOpen(false)}
      title={collapsed ? l.label : undefined}
      className={({ isActive }) =>
        `relative flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-2.5 px-3 py-2 rounded-control text-sm font-medium transition-colors duration-150 mb-0.5 ${
          isActive ? "" : "hover:bg-[var(--color-card-hover)]"
        }`
      }
      style={({ isActive }) => isActive
        ? { color: "var(--color-primary)", background: "var(--color-primary-soft)" }
        : { color: "var(--color-text-muted)" }
      }>
      <div className={`flex items-center gap-2.5 ${collapsed ? "" : "min-w-0"}`}>
        <l.icon className="w-4 h-4 shrink-0" />
        {!collapsed && <span className="truncate">{l.label}</span>}
      </div>
      {l.badge ? (
        <span className={`inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-2xs font-semibold text-white ${collapsed ? "absolute -top-1 -right-1" : ""}`}
          style={{ background: "var(--color-expense)" }}>
          {l.badge}
        </span>
      ) : null}
    </NavLink>
  );

  const bottomItems: NavItem[] = [mainItems[0], mainItems[1], mainItems[4]];

  const renderTab = (l: NavItem) => (
    <NavLink key={l.to} to={l.to} data-testid={`tab-${l.testid}`}
      className="flex flex-col items-center gap-0.5 py-1 text-2xs font-medium"
      style={({ isActive }) => ({ color: isActive ? "var(--color-primary)" : "var(--color-text-low)" })}>
      <l.icon className="w-5 h-5" />
      {l.label === "Dashboard" ? "Início" : l.label}
    </NavLink>
  );

  const sidebarWidth = collapsed ? "w-[76px]" : "w-64";
  const iconButton = "p-2 rounded-control transition-colors hover:bg-[var(--color-card-hover)]";

  const Sidebar = (
    <aside className={`${sidebarWidth} glass shrink-0 h-full flex flex-col relative transition-[width] duration-200 ease-out`}
      style={{ borderWidth: 0, borderRightWidth: 1, borderColor: "var(--color-border)", boxShadow: "none" }}>

      {/* Collapse toggle (desktop only) */}
      <button
        onClick={toggleCollapsed}
        title={collapsed ? "Expandir menu" : "Recolher menu"}
        className="hidden lg:flex absolute -right-3 top-7 z-10 w-6 h-6 rounded-full items-center justify-center"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
        {collapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
      </button>

      {/* Logo */}
      <div className="px-5 pt-5 pb-4 overflow-hidden">
        <div className="flex items-center gap-3">
          <Logo src={user.plan === "PRO" ? (userPhoto.companyLogo ?? undefined) : undefined} altText={user.plan === "PRO" ? user.companyName || "Logo" : undefined} showText={false} size={34} />
          {!collapsed && (user.plan === "PRO" && user.companyName ? (
            <span className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>{user.companyName}</span>
          ) : (
            <span className="font-display font-bold text-[1.05rem] tracking-[0.06em] whitespace-nowrap">
              <span style={{ color: "var(--color-text)" }}>FINI</span>
              <span style={{ color: "var(--color-primary)" }}>X</span>
            </span>
          ))}
        </div>
      </div>

      {/* Quick add */}
      <div className="px-3">
        <button onClick={() => setQuickAddOpen(true)} title="Nova transação"
          className="btn-primary w-full !py-2.5 text-sm">
          <Plus className="w-4 h-4 shrink-0" /> {!collapsed && "Nova transação"}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 scrollbar-hide">
        {mainItems.map(renderItem)}

        <button
          type="button"
          onClick={toggleMore}
          data-testid="nav-more"
          title={collapsed ? "Mais" : undefined}
          aria-expanded={showMore}
          className={`w-full flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-2.5 px-3 py-2 mt-3 rounded-control text-sm font-medium transition-colors duration-150 hover:bg-[var(--color-card-hover)]`}
          style={{ color: "var(--color-text-low)" }}>
          <div className="flex items-center gap-2.5">
            <MoreHorizontal className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Mais</span>}
          </div>
          {!collapsed && <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${showMore ? "rotate-180" : ""}`} />}
        </button>
        {showMore && <div className="mt-0.5">{moreItems.map(renderItem)}</div>}
      </nav>

      {/* User + controls */}
      <div className="p-3 space-y-2" style={{ borderTop: "1px solid var(--color-border)" }}>
        <NavLink to="/app/profile" data-testid="nav-profile" onClick={() => setOpen(false)} title="Perfil"
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-control transition-colors hover:bg-[var(--color-card-hover)] ${collapsed ? "justify-center" : ""}`}>
          {userPhoto.photo ? (
            <img src={userPhoto.photo} alt={user.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold"
              style={{ background: "var(--color-primary)", color: "var(--color-on-primary)" }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold truncate" style={{ color: "var(--color-text)" }}>{user.name}</div>
                <div className="text-2xs truncate" style={{ color: "var(--color-text-low)" }}>{user.email}</div>
              </div>
              {user.plan && (
                <span data-testid="plan-badge"
                  className="shrink-0 text-2xs px-1.5 py-0.5 rounded-md font-semibold"
                  style={user.plan === "FREE" && !user.trialEndsAt
                    ? { background: "var(--color-hairline)", color: "var(--color-text-low)" }
                    : { background: "var(--color-primary-soft)", color: "var(--color-primary)" }}>
                  {user.trialEndsAt ? "TRIAL" : user.plan}
                </span>
              )}
            </>
          )}
        </NavLink>

        <div className={`flex gap-1.5 ${collapsed ? "flex-col items-center" : ""}`}>
          <button data-testid="theme-toggle" onClick={toggleTheme} title={isDark ? "Tema claro" : "Tema escuro"}
            className={iconButton}
            style={{ color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }}>
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button data-testid="logout-btn" onClick={logout} title="Sair"
            className={`${collapsed ? "" : "flex-1"} flex items-center justify-center gap-1.5 py-2 px-2 rounded-control text-xs font-medium transition-colors hover:bg-[var(--color-card-hover)]`}
            style={{ border: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
            <LogOut className="w-4 h-4" /> {!collapsed && "Sair"}
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="app-backdrop min-h-screen flex">
      <div className="hidden lg:block sticky top-0 h-screen z-20">{Sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0" style={{ background: "var(--color-overlay)" }} onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 h-full">{Sidebar}</div>
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="glass lg:hidden sticky top-0 z-30 px-4 py-3 flex items-center justify-between"
          style={{ borderWidth: 0, borderBottomWidth: 1, borderColor: "var(--color-border)", boxShadow: "none" }}>
          <Logo size={28} />
          <button onClick={() => nav("/app/alerts")} title="Alertas" className={`relative ${iconButton}`} style={{ color: "var(--color-text-muted)" }}>
            <Bell className="w-5 h-5" />
            {alertCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: "var(--color-expense)" }} />
            )}
          </button>
        </header>
        <main className="flex-1 p-4 pb-28 sm:p-6 sm:pb-28 lg:p-8 max-w-7xl w-full mx-auto">
          {/* Inside the app, motion is functional only: fades stay, sliding
              and scaling entrances are switched off for every page at once. */}
          <MotionConfig reducedMotion="always">
            <Outlet />
          </MotionConfig>
        </main>
      </div>

      {/* Phone: bottom tab bar, like a banking app. The four most used
          destinations around the "new transaction" button; "Mais" opens the
          full menu. */}
      <nav className="glass lg:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-5 items-end px-2 pt-1.5"
        style={{ borderWidth: 0, borderTopWidth: 1, borderColor: "var(--color-border)", boxShadow: "none", paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        aria-label="Navegação principal">
        {bottomItems.slice(0, 2).map(renderTab)}
        <div className="flex justify-center">
          <button onClick={() => setQuickAddOpen(true)} title="Nova transação" data-testid="bottom-quick-add"
            className="-mt-5 w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: "rgb(var(--c-primary-solid))", color: "var(--color-on-primary)", boxShadow: "var(--shadow-float)" }}>
            <Plus className="w-6 h-6" />
          </button>
        </div>
        {bottomItems.slice(2).map(renderTab)}
        <button data-testid="open-sidebar" onClick={() => setOpen(true)}
          className="flex flex-col items-center gap-0.5 py-1 text-2xs font-medium"
          style={{ color: inMore || open ? "var(--color-primary)" : "var(--color-text-low)" }}>
          <Menu className="w-5 h-5" />
          Mais
        </button>
      </nav>

      {/* Quick add */}
      {quickAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "var(--color-overlay)" }}
          onClick={() => setQuickAddOpen(false)}>
          <div className="glass-strong w-full max-w-sm rounded-card p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold text-base" style={{ color: "var(--color-text)" }}>Nova transação</h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-low)" }}>Registro rápido</p>
              </div>
              <button onClick={() => setQuickAddOpen(false)} title="Fechar" className={iconButton} style={{ color: "var(--color-text-low)" }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleQuickAdd} className="space-y-3">
              <div className="grid grid-cols-2 gap-1 p-1 rounded-control" style={{ background: "var(--color-hairline-strong)" }}>
                {(["EXPENSE", "INCOME"] as const).map(t => {
                  const active = quickForm.type === t;
                  return (
                    <button key={t} type="button" onClick={() => setQuickForm({ ...quickForm, type: t })}
                      className="py-2 rounded-lg text-sm font-medium transition-colors duration-150"
                      style={active
                        ? { background: t === "EXPENSE" ? "var(--color-expense)" : "var(--color-income)", color: "#fff" }
                        : { color: "var(--color-text-muted)" }}>
                      {t === "EXPENSE" ? "Despesa" : "Receita"}
                    </button>
                  );
                })}
              </div>
              <input className="input" placeholder="Descrição" value={quickForm.title} onChange={e => setQuickForm({ ...quickForm, title: e.target.value })} required />
              <input type="number" step="0.01" min="0.01" className="input num" placeholder="Valor em R$" value={quickForm.amount} onChange={e => setQuickForm({ ...quickForm, amount: e.target.value })} required />
              {quickAccounts.length > 0 && (
                <select className="input" value={quickForm.accountId} onChange={e => setQuickForm({ ...quickForm, accountId: e.target.value })}>
                  <option value="">Sem conta</option>
                  {quickAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
              <button type="submit" disabled={quickLoading} className="btn-primary w-full">
                {quickLoading ? "Salvando..." : "Salvar transação"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
