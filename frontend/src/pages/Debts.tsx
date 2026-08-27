import { useEffect, useState } from "react";
import { Plus, Landmark, Trash2, X, Loader2, TrendingDown, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../services/api";
import { Debt, DebtPayoffStep } from "../types";
import { currency } from "../utils/format";

const schema = yup.object({
  creditor: yup.string().required("Informe o credor"),
  totalAmount: yup.number().typeError("Valor inválido").positive().required(),
  remainingAmount: yup.number().typeError("Valor inválido").min(0).required(),
  interestRate: yup.number().typeError("Valor inválido").min(0).default(0),
  minPayment: yup.number().typeError("Valor inválido").min(0).default(0),
  negotiationUrl: yup.string().url("URL inválida").optional(),
});
type Form = yup.InferType<typeof schema>;

export default function Debts() {
  const [items, setItems] = useState<Debt[] | null>(null);
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<"avalanche" | "snowball">("avalanche");
  const [extraPayment, setExtraPayment] = useState(200);
  const [strategy, setStrategy] = useState<{ order: string[]; payoff: DebtPayoffStep[] } | null>(null);

  const fetchData = async () => {
    const r = await api.get("/api/debts");
    setItems(r.data);
  };
  useEffect(() => {
    fetchData().catch(() => toast.error("Erro ao carregar"));
  }, []);

  useEffect(() => {
    if (!items || items.length === 0) { setStrategy(null); return; }
    api
      .get(`/api/debts/strategy?method=${method}&extraPayment=${extraPayment}`)
      .then((r) => setStrategy(r.data))
      .catch(() => {});
  }, [items, method, extraPayment]);

  const onDelete = async (d: Debt) => {
    if (!window.confirm(`Remover "${d.creditor}"?`)) return;
    try {
      await api.delete(`/api/debts/${d.id}`);
      toast.success("Removida");
      fetchData();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const orderedItems = strategy
    ? strategy.order.map((id) => items?.find((i) => i.id === id)).filter(Boolean) as Debt[]
    : items || [];

  return (
    <div className="space-y-6" data-testid="debts-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-extrabold tracking-tight flex items-center gap-2">
            <Landmark className="w-7 h-7 text-brand-blue" /> Dívidas
          </h1>
          <p className="text-muted mt-1">Priorize por quem cobra mais juros ou por quem está mais perto de quitar.</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Nova dívida
        </button>
      </div>

      {items && items.length > 0 && (
        <div className="card">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex rounded-xl overflow-hidden border border-border">
              <button
                onClick={() => setMethod("avalanche")}
                className={`px-4 py-2 text-sm font-semibold ${method === "avalanche" ? "bg-brand-blue text-white" : "bg-surface text-muted"}`}
              >
                Avalanche (maior juros)
              </button>
              <button
                onClick={() => setMethod("snowball")}
                className={`px-4 py-2 text-sm font-semibold ${method === "snowball" ? "bg-brand-blue text-white" : "bg-surface text-muted"}`}
              >
                Snowball (menor saldo)
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted">Quanto sobra por mês pra pagar a mais?</label>
              <input
                type="number"
                value={extraPayment}
                onChange={(e) => setExtraPayment(Number(e.target.value) || 0)}
                className="input !w-28 !py-1.5"
              />
            </div>
          </div>
        </div>
      )}

      {items === null ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => <div key={i} className="skeleton h-32" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="card text-center py-14">
          <TrendingDown className="w-12 h-12 mx-auto text-muted" />
          <p className="mt-3 font-semibold text-lg">Nenhuma dívida cadastrada</p>
          <p className="text-sm text-muted mt-1">Se você não deve nada, ótimo — nem precisa mexer aqui.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {orderedItems.map((d) => {
            const step = strategy?.payoff.find((p) => p.id === d.id);
            return (
              <motion.div key={d.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card relative">
                {step && (
                  <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-brand-blue text-white text-xs font-bold flex items-center justify-center shadow">
                    {step.order}
                  </div>
                )}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display font-bold truncate">{d.creditor}</h3>
                  <button onClick={() => onDelete(d)} className="btn-ghost !p-1.5 hover:!text-red-600 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-2xl font-display font-bold text-red-500 mt-2">{currency(d.remainingAmount)}</p>
                <p className="text-xs text-muted mt-1">de {currency(d.totalAmount)} · {d.interestRate}% a.m.</p>
                {step && (
                  <p className="text-xs text-brand-blue font-semibold mt-2">
                    Quitação estimada em ~{step.monthsToPayOff} meses nessa ordem
                  </p>
                )}
                {d.negotiationUrl && (
                  <a href={d.negotiationUrl} target="_blank" rel="noreferrer" className="btn-outline w-full mt-3 !py-1.5 text-xs inline-flex items-center justify-center gap-1.5">
                    Negociar <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {open && <DebtModal onClose={() => setOpen(false)} onSaved={() => { setOpen(false); fetchData(); }} />}
      </AnimatePresence>
    </div>
  );
}

function DebtModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: yupResolver(schema) as any,
    defaultValues: { interestRate: 0, minPayment: 0 } as any,
  });

  const onSubmit = async (data: Form) => {
    try {
      await api.post("/api/debts", data);
      toast.success("Dívida adicionada");
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
          <h2 className="font-display text-xl font-bold">Nova dívida</h2>
          <button onClick={onClose} className="btn-ghost !p-2"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-3">
          <div>
            <label className="text-sm font-medium">Credor</label>
            <input {...register("creditor")} className="input mt-1" placeholder="Ex: Cartão Nubank" />
            {errors.creditor && <p className="text-xs text-red-500 mt-1">{errors.creditor.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Valor total (R$)</label>
              <input type="number" step="0.01" {...register("totalAmount")} className="input mt-1" />
              {errors.totalAmount && <p className="text-xs text-red-500 mt-1">{errors.totalAmount.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Falta pagar (R$)</label>
              <input type="number" step="0.01" {...register("remainingAmount")} className="input mt-1" />
              {errors.remainingAmount && <p className="text-xs text-red-500 mt-1">{errors.remainingAmount.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Juros (% ao mês)</label>
              <input type="number" step="0.1" {...register("interestRate")} className="input mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Parcela mínima (R$)</label>
              <input type="number" step="0.01" {...register("minPayment")} className="input mt-1" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Link de negociação (opcional)</label>
            <input {...register("negotiationUrl")} className="input mt-1" placeholder="https://..." />
            {errors.negotiationUrl && <p className="text-xs text-red-500 mt-1">{errors.negotiationUrl.message}</p>}
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
