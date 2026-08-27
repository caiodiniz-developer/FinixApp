import { useEffect, useState } from "react";
import { Sparkles, TrendingUp, TrendingDown, Trophy, Calendar, Receipt } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "../services/api";
import { YearReview as YearReviewData } from "../types";
import { currency } from "../utils/format";

const CURRENT_YEAR = new Date().getFullYear();

export default function YearReview() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [data, setData] = useState<YearReviewData | null>(null);

  useEffect(() => {
    setData(null);
    api.get(`/api/year-review?year=${year}`).then((r) => setData(r.data)).catch(() => {});
  }, [year]);

  return (
    <div className="space-y-6" data-testid="year-review-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-extrabold tracking-tight flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-amber-400" /> Seu ano em números
          </h1>
          <p className="text-muted mt-1">Print e compartilhe se quiser se gabar (ou se cobrar no ano que vem).</p>
        </div>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="input !w-32">
          {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {!data ? (
        <div className="skeleton h-96" />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl overflow-hidden p-8 sm:p-12 text-white relative"
          style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #4c1d95 45%, #7c3aed 100%)" }}
        >
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-amber-400/10 blur-3xl" />

          <div className="relative">
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-white/60">Finix · {data.year}</p>
            <h2 className="text-4xl sm:text-5xl font-display font-extrabold mt-2">
              {data.totalSaved >= 0 ? "Você economizou" : "Suas contas ficaram apertadas em"}
            </h2>
            <p className="text-5xl sm:text-6xl font-display font-black mt-2" style={{ color: data.totalSaved >= 0 ? "#4ade80" : "#f87171" }}>
              {currency(Math.abs(data.totalSaved))}
            </p>

            <div className="grid sm:grid-cols-2 gap-4 mt-10">
              <div className="rounded-2xl p-5 bg-white/10 backdrop-blur">
                <TrendingUp className="w-5 h-5 text-emerald-300 mb-2" />
                <p className="text-xs text-white/60 uppercase tracking-wide">Total recebido</p>
                <p className="text-2xl font-bold mt-1">{currency(data.totalIncome)}</p>
              </div>
              <div className="rounded-2xl p-5 bg-white/10 backdrop-blur">
                <TrendingDown className="w-5 h-5 text-rose-300 mb-2" />
                <p className="text-xs text-white/60 uppercase tracking-wide">Total gasto</p>
                <p className="text-2xl font-bold mt-1">{currency(data.totalExpense)}</p>
              </div>
              {data.topCategory && (
                <div className="rounded-2xl p-5 bg-white/10 backdrop-blur">
                  <Receipt className="w-5 h-5 text-amber-300 mb-2" />
                  <p className="text-xs text-white/60 uppercase tracking-wide">Categoria #1</p>
                  <p className="text-2xl font-bold mt-1">{data.topCategory.category}</p>
                  <p className="text-xs text-white/60 mt-1">{currency(data.topCategory.amount)}</p>
                </div>
              )}
              {data.bestMonth && (
                <div className="rounded-2xl p-5 bg-white/10 backdrop-blur">
                  <Calendar className="w-5 h-5 text-sky-300 mb-2" />
                  <p className="text-xs text-white/60 uppercase tracking-wide">Melhor mês</p>
                  <p className="text-2xl font-bold mt-1">{data.bestMonth.month}</p>
                  <p className="text-xs text-white/60 mt-1">{currency(data.bestMonth.net)}</p>
                </div>
              )}
              {data.goalsCompleted > 0 && (
                <div className="rounded-2xl p-5 bg-white/10 backdrop-blur">
                  <Trophy className="w-5 h-5 text-amber-300 mb-2" />
                  <p className="text-xs text-white/60 uppercase tracking-wide">Metas concluídas</p>
                  <p className="text-2xl font-bold mt-1">{data.goalsCompleted}</p>
                </div>
              )}
              {data.biggestExpense && (
                <div className="rounded-2xl p-5 bg-white/10 backdrop-blur">
                  <p className="text-xs text-white/60 uppercase tracking-wide">Maior gasto único</p>
                  <p className="text-lg font-bold mt-1 truncate">{data.biggestExpense.title}</p>
                  <p className="text-xs text-white/60 mt-1">{currency(data.biggestExpense.amount)}</p>
                </div>
              )}
            </div>

            <p className="mt-10 text-xs text-white/50">{data.transactionCount} transações registradas em {data.year} · finixapp.com.br</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
