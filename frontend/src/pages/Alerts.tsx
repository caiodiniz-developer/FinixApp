import { useEffect, useState } from "react";
import {
  Loader2,
  RefreshCcw,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  BellRing,
} from "lucide-react";
import { api, apiErrorMessage } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Budget } from "../types";
import { currency, dateBR } from "../utils/format";

// Aviso guardado no servidor (limite do cartão, compra por impulso...)
interface Notice {
  id: string;
  source: "notice" | "upcoming";
  title: string;
  description?: string | null;
  severity?: string;
}

// Tipo local para transações parceladas agrupadas
interface InstallmentGroup {
  installmentGroupId: string;
  title: string;
  category: string;
  paymentMethod?: string;
  totalInstallments: number;
  paidInstallments: number; // parcelas já pagas (data <= hoje)
  remainingInstallments: number; // parcelas restantes
  amountPerInstallment: number;
  nextPaymentDate: string | null; // data da próxima parcela futura
  daysUntilNext: number | null;
  totalPaid: number;
  totalRemaining: number;
}

const getTodayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const toDateStr = (raw: string): string => {
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return raw.slice(0, 10);
};

export default function Alerts() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [installmentGroups, setInstallmentGroups] = useState<
    InstallmentGroup[]
  >([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [budgetsRes, txRes] = await Promise.all([
        api.get("/api/budgets"),
        // Busca todas as transações parceladas (ajuste o endpoint conforme sua API)
        api.get("/api/transactions?installment=true&limit=500"),
      ]);

      setBudgets(budgetsRes.data || []);

      // Avisos guardados: mostra nesta visita e marca como lidos, para não
      // voltarem a contar no sininho. (403 = plano sem alertas — ignora.)
      api
        .get("/api/alerts")
        .then((r) => {
          const stored: Notice[] = (r.data?.alerts || []).filter(
            (a: Notice) => a.source === "notice",
          );
          setNotices(stored);
          if (stored.length > 0) {
            api.post("/api/alerts/read", { ids: stored.map((n) => n.id) }).catch(() => {});
          }
        })
        .catch(() => {});

      // ── Agrupa parcelas por installmentGroupId ────────────────────────────
      const transactions: any[] = txRes.data?.transactions ?? txRes.data ?? [];
      const todayStr = getTodayStr();

      const groups: Record<string, any[]> = {};
      for (const tx of transactions) {
        if (!tx.installmentGroupId || (tx.totalInstallments ?? 0) <= 1)
          continue;
        if (!groups[tx.installmentGroupId]) groups[tx.installmentGroupId] = [];
        groups[tx.installmentGroupId].push(tx);
      }

      const grouped: InstallmentGroup[] = Object.entries(groups).map(
        ([groupId, txs]) => {
          // Ordena por número da parcela
          txs.sort(
            (a, b) => (a.installmentNumber ?? 0) - (b.installmentNumber ?? 0),
          );

          const first = txs[0];
          const totalInstallments = first.totalInstallments ?? txs.length;
          const amountPerInstallment = first.amount ?? 0;

          const paid = txs.filter((t) => toDateStr(t.date) <= todayStr);
          const upcoming = txs.filter((t) => toDateStr(t.date) > todayStr);
          upcoming.sort((a, b) =>
            toDateStr(a.date).localeCompare(toDateStr(b.date)),
          );

          const nextPaymentDate =
            upcoming.length > 0 ? toDateStr(upcoming[0].date) : null;
          let daysUntilNext: number | null = null;
          if (nextPaymentDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const next = new Date(nextPaymentDate + "T12:00:00");
            daysUntilNext = Math.floor(
              (next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
            );
          }

          return {
            installmentGroupId: groupId,
            title: first.title ?? "Compra parcelada",
            category: first.category ?? "—",
            paymentMethod: first.paymentMethod,
            totalInstallments,
            paidInstallments: paid.length,
            remainingInstallments: upcoming.length,
            amountPerInstallment,
            nextPaymentDate,
            daysUntilNext,
            totalPaid: paid.reduce((s, t) => s + (t.amount ?? 0), 0),
            totalRemaining: upcoming.reduce((s, t) => s + (t.amount ?? 0), 0),
          };
        },
      );

      // Mostra: grupos com parcelas restantes, ordenados por próxima data
      const active = grouped
        .filter((g) => g.remainingInstallments > 0)
        .sort((a, b) => {
          if (a.daysUntilNext === null) return 1;
          if (b.daysUntilNext === null) return -1;
          return a.daysUntilNext - b.daysUntilNext;
        });

      setInstallmentGroups(active);
    } catch (err: any) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [user]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── Budget alerts ─────────────────────────────────────────────────────────
  const budgetAlerts = budgets
    .map((b) => {
      const usedPercent =
        b.limit > 0 ? Math.round((b.spent / b.limit) * 100) : 0;
      let diffDays: number | null = null;
      if ((b as any).dueDate) {
        const due = new Date((b as any).dueDate);
        due.setHours(0, 0, 0, 0);
        diffDays = Math.floor(
          (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );
      }
      return {
        ...b,
        dueDate: (b as any).dueDate ?? null,
        diffDays,
        usedPercent,
      };
    })
    .sort((a, b) => b.usedPercent - a.usedPercent);

  const overLimitCount = budgetAlerts.filter(
    (b) => b.usedPercent >= 100,
  ).length;
  const nearingCount = budgetAlerts.filter(
    (b) => b.usedPercent >= 80 && b.usedPercent < 100,
  ).length;
  const dueSoonCount = budgetAlerts.filter(
    (b) => b.diffDays !== null && b.diffDays <= 7,
  ).length;

  // ── Installment summary counts ────────────────────────────────────────────
  const installmentDueSoon = installmentGroups.filter(
    (g) => g.daysUntilNext !== null && g.daysUntilNext <= 7,
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold text-text dark:text-text">
            Alertas Financeiros
          </h1>
          <p className="mt-2 text-muted dark:text-muted">
            Acompanhe o uso dos seus orçamentos, prazos de vencimento e parcelas
            de crédito.
          </p>
        </div>
        <button
          onClick={fetchAlerts}
          className="btn-outline inline-flex items-center gap-2 rounded-card px-4 py-3 text-sm border border-border dark:border-border bg-surface dark:bg-surface text-text dark:text-muted hover:bg-surface dark:hover:bg-surface-strong transition"
        >
          <RefreshCcw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      {/* Cards de resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="card border border-border dark:border-border bg-surface dark:bg-surface p-6">
          <div className="text-sm uppercase tracking-[0.3em] text-muted dark:text-muted">
            Limite estourado
          </div>
          <div className="mt-4 text-3xl font-semibold text-rose-600 dark:text-rose-400">
            {overLimitCount}
          </div>
        </div>
        <div className="card border border-border dark:border-border bg-surface dark:bg-surface p-6">
          <div className="text-sm uppercase tracking-[0.3em] text-muted dark:text-muted">
            Próximo do limite
          </div>
          <div className="mt-4 text-3xl font-semibold text-amber-500 dark:text-amber-400">
            {nearingCount}
          </div>
        </div>
        <div className="card border border-border dark:border-border bg-surface dark:bg-surface p-6">
          <div className="text-sm uppercase tracking-[0.3em] text-muted dark:text-muted">
            Vencem em 7 dias
          </div>
          <div className="mt-4 text-3xl font-semibold text-text">
            {dueSoonCount}
          </div>
        </div>
        <div className="card border border-border dark:border-border bg-surface dark:bg-surface p-6">
          <div className="text-sm uppercase tracking-[0.3em] text-muted dark:text-muted">
            Parcelas próximas
          </div>
          <div className="mt-4 text-3xl font-semibold text-blue-600 dark:text-blue-400">
            {installmentDueSoon}
          </div>
        </div>
      </div>

      {/* ── SEÇÃO: Avisos ───────────────────────────────────────────────────── */}
      {notices.length > 0 && (
        <div className="card border border-border dark:border-border bg-surface dark:bg-surface p-6">
          <div className="flex items-center gap-3 mb-5">
            <BellRing className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-text dark:text-text">Avisos</h2>
          </div>
          <div className="space-y-3">
            {notices.map((n) => (
              <div
                key={n.id}
                className={`rounded-card border p-4 ${
                  n.severity === "danger"
                    ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200"
                    : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
                }`}
              >
                <div className="font-semibold text-sm">{n.title}</div>
                {n.description && <div className="text-sm mt-1 opacity-90">{n.description}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SEÇÃO: Parcelas de crédito ──────────────────────────────────────── */}
      <div className="card border border-border dark:border-border bg-surface dark:bg-surface p-6">
        <div className="flex items-center gap-3 mb-5">
          <CreditCard className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-text dark:text-text">
            Compras parceladas em aberto
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 text-muted dark:text-muted py-8">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
          </div>
        ) : error ? (
          <div className="rounded-card bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 p-4 text-rose-700 dark:text-rose-300">
            {error}
          </div>
        ) : installmentGroups.length === 0 ? (
          <div className="rounded-card border border-dashed border-border-strong dark:border-border bg-surface dark:bg-surface-strong/30 p-8 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-3" />
            <p className="text-muted dark:text-muted">
              Nenhuma compra parcelada em andamento.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {installmentGroups.map((g) => {
              const progressPercent = Math.round(
                (g.paidInstallments / g.totalInstallments) * 100,
              );
              const isDanger = g.daysUntilNext !== null && g.daysUntilNext <= 1;
              const isWarning =
                !isDanger && g.daysUntilNext !== null && g.daysUntilNext <= 7;

              return (
                <div
                  key={g.installmentGroupId}
                  className={`rounded-card border p-4 transition-all ${
                    isDanger
                      ? "border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30"
                      : isWarning
                        ? "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30"
                        : "border-border dark:border-border bg-surface dark:bg-surface"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Título + badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-text dark:text-text">
                          {g.title}
                        </span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                          {g.paidInstallments}/{g.totalInstallments}x
                        </span>
                        {g.paymentMethod && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-surface-strong dark:bg-surface-strong text-muted dark:text-muted">
                            {g.paymentMethod}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted mt-0.5">{g.category}</p>

                      {/* Barra de progresso das parcelas */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-surface-strong overflow-hidden max-w-[200px]">
                          <div
                            className="h-full rounded-full bg-blue-500 transition-all"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted dark:text-muted">
                          {g.remainingInstallments} parcela
                          {g.remainingInstallments !== 1 ? "s" : ""} restante
                          {g.remainingInstallments !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {/* Valores */}
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted dark:text-muted">
                        <span>
                          Por parcela:{" "}
                          <span className="font-semibold text-text">
                            {currency(g.amountPerInstallment)}
                          </span>
                        </span>
                        <span>
                          Restante:{" "}
                          <span className="font-semibold text-rose-600 dark:text-rose-400">
                            {currency(g.totalRemaining)}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Próximo pagamento */}
                    <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                      {g.nextPaymentDate ? (
                        <>
                          <div
                            className={`text-sm font-semibold ${
                              isDanger
                                ? "text-rose-600 dark:text-rose-400"
                                : isWarning
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-muted dark:text-muted"
                            }`}
                          >
                            {g.daysUntilNext === 0
                              ? "Vence hoje"
                              : g.daysUntilNext === 1
                                ? "Vence amanhã"
                                : `Próxima em ${g.daysUntilNext} dias`}
                          </div>
                          <span className="text-xs text-muted dark:text-muted rounded-control bg-surface-strong dark:bg-surface-strong px-2 py-1">
                            {dateBR(g.nextPaymentDate)}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                          Quitado ✓
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── SEÇÃO: Orçamentos ───────────────────────────────────────────────── */}
      <div className="card border border-border dark:border-border bg-surface dark:bg-surface p-6">
        <div className="flex items-center gap-3 mb-5">
          <CalendarClock className="w-5 h-5 text-brand-blue" />
          <h2 className="text-lg font-semibold text-text dark:text-text">
            Seus orçamentos
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 text-muted dark:text-muted py-8">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
          </div>
        ) : error ? (
          <div className="rounded-card bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 p-4 text-rose-700 dark:text-rose-300">
            {error}
          </div>
        ) : budgetAlerts.length === 0 ? (
          <div className="rounded-card border border-dashed border-border-strong dark:border-border bg-surface dark:bg-surface-strong/30 p-8 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-3" />
            <p className="text-muted dark:text-muted">
              Nenhum orçamento cadastrado ainda.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {budgetAlerts.map((b) => {
              const isOverdue = b.diffDays !== null && b.diffDays < 0;
              const isDanger =
                b.usedPercent >= 100 ||
                (b.diffDays !== null && b.diffDays <= 1);
              const isWarning =
                !isDanger &&
                (b.usedPercent >= 80 ||
                  (b.diffDays !== null && b.diffDays <= 3));

              return (
                <div
                  key={b.id}
                  className={`rounded-card border p-4 flex flex-col sm:flex-row sm:items-center gap-3 transition-all ${
                    isDanger
                      ? "border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30"
                      : isWarning
                        ? "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30"
                        : "border-border dark:border-border bg-surface dark:bg-surface"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-text dark:text-text">
                        {b.category}
                      </span>
                      {b.usedPercent >= 100 && (
                        <span className="chip bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 text-[10px]">
                          Limite estourado
                        </span>
                      )}
                      {b.usedPercent >= 80 && b.usedPercent < 100 && (
                        <span className="chip bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 text-[10px]">
                          {b.usedPercent}% usado
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-surface-strong overflow-hidden max-w-[200px]">
                        <div
                          className={`h-full rounded-full transition-all ${b.usedPercent >= 100 ? "bg-rose-500" : b.usedPercent >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(100, b.usedPercent)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted dark:text-muted">
                        {currency(b.spent)} / {currency(b.limit)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {b.dueDate ? (
                      <>
                        <div
                          className={`text-sm font-semibold ${isDanger ? "text-rose-600 dark:text-rose-400" : isWarning ? "text-amber-600 dark:text-amber-400" : "text-muted dark:text-muted"}`}
                        >
                          {isOverdue
                            ? `Venceu há ${Math.abs(b.diffDays!)} dia${Math.abs(b.diffDays!) > 1 ? "s" : ""}`
                            : b.diffDays === 0
                              ? "Vence hoje"
                              : `Vence em ${b.diffDays} dia${b.diffDays! > 1 ? "s" : ""}`}
                        </div>
                        <span className="text-xs text-muted dark:text-muted rounded-control bg-surface-strong dark:bg-surface-strong px-2 py-1">
                          {dateBR(b.dueDate)}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-muted dark:text-muted rounded-control bg-surface-strong dark:bg-surface-strong px-2 py-1">
                        Sem prazo
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
