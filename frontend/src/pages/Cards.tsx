import { useEffect, useState } from "react";
import {
  Plus,
  CreditCard as CardIcon,
  Edit2,
  Trash2,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ArrowDownRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../services/api";
import { CreditCard, Transaction } from "../types";
import { currency, dateBR } from "../utils/format";
import { UpgradeModal } from "../components/UpgradeModal";

const schema = yup.object({
  name: yup.string().min(1).required("Nome obrigatório"),
  brand: yup.string().default(""),
  limit: yup.number().typeError("Valor inválido").min(0).default(0),
  closingDay: yup.number().typeError("Dia inválido").min(1).max(31).required(),
  dueDay: yup.number().typeError("Dia inválido").min(1).max(31).required(),
  color: yup.string().default("#7c3aed"),
});
type Form = yup.InferType<typeof schema>;

const shiftMonth = (ref: string, delta: number) => {
  const [y, m] = ref.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const monthLabel = (ref: string) => {
  const [y, m] = ref.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

export default function Cards() {
  const [items, setItems] = useState<CreditCard[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CreditCard | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statementMonth, setStatementMonth] = useState<string>("");
  const [statement, setStatement] = useState<{ total: number; dueDate: string; transactions: Transaction[] } | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const fetchData = async () => setItems((await api.get("/api/cards")).data);
  useEffect(() => {
    fetchData().catch((e) => {
      if (e?.response?.data?.upgrade) setItems([]);
      else toast.error("Erro ao carregar cartões");
    });
  }, []);

  const onDelete = async (c: CreditCard) => {
    if (!window.confirm(`Excluir o cartão "${c.name}"?`)) return;
    try {
      await api.delete(`/api/cards/${c.id}`);
      toast.success("Excluído");
      if (expanded === c.id) setExpanded(null);
      fetchData();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const toggleExpand = (c: CreditCard) => {
    if (expanded === c.id) {
      setExpanded(null);
      return;
    }
    setExpanded(c.id);
    setStatementMonth(c.currentStatement.referenceMonth);
  };

  const fetchStatement = async (card: CreditCard, month: string) => {
    setStatementLoading(true);
    try {
      const r = await api.get(`/api/cards/${card.id}/statements/${month}`);
      setStatement(r.data);
    } catch {
      toast.error("Erro ao carregar fatura");
    } finally {
      setStatementLoading(false);
    }
  };

  useEffect(() => {
    if (!expanded || !statementMonth || !items) return;
    const card = items.find((c) => c.id === expanded);
    if (card) fetchStatement(card, statementMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, statementMonth]);

  return (
    <div className="space-y-6" data-testid="cards-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-extrabold tracking-tight">Cartões</h1>
          <p className="text-muted dark:text-muted mt-1">
            Fatura calculada automaticamente a partir das suas compras no crédito
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="btn-primary"
          data-testid="new-card-btn"
        >
          <Plus className="w-4 h-4" /> Novo cartão
        </button>
      </div>

      {items === null ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton h-44" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card text-center py-14">
          <CardIcon className="w-12 h-12 mx-auto text-muted" />
          <p className="mt-3 font-semibold text-lg">Nenhum cartão cadastrado</p>
          <p className="text-sm text-muted mt-1">
            Cadastre um cartão para acompanhar a fatura sem precisar somar nada na mão.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-5">
          {items.map((c, i) => {
            const daysToDue = Math.ceil(
              (new Date(c.currentStatement.dueDate).getTime() - Date.now()) / 86400000,
            );
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="space-y-0"
                data-testid={`card-tile-${c.id}`}
              >
                <div
                  className="rounded-2xl p-5 text-white relative overflow-hidden shadow-lg cursor-pointer"
                  style={{ background: `linear-gradient(135deg, ${c.color || "#7c3aed"}, ${c.color || "#7c3aed"}cc 60%, #111827)` }}
                  onClick={() => toggleExpand(c)}
                >
                  <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10" />
                  <div className="absolute -right-2 -bottom-10 w-20 h-20 rounded-full bg-white/10" />
                  <div className="relative flex items-start justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-widest opacity-70">
                        {c.brand || "Cartão de crédito"}
                      </p>
                      <h3 className="text-lg font-bold mt-0.5">{c.name}</h3>
                    </div>
                    <div className="flex gap-1">
                      <button
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(c);
                          setOpen(true);
                        }}
                        data-testid={`edit-card-${c.id}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-red-500/60"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(c);
                        }}
                        data-testid={`delete-card-${c.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="relative mt-6">
                    <p className="text-[11px] opacity-70">Fatura atual</p>
                    <p className="text-2xl font-display font-bold">
                      {currency(c.currentStatement.total)}
                    </p>
                  </div>
                  <div className="relative flex items-center justify-between mt-4 text-xs opacity-80">
                    <span>Fecha dia {c.closingDay}</span>
                    <span>
                      Vence {dateBR(c.currentStatement.dueDate)}
                      {daysToDue >= 0 && daysToDue <= 10 ? ` · em ${daysToDue}d` : ""}
                    </span>
                  </div>
                </div>

                <AnimatePresence>
                  {expanded === c.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="card !mt-2 !rounded-t-none overflow-hidden"
                      data-testid={`card-statement-${c.id}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <button
                          className="btn-ghost !p-1.5"
                          onClick={() => setStatementMonth((m) => shiftMonth(m, -1))}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm font-semibold capitalize flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-muted" /> {monthLabel(statementMonth)}
                        </span>
                        <button
                          className="btn-ghost !p-1.5"
                          onClick={() => setStatementMonth((m) => shiftMonth(m, 1))}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                      {statementLoading ? (
                        <div className="skeleton h-16" />
                      ) : !statement || statement.transactions.length === 0 ? (
                        <p className="text-sm text-muted text-center py-6">
                          Nenhuma compra nesse ciclo de fatura.
                        </p>
                      ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800 -mx-1">
                          {statement.transactions.map((t) => (
                            <div key={t.id} className="flex items-center gap-3 px-1 py-2.5">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300">
                                <ArrowDownRight className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{t.title}</p>
                                <p className="text-xs text-muted">{t.category} · {dateBR(t.date)}</p>
                              </div>
                              <span className="text-sm font-bold text-rose-500">
                                {currency(t.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {open && (
          <CardModal
            key={editing?.id || "new"}
            editing={editing}
            onClose={() => setOpen(false)}
            onSaved={() => {
              setOpen(false);
              fetchData();
            }}
            onLimitReached={() => {
              setOpen(false);
              setUpgradeOpen(true);
            }}
          />
        )}
      </AnimatePresence>
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  );
}

function CardModal({
  editing,
  onClose,
  onSaved,
  onLimitReached,
}: {
  editing: CreditCard | null;
  onClose: () => void;
  onSaved: () => void;
  onLimitReached: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: yupResolver(schema) as any,
    defaultValues: editing
      ? {
          name: editing.name,
          brand: editing.brand || "",
          limit: editing.limit,
          closingDay: editing.closingDay,
          dueDay: editing.dueDay,
          color: editing.color || "#7c3aed",
        }
      : ({ brand: "", limit: 0, closingDay: 5, dueDay: 12, color: "#7c3aed" } as any),
  });

  const onSubmit = async (data: Form) => {
    try {
      if (editing) await api.put(`/api/cards/${editing.id}`, data);
      else await api.post("/api/cards", data);
      toast.success(editing ? "Atualizado" : "Criado");
      onSaved();
    } catch (e: any) {
      if (e?.response?.data?.upgrade) {
        toast.error(apiErrorMessage(e));
        onLimitReached();
        return;
      }
      toast.error(apiErrorMessage(e));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-surface dark:bg-surface-strong rounded-2xl shadow-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
        data-testid="card-modal"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">
            {editing ? "Editar cartão" : "Novo cartão"}
          </h2>
          <button onClick={onClose} className="btn-ghost !p-2">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-3" data-testid="card-form">
          <div>
            <label className="text-sm font-medium">Apelido do cartão</label>
            <input
              {...register("name")}
              className="input mt-1"
              placeholder="Ex: Nubank Ultravioleta"
              data-testid="card-name"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium">Bandeira (opcional)</label>
            <input {...register("brand")} className="input mt-1" placeholder="Visa, Master..." data-testid="card-brand" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Fecha dia</label>
              <input type="number" min="1" max="31" {...register("closingDay")} className="input mt-1" data-testid="card-closing-day" />
              {errors.closingDay && <p className="text-xs text-red-500 mt-1">{errors.closingDay.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Vence dia</label>
              <input type="number" min="1" max="31" {...register("dueDay")} className="input mt-1" data-testid="card-due-day" />
              {errors.dueDay && <p className="text-xs text-red-500 mt-1">{errors.dueDay.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Limite (opcional)</label>
              <input type="number" step="0.01" min="0" {...register("limit")} className="input mt-1" data-testid="card-limit" />
            </div>
            <div>
              <label className="text-sm font-medium">Cor</label>
              <input type="color" {...register("color")} className="input mt-1 h-10 !p-1" data-testid="card-color" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-outline">
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting} data-testid="card-save">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
