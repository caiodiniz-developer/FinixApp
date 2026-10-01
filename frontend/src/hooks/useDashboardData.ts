import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Budget, DashboardData, Forecast, Goal } from "../types";
import { AlertItem, CalendarDay, TopExpense } from "../components/dashboard/types";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Everything the dashboard reads from the API, in one place.
 *
 * - `data` (GET /api/dashboard) is the core payload: the page shows a
 *   skeleton until it arrives and an error state if it fails; `reload`
 *   fetches it again.
 * - The secondary widgets (alerts, budgets, goals, calendar, forecast...)
 *   load in parallel and independently: one of them failing — e.g. a 403
 *   because the plan doesn't include it — just leaves that widget empty.
 */
export function useDashboardData(isFree: boolean) {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<{ count: number; alerts: AlertItem[] }>({ count: 0, alerts: [] });
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [calDays, setCalDays] = useState<CalendarDay[]>([]);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [topExpenses, setTopExpenses] = useState<TopExpense[]>([]);

  const reload = useCallback(async () => {
    if (!user) return;
    setError(null);
    setLoading(true);
    try {
      const r = await api.get("/api/dashboard");
      setData(r.data);
    } catch (e) {
      const message = apiErrorMessage(e) || "Erro";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }
    reload();
  }, [user, reload]);

  useEffect(() => {
    if (!user) return;
    const now = new Date();
    const month = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    Promise.allSettled([
      api.get("/api/alerts"),
      api.get("/api/budgets"),
      api.get("/api/goals"),
      api.get("/api/categories"),
      api.get(`/api/calendar?month=${month}`),
      api.get("/api/accounts"),
      api.get("/api/forecast?days=30"),
    ]).then(([al, bu, go, ca, cl, ac, fc]) => {
      if (al.status === "fulfilled") setAlerts(al.value.data);
      if (bu.status === "fulfilled") setBudgets(bu.value.data.slice(0, 4));
      if (go.status === "fulfilled") setGoals(go.value.data.slice(0, 3));
      if (ca.status === "fulfilled") setCategories(ca.value.data.map((c: { name: string }) => c.name));
      if (cl.status === "fulfilled") setCalDays(cl.value.data.dailySummary || []);
      if (ac.status === "fulfilled") setAccounts(ac.value.data);
      if (fc.status === "fulfilled") setForecast(fc.value.data);
    });
  }, [user]);

  // "Maiores gastos" needs the raw transaction list (plan-gated backend-side,
  // same as the Transactions page) — fetched separately so the main
  // dashboard payload stays lean.
  useEffect(() => {
    if (!user || isFree) {
      setTopExpenses([]);
      return;
    }
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const start = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    const end = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(lastDay)}`;
    api
      .get(`/api/transactions?type=EXPENSE&startDate=${start}&endDate=${end}`)
      .then((r) => {
        const list: TopExpense[] = (r.data || [])
          .slice()
          .sort((a: TopExpense, b: TopExpense) => b.amount - a.amount)
          .slice(0, 5);
        setTopExpenses(list);
      })
      .catch(() => setTopExpenses([]));
  }, [user, isFree]);

  return {
    data,
    loading,
    error,
    reload,
    alerts,
    budgets,
    goals,
    categories,
    accounts,
    calDays,
    forecast,
    topExpenses,
  };
}
