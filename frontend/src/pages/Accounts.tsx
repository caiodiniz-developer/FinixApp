import { useEffect, useState } from "react";
import {
  Plus,
  Landmark,
  PiggyBank,
  Wallet,
  TrendingUp,
  Edit2,
  Trash2,
  X,
  Loader2,
  Star,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../services/api";
import { Account } from "../types";
import { currency } from "../utils/format";
import { UpgradeModal } from "../components/UpgradeModal";

const TYPES: { value: Account["type"]; label: string; icon: typeof Landmark }[] = [
  { value: "corrente", label: "Conta corrente", icon: Landmark },
  { value: "poupanca", label: "Poupança", icon: PiggyBank },
  { value: "carteira", label: "Carteira", icon: Wallet },
  { value: "investimento", label: "Investimento", icon: TrendingUp },
];

const iconFor = (type: string) => TYPES.find((t) => t.value === type)?.icon || Wallet;

const schema = yup.object({
  name: yup.string().min(1).required("Nome obrigatório"),
  type: yup
    .string()
    .oneOf(["corrente", "poupanca", "carteira", "investimento"])
    .required(),
  color: yup.string().default("#2563eb"),
  isDefault: yup.boolean().default(false),
});
type Form = yup.InferType<typeof schema>;

export default function Accounts() {
  const [items, setItems] = useState<Account[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const fetchData = async () => setItems((await api.get("/api/accounts")).data);
  useEffect(() => {
    fetchData().catch(() => toast.error("Erro ao carregar contas"));
  }, []);

  const onDelete = async (a: Account) => {
    if (!window.confirm(`Excluir a conta "${a.name}"?`)) return;
    try {
      await api.delete(`/api/accounts/${a.id}`);
      toast.success("Excluída");
      fetchData();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };

  return (
    <div className="space-y-6" data-testid="accounts-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-extrabold tracking-tight">
            Contas
          </h1>
          <p className="text-muted dark:text-muted mt-1">
            Corrente, poupança, carteira — cada uma com seu próprio saldo
          </p>
        </div>
        <button onClick={openNew} className="btn-primary" data-testid="new-account-btn">
          <Plus className="w-4 h-4" /> Nova conta
        </button>
      </div>

      {items === null ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-32" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card text-center py-14">
          <Landmark className="w-12 h-12 mx-auto text-muted" />
          <p className="mt-3 font-semibold text-lg">Nenhuma conta cadastrada</p>
          <p className="text-sm text-muted mt-1">
            Cadastre suas contas para acompanhar o saldo de cada uma.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((a, i) => {
            const Icon = iconFor(a.type);
            const color = a.color || "#2563eb";
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="card relative overflow-hidden"
                data-testid={`account-card-${a.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${color}22` }}
                    >
                      <Icon className="w-5 h-5" style={{ color }} />
                    </div>
                    <div>
                      <h3 className="font-bold flex items-center gap-1.5">
                        {a.name}
                        {a.isDefault && (
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        )}
                      </h3>
                      <p className="text-xs text-muted capitalize">
                        {TYPES.find((t) => t.value === a.type)?.label || a.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      className="btn-ghost !p-2"
                      onClick={() => {
                        setEditing(a);
                        setOpen(true);
                      }}
                      data-testid={`edit-account-${a.id}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      className="btn-ghost !p-2 hover:!text-red-600"
                      onClick={() => onDelete(a)}
                      data-testid={`delete-account-${a.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-xs text-muted mb-1">Saldo</p>
                  <p
                    className={`text-2xl font-display font-bold ${a.balance < 0 ? "text-rose-500" : ""}`}
                  >
                    {currency(a.balance)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {open && (
          <AccountModal
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

function AccountModal({
  editing,
  onClose,
  onSaved,
  onLimitReached,
}: {
  editing: Account | null;
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
          type: editing.type,
          color: editing.color || "#2563eb",
          isDefault: editing.isDefault,
        }
      : ({ type: "corrente", color: "#2563eb", isDefault: false } as any),
  });

  const onSubmit = async (data: Form) => {
    try {
      if (editing) await api.put(`/api/accounts/${editing.id}`, data);
      else await api.post("/api/accounts", data);
      toast.success(editing ? "Atualizada" : "Criada");
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
        data-testid="account-modal"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">
            {editing ? "Editar conta" : "Nova conta"}
          </h2>
          <button onClick={onClose} className="btn-ghost !p-2">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-3" data-testid="account-form">
          <div>
            <label className="text-sm font-medium">Nome</label>
            <input
              {...register("name")}
              className="input mt-1"
              placeholder="Ex: Nubank, Carteira..."
              data-testid="account-name"
            />
            {errors.name && (
              <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">Tipo</label>
            <select {...register("type")} className="input mt-1" data-testid="account-type">
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-sm font-medium">Cor</label>
              <input
                type="color"
                {...register("color")}
                className="input mt-1 h-10 !p-1"
                data-testid="account-color"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer pt-6">
              <input
                type="checkbox"
                {...register("isDefault")}
                className="w-4 h-4 rounded accent-brand-blue"
                data-testid="account-default"
              />
              <span className="text-sm font-medium">Conta padrão</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-outline">
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
              data-testid="account-save"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
