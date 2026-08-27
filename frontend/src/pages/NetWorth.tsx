import { useEffect, useState } from "react";
import { Plus, Wallet2, TrendingUp, Trash2, X, Loader2, Flame } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../services/api";
import { NetWorth as NetWorthData, Investment, InvestmentType, FireSimulation } from "../types";
import { currency } from "../utils/format";

const TYPE_LABELS: Record<InvestmentType, string> = {
  RENDA_FIXA: "Renda Fixa",
  ACOES: "Ações",
  FUNDOS_IMOBILIARIOS: "Fundos Imobiliários",
  CRIPTO: "Cripto",
  TESOURO_DIRETO: "Tesouro Direto",
  OUTRO: "Outro",
};
const TYPE_COLORS: Record<InvestmentType, string> = {
  RENDA_FIXA: "#3B82F6",
  ACOES: "#22C55E",
  FUNDOS_IMOBILIARIOS: "#F97316",
  CRIPTO: "#EAB308",
  TESOURO_DIRETO: "#8B5CF6",
  OUTRO: "#64748B",
};

const schema = yup.object({
  name: yup.string().required("Nome obrigatório"),
  type: yup.string().oneOf(Object.keys(TYPE_LABELS)).required(),
  investedAmount: yup.number().typeError("Valor inválido").min(0).required(),
  currentValue: yup.number().typeError("Valor inválido").min(0).required(),
});
type Form = yup.InferType<typeof schema>;

export default function NetWorthPage() {
  const [netWorth, setNetWorth] = useState<NetWorthData | null>(null);
  const [investments, setInvestments] = useState<Investment[] | null>(null);
  const [fire, setFire] = useState<FireSimulation | null>(null);
  const [open, setOpen] = useState(false);

  const fetchAll = () => {
    api.get("/api/net-worth").then((r) => setNetWorth(r.data)).catch(() => {});
    api.get("/api/investments").then((r) => setInvestments(r.data)).catch(() => {});
    api.get("/api/fire-simulation").then((r) => setFire(r.data)).catch(() => {});
  };
  useEffect(() => { fetchAll(); }, []);

  const onDelete = async (inv: Investment) => {
    if (!window.confirm(`Remover "${inv.name}"?`)) return;
    try {
      await api.delete(`/api/investments/${inv.id}`);
      toast.success("Removido");
      fetchAll();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const pieData = netWorth?.investmentsByType.map((t) => ({
    name: TYPE_LABELS[t.type as InvestmentType] || t.type,
    value: t.value,
    color: TYPE_COLORS[t.type as InvestmentType] || "#64748B",
  })) || [];

  return (
    <div className="space-y-6" data-testid="networth-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-extrabold tracking-tight flex items-center gap-2">
            <Wallet2 className="w-7 h-7 text-brand-blue" /> Patrimônio
          </h1>
          <p className="text-muted mt-1">Contas + investimentos − dívidas. Onde suas finanças realmente estão.</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Novo investimento
        </button>
      </div>

      {netWorth && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card">
            <p className="text-xs text-muted uppercase tracking-wide font-semibold">Patrimônio líquido</p>
            <p className={`text-2xl font-display font-bold mt-1 ${netWorth.netWorth >= 0 ? "text-text" : "text-red-500"}`}>
              {currency(netWorth.netWorth)}
            </p>
          </div>
          <div className="card">
            <p className="text-xs text-muted uppercase tracking-wide font-semibold">Caixa livre</p>
            <p className="text-2xl font-display font-bold mt-1">{currency(netWorth.liquidCash)}</p>
          </div>
          <div className="card">
            <p className="text-xs text-muted uppercase tracking-wide font-semibold">Em metas</p>
            <p className="text-2xl font-display font-bold mt-1">{currency(netWorth.goalsSaved)}</p>
          </div>
          <div className="card">
            <p className="text-xs text-muted uppercase tracking-wide font-semibold">Investido</p>
            <p className="text-2xl font-display font-bold mt-1 text-emerald-500">{currency(netWorth.investedTotal)}</p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Investimentos */}
        <div className="card">
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5" /> Investimentos
          </h2>
          {investments === null ? (
            <div className="skeleton h-32 mt-4" />
          ) : investments.length === 0 ? (
            <p className="text-sm text-muted mt-4">Nenhum investimento cadastrado ainda.</p>
          ) : (
            <>
              {pieData.length > 0 && (
                <div className="mt-4">
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70}>
                        {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => currency(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="mt-3 space-y-2">
                {investments.map((inv) => {
                  const gain = inv.currentValue - inv.investedAmount;
                  return (
                    <div key={inv.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface-strong p-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{inv.name}</p>
                        <p className="text-xs text-muted">{TYPE_LABELS[inv.type]}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold">{currency(inv.currentValue)}</p>
                        <p className={`text-xs ${gain >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                          {gain >= 0 ? "+" : ""}{currency(gain)}
                        </p>
                      </div>
                      <button onClick={() => onDelete(inv)} className="text-muted hover:text-red-500 shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* FIRE */}
        <div className="card">
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" /> Independência financeira
          </h2>
          {fire ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-surface-strong p-4">
                <p className="text-xs text-muted">Seu "número FIRE" (25x gasto anual, regra dos 4%)</p>
                <p className="text-xl font-bold mt-1">{currency(fire.fireNumber)}</p>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Poupança média mensal</span>
                <span className={`font-semibold ${fire.monthlySavings >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {currency(fire.monthlySavings)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Patrimônio atual</span>
                <span className="font-semibold">{currency(fire.currentNetWorth)}</span>
              </div>
              {fire.yearsToFire !== null ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                  No seu ritmo atual, você chega lá em <strong>{fire.yearsToFire} anos</strong>.
                </div>
              ) : (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                  No ritmo atual de poupança, esse número ainda não é alcançável — aumentar a poupança mensal muda essa conta.
                </div>
              )}
              <p className="text-[11px] text-muted">
                Cálculo conservador: não assume rendimento dos investimentos, só o que você guarda por mês.
              </p>
            </div>
          ) : (
            <div className="skeleton h-32 mt-4" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {open && <InvestmentModal onClose={() => setOpen(false)} onSaved={() => { setOpen(false); fetchAll(); }} />}
      </AnimatePresence>
    </div>
  );
}

function InvestmentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: yupResolver(schema) as any,
    defaultValues: { type: "TESOURO_DIRETO" } as any,
  });

  const onSubmit = async (data: Form) => {
    try {
      await api.post("/api/investments", data);
      toast.success("Investimento adicionado!");
      onSaved();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        className="bg-surface dark:bg-surface-strong rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Novo investimento</h2>
          <button onClick={onClose} className="btn-ghost !p-2"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-3">
          <div>
            <label className="text-sm font-medium">Nome</label>
            <input {...register("name")} className="input mt-1" placeholder="Ex: Tesouro Selic 2029" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium">Tipo</label>
            <select {...register("type")} className="input mt-1">
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Valor investido (R$)</label>
              <input type="number" step="0.01" {...register("investedAmount")} className="input mt-1" />
              {errors.investedAmount && <p className="text-xs text-red-500 mt-1">{errors.investedAmount.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Valor atual (R$)</label>
              <input type="number" step="0.01" {...register("currentValue")} className="input mt-1" />
              {errors.currentValue && <p className="text-xs text-red-500 mt-1">{errors.currentValue.message}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-outline">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
