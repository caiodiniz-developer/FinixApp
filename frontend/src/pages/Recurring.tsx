import { useEffect, useState } from "react";
import { Plus, Repeat, Trash2, X, Loader2, Pause, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../services/api";
import { confirmDialog, deleteWithUndo } from "../components/confirm";
import { RecurringTransaction } from "../types";
import { currency, dateBR, dateISOForInput } from "../utils/format";

const schema = yup.object({
  title: yup.string().required("Título obrigatório"),
  amount: yup.number().typeError("Valor inválido").positive().required(),
  type: yup.string().oneOf(["INCOME", "EXPENSE"]).required(),
  category: yup.string().required("Categoria obrigatória"),
  frequency: yup.string().oneOf(["weekly", "monthly", "yearly"]).required(),
  startDate: yup.string().required("Data obrigatória"),
});
type Form = yup.InferType<typeof schema>;

const FREQUENCY_LABEL: Record<string, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
  yearly: "Anual",
};

export default function Recurring() {
  const [items, setItems] = useState<RecurringTransaction[] | null>(null);
  const [open, setOpen] = useState(false);

  const fetchData = async () => {
    const r = await api.get("/api/recurring");
    setItems(r.data);
  };
  useEffect(() => {
    fetchData().catch(() => toast.error("Erro ao carregar"));
  }, []);

  const toggleActive = async (r: RecurringTransaction) => {
    try {
      await api.put(`/api/recurring/${r.id}`, { active: !r.active });
      fetchData();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const onDelete = async (r: RecurringTransaction) => {
    if (!(await confirmDialog({ title: `Excluir a recorrência "${r.title}"?`, message: "As transações que ela já criou continuam no histórico.", danger: true }))) return;
    deleteWithUndo({
      message: `Recorrência "${r.title}" excluída`,
      hide: () => setItems((list) => list?.filter((i) => i.id !== r.id) ?? null),
      commit: () => api.delete(`/api/recurring/${r.id}`),
      refresh: fetchData,
    });
  };

  return (
    <div className="space-y-6" data-testid="recurring-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Recorrências</h1>
          <p className="page-subtitle">
            Transações que se repetem sozinhas — aluguel, assinatura, salário. O Finix cria a transação automaticamente em cada ciclo.
          </p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary" data-testid="new-recurring-btn">
          <Plus className="w-4 h-4" /> Nova recorrência
        </button>
      </div>

      {items === null ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => <div key={i} className="skeleton h-28" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <Repeat className="w-8 h-8" />
          <p className="empty-state-title mt-1">Nenhuma recorrência ainda</p>
          <p className="text-sm max-w-sm">
            Cadastre contas fixas para não esquecer de lançá-las todo mês.
          </p>
          <button onClick={() => setOpen(true)} className="btn-primary mt-3">
            <Plus className="w-4 h-4" /> Nova recorrência
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((r) => (
            <div key={r.id} className="card" data-testid={`recurring-card-${r.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display font-semibold truncate">{r.title}</h3>
                  <p className="text-xs text-muted mt-1">
                    {FREQUENCY_LABEL[r.frequency]} · {r.category}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button className="btn-ghost !p-2" onClick={() => toggleActive(r)} title={r.active ? "Pausar" : "Retomar"}>
                    {r.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button className="btn-ghost !p-2 hover:!text-expense" onClick={() => onDelete(r)}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <span className={`text-xl font-display font-semibold ${r.type === "EXPENSE" ? "text-expense" : "text-income"}`}>
                  {r.type === "EXPENSE" ? "-" : "+"}{currency(r.amount)}
                </span>
                <span className={`text-xs font-semibold rounded-full px-2 py-1 ${r.active ? "bg-income/10 text-income" : "bg-surface-strong text-muted"}`}>
                  {r.active ? "Ativa" : "Pausada"}
                </span>
              </div>
              <p className="text-xs text-muted mt-2">Próxima: {dateBR(r.nextRunDate)}</p>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {open && (
          <RecurringModal onClose={() => setOpen(false)} onSaved={() => { setOpen(false); fetchData(); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function RecurringModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: yupResolver(schema) as any,
    defaultValues: {
      type: "EXPENSE",
      frequency: "monthly",
      startDate: dateISOForInput(),
    } as any,
  });

  const onSubmit = async (data: Form) => {
    try {
      await api.post("/api/recurring", { ...data, startDate: new Date(data.startDate).toISOString() });
      toast.success("Recorrência criada!");
      onSaved();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="modal-overlay" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        className="modal-panel w-full max-w-lg p-6"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Nova recorrência</h2>
          <button onClick={onClose} className="btn-ghost !p-2"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-3">
          <div>
            <label className="text-sm font-medium">Título</label>
            <input {...register("title")} aria-invalid={!!errors.title} className="input mt-1" placeholder="Ex: Aluguel" />
            {errors.title && <p className="text-xs text-expense mt-1">{errors.title.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Valor (R$)</label>
              <input type="number" step="0.01" {...register("amount")} aria-invalid={!!errors.amount} className="input mt-1" />
              {errors.amount && <p className="text-xs text-expense mt-1">{errors.amount.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Tipo</label>
              <select {...register("type")} aria-invalid={!!errors.type} className="input mt-1">
                <option value="EXPENSE">Despesa</option>
                <option value="INCOME">Receita</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Categoria</label>
              <input {...register("category")} aria-invalid={!!errors.category} className="input mt-1" placeholder="Ex: Moradia" />
              {errors.category && <p className="text-xs text-expense mt-1">{errors.category.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Frequência</label>
              <select {...register("frequency")} aria-invalid={!!errors.frequency} className="input mt-1">
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
                <option value="yearly">Anual</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Primeira ocorrência</label>
            <input type="date" {...register("startDate")} aria-invalid={!!errors.startDate} className="input mt-1" />
            {errors.startDate && <p className="text-xs text-expense mt-1">{errors.startDate.message}</p>}
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
