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
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Alertas Financeiros
          </h1>
          <p className="page-subtitle">
            Acompanhe o uso dos seus orçamentos, prazos de vencimento e parcelas
            de crédito.
          </p>
        </div>
        <button
          onClick={fetchAlerts}
          className="btn-outline"
        >
          <RefreshCcw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      {/* Resumo: só o que pede atenção */}
      <div className="flex flex-wrap gap-2">
        {overLimitCount > 0 && (
          <span className="chip chip-expense">{overLimitCount} {overLimitCount === 1 ? "limite estourado" : "limites estourados"}</span>
        )}
        {nearingCount > 0 && (
          <span className="chip chip-warning">{nearingCount} perto do limite</span>
        )}
        {dueSoonCount > 0 && (
          <span className="chip chip-warning">{dueSoonCount} {dueSoonCount === 1 ? "vence" : "vencem"} em 7 dias</span>
        )}
        {installmentDueSoon > 0 && (
          <span className="chip chip-primary">{installmentDueSoon} {installmentDueSoon === 1 ? "parcela próxima" : "parcelas próximas"}</span>
        )}
        {overLimitCount + nearingCount + dueSoonCount + installmentDueSoon === 0 && !loading && (
          <span className="chip chip-income">Tudo em dia</span>
        )}
      </div>

      {/* ── SEÇÃO: Avisos ───────────────────────────────────────────────────── */}
      {notices.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-3 mb-5">
            <BellRing className="w-5 h-5 text-warning" />
            <h2 className="text-lg font-semibold text-text">Avisos</h2>
          </div>
          <div className="space-y-3">
            {notices.map((n) => (
              <div
                key={n.id}
                className={`rounded-control border p-4 ${
 n.severity === "danger"
                    ? "border-expense/30 bg-expense/10 text-expense   "
                    : "border-warning/30 bg-warning/10 text-warning   "
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
      <div className="card">
        <div className="flex items-center gap-3 mb-5">
          <CreditCard className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-text">
            Compras parceladas em aberto
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 text-muted py-8">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
          </div>
        ) : error ? (
          <div className="rounded-card bg-expense/10 border border-expense/30 p-4 text-expense ">
            {error}
          </div>
        ) : installmentGroups.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <CheckCircle2 className="w-4 h-4 text-income" />
            <p>
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
                  className={`rounded-control border p-4 transition-all ${
 isDanger
 ? "border-expense/30  bg-expense/10 "
                      : isWarning
                        ? "border-warning/30  bg-warning/10 "
                        : "border-transparent bg-[var(--color-card-hover)]"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Título + badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-text">
                          {g.title}
                        </span>
                        <span className="text-2xs font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary ">
                          {g.paidInstallments}/{g.totalInstallments}x
                        </span>
                        {g.paymentMethod && (
                          <span className="text-2xs font-medium px-1.5 py-0.5 rounded-full bg-surface-strong text-muted">
                            {g.paymentMethod}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted mt-0.5">{g.category}</p>

                      {/* Barra de progresso das parcelas */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-surface-strong overflow-hidden max-w-[200px]">
                          <div
                            className="h-full rounded-full bg-primary-solid transition-all"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted">
                          {g.remainingInstallments} parcela
                          {g.remainingInstallments !== 1 ? "s" : ""} restante
                          {g.remainingInstallments !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {/* Valores */}
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                        <span>
                          Por parcela:{" "}
                          <span className="font-semibold text-text">
                            {currency(g.amountPerInstallment)}
                          </span>
                        </span>
                        <span>
                          Restante:{" "}
                          <span className="font-semibold text-expense ">
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
 ? "text-expense "
                                : isWarning
                                  ? "text-warning "
                                  : "text-muted"
                            }`}
                          >
                            {g.daysUntilNext === 0
                              ? "Vence hoje"
                              : g.daysUntilNext === 1
                                ? "Vence amanhã"
                                : `Próxima em ${g.daysUntilNext} dias`}
                          </div>
                          <span className="text-xs text-muted rounded-control bg-surface-strong px-2 py-1">
                            {dateBR(g.nextPaymentDate)}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-income font-semibold">
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
      <div className="card">
        <div className="flex items-center gap-3 mb-5">
          <CalendarClock className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-text">
            Seus orçamentos
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 text-muted py-8">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
          </div>
        ) : error ? (
          <div className="rounded-card bg-expense/10 border border-expense/30 p-4 text-expense ">
            {error}
          </div>
        ) : budgetAlerts.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <CheckCircle2 className="w-4 h-4 text-income" />
            <p>
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
                  className={`rounded-control border p-4 flex flex-col sm:flex-row sm:items-center gap-3 transition-all ${
 isDanger
 ? "border-expense/30  bg-expense/10 "
                      : isWarning
                        ? "border-warning/30  bg-warning/10 "
                        : "border-transparent bg-[var(--color-card-hover)]"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-text">
                        {b.category}
                      </span>
                      {b.usedPercent >= 100 && (
                        <span className="chip bg-expense/10 text-expense text-2xs">
                          Limite estourado
                        </span>
                      )}
                      {b.usedPercent >= 80 && b.usedPercent < 100 && (
                        <span className="chip bg-warning/10 text-warning text-2xs">
                          {b.usedPercent}% usado
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-surface-strong overflow-hidden max-w-[200px]">
                        <div
                          className={`h-full rounded-full transition-all ${b.usedPercent >= 100 ? "bg-expense" : b.usedPercent >= 80 ? "bg-warning" : "bg-income"}`}
                          style={{ width: `${Math.min(100, b.usedPercent)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted">
                        {currency(b.spent)} / {currency(b.limit)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {b.dueDate ? (
                      <>
                        <div
                          className={`text-sm font-semibold ${isDanger ? "text-expense " : isWarning ? "text-warning " : "text-muted"}`}
                        >
                          {isOverdue
                            ? `Venceu há ${Math.abs(b.diffDays!)} dia${Math.abs(b.diffDays!) > 1 ? "s" : ""}`
                            : b.diffDays === 0
                              ? "Vence hoje"
                              : `Vence em ${b.diffDays} dia${b.diffDays! > 1 ? "s" : ""}`}
                        </div>
                        <span className="text-xs text-muted rounded-control bg-surface-strong px-2 py-1">
                          {dateBR(b.dueDate)}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-muted rounded-control bg-surface-strong px-2 py-1">
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
