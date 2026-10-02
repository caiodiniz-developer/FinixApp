import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { api, apiErrorMessage } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { CalendarData, CalendarTransaction } from "../types";
import { currency, dateBR } from "../utils/format";

const getMonthKey = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value,
  );

const toDateStr = (raw: string): string => {
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return raw.slice(0, 10);
};

const getTodayStr = (): string =>
  new Intl.DateTimeFormat("en-CA").format(new Date());

const getYesterdayStr = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return new Intl.DateTimeFormat("en-CA").format(d);
};

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const isPastOrToday = (raw: string): boolean => toDateStr(raw) <= getTodayStr();

type DayTransaction = CalendarTransaction;

// FIX: normaliza qualquer formato de data para YYYY-MM-DD local, sem converter timezone
const txDateToLocal = (raw: string): string => {
  if (!raw) return "";
  // já está no formato correto
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // ISO com timezone: pega só a parte da data sem converter
  return raw.slice(0, 10);
};

export default function Calendar() {
  const { user } = useAuth();
  const [calendar, setCalendar] = useState<CalendarData | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");

  const [dayTransactions, setDayTransactions] = useState<DayTransaction[]>([]);
  const [dayTotals, setDayTotals] = useState<{
    revenue: number;
    expense: number;
    net: number;
  }>({
    revenue: 0,
    expense: 0,
    net: 0,
  });

  const [loading, setLoading] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monthKey, setMonthKey] = useState(() => getMonthKey(new Date()));

  // Controla qual é a última requisição disparada; qualquer resposta de requisição
  // anterior é descartada silenciosamente.
  const fetchCounterRef = useRef(0);
  const shouldAutoSelectRef = useRef(true);
  const fetchCalendarRef = useRef<(force?: boolean) => void>(() => {});

  const fetchDayTransactions = useCallback(
    async (date: string) => {
      if (!date || !user) return;

      // FIX: incrementa o contador e captura o valor desta requisição
      const myCounter = ++fetchCounterRef.current;

      // FIX: mostra loading SEM limpar as transações atuais (evita flash vazio)
      setLoadingDay(true);

      try {
        // FIX: busca APENAS o dia selecionado — não precisa do dia anterior
        const res = await api.get(
          `/api/transactions?date=${date}&_t=${Date.now()}`,
        );

        // FIX: ignora resultado se já foi disparada uma requisição mais recente
        if (myCounter !== fetchCounterRef.current) return;

        const raw: any[] = res.data?.transactions ?? res.data ?? [];

        const txs: DayTransaction[] = raw
          .map((tx: any) => ({
            ...tx,
            date: txDateToLocal(String(tx.date)),
          }))
          // FIX: filtra pelo date correto (já normalizado)
          .filter((tx) => tx.date === date)
          // FIX: remove duplicatas por id
          .filter(
            (tx, idx, arr) => arr.findIndex((t) => t.id === tx.id) === idx,
          );

        // FIX: só aplica se ainda for a requisição mais recente
        if (myCounter !== fetchCounterRef.current) return;

        setDayTransactions(txs);

        const revenue = txs
          .filter((t) => t.type === "INCOME")
          .reduce((a, t) => a + t.amount, 0);
        const expense = txs
          .filter((t) => t.type === "EXPENSE")
          .reduce((a, t) => a + t.amount, 0);
        setDayTotals({ revenue, expense, net: revenue - expense });

        // Atualiza o resumo do calendário para esse dia
        setCalendar((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            dailySummary: prev.dailySummary.map((d) =>
              d.date === date
                ? {
                    ...d,
                    revenue,
                    expense,
                    net: revenue - expense,
                    transactions: txs,
                  }
                : d,
            ),
          };
        });
      } catch {
        // FIX: em caso de erro, não limpa as transações — mantém o que estava sendo exibido
        // Só reseta o loading se ainda for a requisição ativa
        if (myCounter !== fetchCounterRef.current) return;
      } finally {
        if (myCounter === fetchCounterRef.current) {
          setLoadingDay(false);
        }
      }
    },
    [user],
  );

  const handleSelectDate = useCallback(
    (date: string) => {
      if (!date) return;

      // FIX: atualiza selectedDate imediatamente para feedback visual instantâneo
      setSelectedDate(date);

      // FIX: NÃO limpa dayTransactions aqui — o skeleton só aparece se não houver nada
      // Isso evita o flash de "lista vazia" entre cliques
      fetchDayTransactions(date);
    },
    [fetchDayTransactions],
  );

  const fetchCalendar = useCallback(
    async (_forceRefresh = false) => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(
          `/api/calendar?month=${monthKey}&_t=${Date.now()}`,
        );
        const data: CalendarData = res.data;

        const normalized: CalendarData = {
          ...data,
          dailySummary: (data.dailySummary as any[]).map((d) => ({
            ...d,
            date: toDateStr(d.date),
            transactions: (d.transactions || []).map((tx: any) => ({
              ...tx,
              date: txDateToLocal(String(tx.date)),
            })),
          })),
        };

        setCalendar(normalized);

        if (shouldAutoSelectRef.current) {
          shouldAutoSelectRef.current = false;

          const todayStr = getTodayStr();
          const yesterdayStr = getYesterdayStr();
          const pastDays = normalized.dailySummary.filter((d) =>
            isPastOrToday(d.date),
          );

          if (pastDays.length) {
            const todayDay = pastDays.find((d) => d.date === todayStr);
            const yesterdayDay = pastDays.find((d) => d.date === yesterdayStr);

            let target: string;
            if (todayDay) {
              target = todayStr;
            } else if (yesterdayDay) {
              target = yesterdayStr;
            } else {
              target = pastDays[pastDays.length - 1].date;
            }

            setSelectedDate(target);
            fetchDayTransactions(target);
          }
        } else if (_forceRefresh) {
          // No refresh forçado, re-busca o dia selecionado sem resetar transações
          // Usa o selectedDate via closure — se não houver dia selecionado, não faz nada
          setSelectedDate((currentDate) => {
            if (currentDate) {
              fetchDayTransactions(currentDate);
            }
            return currentDate;
          });
        }
      } catch (err: any) {
        setError(apiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [user, monthKey, fetchDayTransactions],
  );

  useEffect(() => {
    fetchCalendarRef.current = fetchCalendar;
  }, [fetchCalendar]);
  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { date?: string } | undefined;
      if (detail?.date) {
        const txDate = txDateToLocal(String(detail.date));
        if (txDate.slice(0, 7) === monthKey) {
          setSelectedDate(txDate);
          fetchCalendarRef.current(true);
          fetchDayTransactions(txDate);
        } else {
          fetchCalendarRef.current(true);
        }
      } else {
        fetchCalendarRef.current(true);
      }
    };
    window.addEventListener("transaction-saved", handler);
    return () => window.removeEventListener("transaction-saved", handler);
  }, [monthKey, fetchDayTransactions]);

  const handlePrevMonth = () => {
    const [year, month] = monthKey.split("-").map(Number);
    shouldAutoSelectRef.current = true;
    fetchCounterRef.current++; // FIX: cancela qualquer fetch em andamento
    setMonthKey(getMonthKey(new Date(year, month - 2, 1)));
    setSelectedDate("");
    setDayTransactions([]);
    setDayTotals({ revenue: 0, expense: 0, net: 0 });
  };

  const handleNextMonth = () => {
    const [year, month] = monthKey.split("-").map(Number);
    shouldAutoSelectRef.current = true;
    fetchCounterRef.current++; // FIX: cancela qualquer fetch em andamento
    setMonthKey(getMonthKey(new Date(year, month, 1)));
    setSelectedDate("");
    setDayTransactions([]);
    setDayTotals({ revenue: 0, expense: 0, net: 0 });
  };

  const currentMonthLabel = useMemo(() => {
    const [year, month] = monthKey.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });
  }, [monthKey]);

  const isCurrentMonth = monthKey === getMonthKey(new Date());
  const todayStr = getTodayStr();

  const monthlyTotals = useMemo(() => {
    if (!calendar) return { revenue: 0, expense: 0, net: 0 };
    const past = calendar.dailySummary.filter((d) => isPastOrToday(d.date));
    const revenue = past.reduce((a, d) => a + (d.revenue ?? 0), 0);
    const expense = past.reduce((a, d) => a + (d.expense ?? 0), 0);
    return { revenue, expense, net: revenue - expense };
  }, [calendar]);

  const calendarGridDays = useMemo(() => {
    if (!calendar) return [];
    const [year, month] = monthKey.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDay = new Date(year, month - 1, 1).getDay();
    const leadingEmpty = (firstDay + 6) % 7;
    const allDays = [...Array(leadingEmpty).fill(null)];
    const dayMap = new Map(calendar.dailySummary.map((day) => [day.date, day]));

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      allDays.push(
        dayMap.get(date) ?? {
          date,
          revenue: 0,
          expense: 0,
          net: 0,
          transactions: [],
        },
      );
    }

    while (allDays.length % 7 !== 0) allDays.push(null);
    return allDays;
  }, [calendar, monthKey]);

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">
            Calendário Financeiro
          </h1>
          <p className="page-subtitle">
            Visualize receitas, despesas e saldo diário com navegação mensal.
          </p>
        </div>
        <div className="inline-flex self-start sm:self-auto items-center gap-2 rounded-card border border-border dark:border-border bg-surface dark:bg-surface px-3 py-2">
          <button
            onClick={handlePrevMonth}
            className="btn-ghost rounded-full p-1.5 sm:p-2"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold capitalize text-sm sm:text-base text-text">
            {currentMonthLabel}
          </span>
          <button
            onClick={handleNextMonth}
            className="btn-ghost rounded-full p-1.5 sm:p-2"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading && !calendar ? (
        <div className="card" aria-hidden="true">
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }, (_, i) => <div key={i} className="skeleton h-16 sm:h-20" />)}
          </div>
        </div>
      ) : error ? (
        <div className="card border border-expense/30 bg-expense/10 dark:bg-surface p-6 text-expense ">
          {error}
        </div>
      ) : (
        <>
          {/* Monthly totals */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {[
              {
                label: "Receita",
                value: monthlyTotals.revenue,
                color: "text-income ",
              },
              {
                label: "Despesa",
                value: monthlyTotals.expense,
                color: "text-expense ",
              },
              {
                label: "Saldo",
                value: monthlyTotals.net,
                color:
                  monthlyTotals.net >= 0
                    ? "text-income "
                    : "text-expense ",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="card border border-border dark:border-border bg-surface dark:bg-surface p-3 sm:p-4 md:p-6"
              >
                <div className="text-2xs sm:text-xs sm: text-muted truncate">
                  <span className="sm:hidden">{item.label}</span>
                  <span className="hidden sm:inline">
                    {item.label === "Saldo" ? "Saldo líquido" : item.label}
                  </span>
                </div>
                <div
                  className={`mt-2 text-xs sm:text-base md:text-2xl lg:text-3xl font-semibold num ${item.color} truncate`}
                >
                  {formatCurrency(item.value)}
                </div>
                {isCurrentMonth && (
                  <p className="mt-1 text-2xs sm:text-xs text-muted hidden sm:block">
                    Acumulado até hoje
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Main grid: calendar + day detail */}
          <div className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
            {/* Calendar grid */}
            <div className="card border border-border dark:border-border bg-surface dark:bg-surface p-3 sm:p-4">
              {loading && (
                <div className="mb-3 flex items-center gap-2 text-xs text-muted">
                  <Loader2 className="h-3 w-3 animate-spin" /> Atualizando...
                </div>
              )}
              <div className="grid gap-1 sm:gap-2">
                {/* Weekday labels */}
                <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-2xs sm:text-2xs sm: text-muted">
                  {WEEKDAY_LABELS.map((label) => (
                    <div key={label} className="py-1 sm:py-2">
                      <span className="sm:hidden">{label.charAt(0)}</span>
                      <span className="hidden sm:inline">{label}</span>
                    </div>
                  ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {calendarGridDays.map((day, index) => {
                    if (!day) {
                      return (
                        <div
                          key={`empty-${index}`}
                          className="min-h-[56px] sm:min-h-[76px] md:min-h-[88px]"
                        />
                      );
                    }

                    const date = new Date(day.date + "T12:00:00");
                    const past = isPastOrToday(day.date);
                    const isActive = day.date === selectedDate;
                    const isToday = day.date === todayStr;
                    const revenue = day.revenue ?? 0;
                    const expense = day.expense ?? 0;
                    const quiet = revenue === 0 && expense === 0;
                    const compact = (v: number) =>
                      new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(v);

                    // Days with nothing in them stay almost invisible, so the
                    // eye lands on the ones where money moved.
                    return (
                      <button
                        key={day.date}
                        onClick={() => past && handleSelectDate(day.date)}
                        disabled={!past}
                        title={
                          !past
                            ? "Dados disponíveis somente após o dia ocorrer"
                            : undefined
                        }
                        className={[
                          "pressable flex flex-col gap-1.5 rounded-control border p-1.5 sm:p-2 text-left transition-colors min-h-[56px] sm:min-h-[76px] md:min-h-[88px]",
                          !past
                            ? "border-transparent opacity-40 cursor-not-allowed"
                            : isActive
                              ? "border-primary/50 bg-primary/10 cursor-pointer"
                              : quiet
                                ? "border-transparent hover:bg-[var(--color-card-hover)] cursor-pointer"
                                : "border-border bg-[var(--color-hairline)] hover:border-primary/40 cursor-pointer",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full text-xs sm:text-sm font-semibold leading-none num",
                            isToday ? "text-white" : past && !quiet ? "text-text" : "text-muted",
                          ].join(" ")}
                          style={isToday ? { background: "rgb(var(--c-primary-solid))" } : undefined}
                        >
                          {date.getDate()}
                        </span>

                        {past && !quiet && (
                          <div className="mt-auto space-y-0.5 text-2xs sm:text-xs leading-tight num">
                            {revenue > 0 && (
                              <div className="flex items-center gap-1 text-income font-medium">
                                <span className="h-1.5 w-1.5 rounded-full bg-income shrink-0" />
                                <span className="truncate hidden sm:inline">{compact(revenue)}</span>
                              </div>
                            )}
                            {expense > 0 && (
                              <div className="flex items-center gap-1 text-expense font-medium">
                                <span className="h-1.5 w-1.5 rounded-full bg-expense shrink-0" />
                                <span className="truncate hidden sm:inline">{compact(expense)}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="mt-3 sm:mt-4 flex flex-wrap items-center gap-3 sm:gap-4 px-1 text-2xs sm:text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-income" />{" "}
                  Receita
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-expense" /> Despesa
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary-solid" />{" "}
                  Hoje
                </span>
                <span className="flex items-center gap-1.5 opacity-50">
                  <span className="h-2 w-2 rounded-full bg-surface-strong/50 dark:bg-surface-strong/80" />{" "}
                  Futuros
                </span>
              </div>
            </div>

            {/* Day detail panel */}
            <div className="card border border-border dark:border-border bg-surface dark:bg-surface p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-2xs sm:text-xs text-muted">
                    Detalhes do dia
                  </p>
                  <h2 className="mt-1 sm:mt-2 text-base sm:text-lg md:text-xl font-semibold text-text">
                    {selectedDate ? dateBR(selectedDate) : "Selecione um dia"}
                  </h2>
                </div>
                {selectedDate && (
                  <div
                    className={`rounded-control sm:rounded-card px-2.5 sm:px-3 py-1 text-xs sm:text-sm font-semibold flex-shrink-0 ${
 dayTotals.net >= 0
 ? "bg-income/10  text-income "
                        : "bg-expense/10  text-expense "
                    }`}
                  >
                    {dayTotals.net >= 0 ? "Positivo" : "Negativo"}
                  </div>
                )}
              </div>

              <div className="mt-4 sm:mt-6 space-y-2 sm:space-y-3">
                {/* Revenue / Expense mini cards */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="rounded-control sm:rounded-card md:rounded-card border border-border-strong dark:border-border bg-surface bg-surface-strong p-2.5 sm:p-3 md:p-4">
                    <div className="text-2xs sm:text-xs text-muted">
                      Receita
                    </div>
                    <div className="mt-1 sm:mt-1.5 text-sm sm:text-base md:text-lg font-semibold text-income break-all">
                      {formatCurrency(dayTotals.revenue)}
                    </div>
                  </div>
                  <div className="rounded-control sm:rounded-card md:rounded-card border border-border-strong dark:border-border bg-surface bg-surface-strong p-2.5 sm:p-3 md:p-4">
                    <div className="text-2xs sm:text-xs text-muted">
                      Despesa
                    </div>
                    <div className="mt-1 sm:mt-1.5 text-sm sm:text-base md:text-lg font-semibold text-expense break-all">
                      {formatCurrency(dayTotals.expense)}
                    </div>
                  </div>
                </div>

                {/* Net balance */}
                <div className="rounded-control sm:rounded-card md:rounded-card border border-border-strong dark:border-border bg-surface bg-surface-strong p-2.5 sm:p-3 md:p-4">
                  <div className="text-2xs sm:text-xs text-muted">
                    Saldo do dia
                  </div>
                  <div
                    className={`mt-1 sm:mt-1.5 text-sm sm:text-base md:text-xl font-semibold break-all ${
 dayTotals.net >= 0
 ? "text-income "
                        : "text-expense "
                    }`}
                  >
                    {formatCurrency(dayTotals.net)}
                  </div>
                </div>

                {/* Transactions list */}
                <div className="rounded-control sm:rounded-card md:rounded-card border border-border dark:border-border bg-surface dark:bg-surface p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
                    <p className="font-semibold text-sm sm:text-base text-text">
                      Transações
                    </p>
                    <div className="flex items-center gap-2">
                      {loadingDay && (
                        <Loader2 className="h-3 w-3 animate-spin text-muted" />
                      )}
                      <span className="rounded-full bg-surface-strong dark:bg-surface-strong px-2 py-0.5 text-2xs sm:text-xs text-muted">
                        {dayTransactions.length} itens
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 sm:space-y-3 max-h-[40vh] xl:max-h-none overflow-y-auto">
                    {loadingDay && dayTransactions.length === 0 ? (
                      // Skeleton só aparece se não há nada para mostrar ainda
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="rounded-control border border-border-strong dark:border-border bg-surface bg-surface-strong p-3 animate-pulse"
                          >
                            <div className="h-3 bg-surface-strong rounded w-3/4 mb-2" />
                            <div className="h-2 bg-surface-strong dark:bg-surface-strong rounded w-1/2" />
                          </div>
                        ))}
                      </div>
                    ) : dayTransactions.length > 0 ? (
                      dayTransactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="rounded-control sm:rounded-card border border-border-strong dark:border-border bg-surface bg-surface-strong p-2.5 sm:p-3 md:p-4"
                        >
                          <div className="flex items-start justify-between gap-2 sm:gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-text truncate text-xs sm:text-sm md:text-base">
                                {tx.title}
                              </p>
                              <p className="text-2xs sm:text-xs text-muted mt-0.5 sm:mt-1 truncate">
                                {tx.category}
                                {tx.paymentMethod && <> · {tx.paymentMethod}</>}
                                {" · "}
                                {dateBR(tx.date)}
                              </p>
                              {tx.description && (
                                <p className="mt-1 text-2xs sm:text-xs text-muted dark:text-muted leading-relaxed line-clamp-2">
                                  {tx.description}
                                </p>
                              )}
                              <div className="flex flex-wrap gap-1 mt-1">
                                {tx.recurring && (
                                  <span className="inline-flex items-center gap-1 text-2xs sm:text-2xs font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary ">
                                    🔁 {tx.recurringFrequency || "recorrente"}
                                  </span>
                                )}
                                {tx.installmentGroupId &&
                                  (tx.totalInstallments ?? 0) > 1 && (
                                    <span className="inline-flex items-center gap-1 text-2xs sm:text-2xs font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary ">
                                      {tx.installmentNumber}/
                                      {tx.totalInstallments}x
                                    </span>
                                  )}
                              </div>
                            </div>
                            <div
                              className={`font-semibold whitespace-nowrap flex-shrink-0 text-right text-xs sm:text-sm md:text-base ${tx.type === "INCOME" ? "text-income " : "text-expense "}`}
                            >
                              <div>
                                {tx.type === "INCOME" ? "+" : "-"}
                                {currency(tx.amount)}
                              </div>
                              {tx.currency && tx.currency !== "BRL" && (
                                <div className="text-2xs text-muted font-normal">
                                  {tx.currency}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-control sm:rounded-card border border-dashed border-border dark:border-border bg-surface dark:bg-surface-strong/30 p-4 sm:p-6 text-center text-muted text-xs sm:text-sm">
                        {selectedDate
                          ? "Nenhuma transação registrada para este dia."
                          : "Selecione um dia para ver as transações."}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
