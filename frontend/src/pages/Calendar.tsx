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
          <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-semibold text-text dark:text-text">
            Calendário Financeiro
          </h1>
          <p className="mt-1 sm:mt-2 text-xs sm:text-sm md:text-base text-muted dark:text-muted">
            Visualize receitas, despesas e saldo diário com navegação mensal.
          </p>
        </div>
        <div className="inline-flex self-start sm:self-auto items-center gap-2 rounded-card border border-border dark:border-border bg-surface dark:bg-surface px-3 py-2 shadow-sm">
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
        <div className="card border border-border dark:border-border bg-surface dark:bg-surface p-8 text-center text-muted">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-brand-blue" />
          Carregando calendário...
        </div>
      ) : error ? (
        <div className="card border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-surface p-6 text-rose-600 dark:text-rose-300">
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
                color: "text-emerald-600 dark:text-emerald-400",
              },
              {
                label: "Despesa",
                value: monthlyTotals.expense,
                color: "text-rose-600 dark:text-rose-400",
              },
              {
                label: "Saldo",
                value: monthlyTotals.net,
                color:
                  monthlyTotals.net >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="card border border-border dark:border-border bg-surface dark:bg-surface p-3 sm:p-4 md:p-6 shadow-sm"
              >
                <div className="text-2xs sm:text-xs sm: text-muted truncate">
                  <span className="sm:hidden">{item.label}</span>
                  <span className="hidden sm:inline">
                    {item.label === "Saldo" ? "Saldo líquido" : item.label}
                  </span>
                </div>
                <div
                  className={`mt-2 text-sm sm:text-base md:text-2xl lg:text-3xl font-semibold ${item.color} break-all`}
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
            <div className="card border border-border dark:border-border bg-surface dark:bg-surface p-3 sm:p-4 shadow-sm">
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
                          className="min-h-[60px] sm:min-h-[80px] md:min-h-[98px] rounded-control sm:rounded-card md:rounded-card border border-border-strong bg-surface dark:bg-surface-strong/20"
                        />
                      );
                    }

                    const date = new Date(day.date + "T12:00:00");
                    const past = isPastOrToday(day.date);
                    const isActive = day.date === selectedDate;
                    const isToday = day.date === todayStr;

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
                          "group flex flex-col gap-1 sm:gap-2 rounded-control sm:rounded-card md:rounded-card border p-1.5 sm:p-2 md:p-3 text-left transition-all min-h-[60px] sm:min-h-[80px] md:min-h-[98px]",
                          !past
                            ? "border-border-strong bg-surface dark:bg-surface-strong/20 opacity-35 cursor-not-allowed"
                            : isActive
                              ? "border-brand-blue/50 bg-brand-blue/10 dark:bg-brand-blue/10 shadow-sm cursor-pointer"
                              : "border-border dark:border-border bg-surface dark:bg-surface hover:border-brand-blue/30 hover:bg-surface dark:hover:bg-surface-strong/60 cursor-pointer",
                        ].join(" ")}
                      >
                        <span className="hidden md:block text-2xs text-muted">
                          {date.toLocaleDateString("pt-BR", {
                            weekday: "short",
                          })}
                        </span>

                        <div className="flex items-center gap-1">
                          <span
                            className={`text-sm sm:text-base md:text-xl font-semibold leading-none ${past ? "text-text" : "text-muted"}`}
                          >
                            {date.getDate()}
                          </span>
                          {isToday && (
                            <span className="h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-brand-blue flex-shrink-0" />
                          )}
                        </div>

                        {past ? (
                          <>
                            <div className="space-y-0.5 text-2xs sm:text-xs leading-tight">
                              {(day.revenue ?? 0) > 0 && (
                                <div className="text-emerald-600 dark:text-emerald-400 font-medium truncate">
                                  +
                                  {new Intl.NumberFormat("pt-BR", {
                                    notation: "compact",
                                    maximumFractionDigits: 1,
                                  }).format(day.revenue)}
                                </div>
                              )}
                              {(day.expense ?? 0) > 0 && (
                                <div className="text-rose-600 dark:text-rose-400 font-medium truncate">
                                  -
                                  {new Intl.NumberFormat("pt-BR", {
                                    notation: "compact",
                                    maximumFractionDigits: 1,
                                  }).format(day.expense)}
                                </div>
                              )}
                              {(day.revenue ?? 0) === 0 &&
                                (day.expense ?? 0) === 0 && (
                                  <div className="text-muted dark:text-muted text-2xs">
                                    —
                                  </div>
                                )}
                            </div>
                            <div
                              className={`mt-auto h-1 sm:h-1.5 rounded-full ${(day.net ?? 0) >= 0 ? "bg-emerald-400" : "bg-rose-400"}`}
                            />
                          </>
                        ) : (
                          <div className="mt-auto h-1 sm:h-1.5 rounded-full bg-surface-strong/50" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="mt-3 sm:mt-4 flex flex-wrap items-center gap-3 sm:gap-4 px-1 text-2xs sm:text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />{" "}
                  Receita
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-400" /> Despesa
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-blue" />{" "}
                  Hoje
                </span>
                <span className="flex items-center gap-1.5 opacity-50">
                  <span className="h-2 w-2 rounded-full bg-surface-strong/50 dark:bg-surface-strong/80" />{" "}
                  Futuros
                </span>
              </div>
            </div>

            {/* Day detail panel */}
            <div className="card border border-border dark:border-border bg-surface dark:bg-surface p-3 sm:p-4 md:p-6 shadow-sm">
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
                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                        : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
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
                    <div className="mt-1 sm:mt-1.5 text-sm sm:text-base md:text-lg font-semibold text-emerald-600 dark:text-emerald-400 break-all">
                      {formatCurrency(dayTotals.revenue)}
                    </div>
                  </div>
                  <div className="rounded-control sm:rounded-card md:rounded-card border border-border-strong dark:border-border bg-surface bg-surface-strong p-2.5 sm:p-3 md:p-4">
                    <div className="text-2xs sm:text-xs text-muted">
                      Despesa
                    </div>
                    <div className="mt-1 sm:mt-1.5 text-sm sm:text-base md:text-lg font-semibold text-rose-600 dark:text-rose-400 break-all">
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
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
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
                                  <span className="inline-flex items-center gap-1 text-2xs sm:text-2xs font-semibold px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                                    🔁 {tx.recurringFrequency || "recorrente"}
                                  </span>
                                )}
                                {tx.installmentGroupId &&
                                  (tx.totalInstallments ?? 0) > 1 && (
                                    <span className="inline-flex items-center gap-1 text-2xs sm:text-2xs font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                      {tx.installmentNumber}/
                                      {tx.totalInstallments}x
                                    </span>
                                  )}
                              </div>
                            </div>
                            <div
                              className={`font-semibold whitespace-nowrap flex-shrink-0 text-right text-xs sm:text-sm md:text-base ${tx.type === "INCOME" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
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
