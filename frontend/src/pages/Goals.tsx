import { useEffect, useState } from "react";
import {
  Plus,
  Target,
  Edit2,
  Trash2,
  X,
  Loader2,
  CalendarDays,
  Trophy,
  UserPlus,
  Users,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../services/api";
import { Goal, GoalInvite } from "../types";
import { currency, dateBR, dateISOForInput } from "../utils/format";

const schema = yup.object({
  title: yup.string().required("Título obrigatório"),
  targetAmount: yup.number().typeError("Valor inválido").positive().required(),
  currentAmount: yup.number().typeError("Valor inválido").min(0).default(0),
  deadline: yup.string().required("Prazo obrigatório"),
});
type Form = yup.InferType<typeof schema>;

function forecast(g: Goal): string {
  const now = new Date();
  const dl = new Date(g.deadline);
  const daysLeft = Math.max(
    1,
    Math.ceil((dl.getTime() - now.getTime()) / 86400000),
  );
  const remaining = Math.max(0, g.targetAmount - g.currentAmount);
  const perDay = remaining / daysLeft;
  const perMonth = perDay * 30;
  if (remaining === 0) return "Meta concluída! 🎉";
  return `R$ ${perMonth.toFixed(0)}/mês até ${dateBR(g.deadline)}`;
}

export default function Goals() {
  const [items, setItems] = useState<Goal[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [inviteFor, setInviteFor] = useState<Goal | null>(null);
  const [invites, setInvites] = useState<GoalInvite[]>([]);

  const fetchData = async () => {
    const r = await api.get("/api/goals");
    setItems(r.data);
  };
  const fetchInvites = async () => {
    try {
      const r = await api.get("/api/goals/invites");
      setInvites(r.data);
    } catch {
      /* not critical to the page render */
    }
  };
  useEffect(() => {
    fetchData().catch(() => toast.error("Erro ao carregar"));
    fetchInvites();
  }, []);

  const onDelete = async (g: Goal) => {
    if (!window.confirm(`Excluir meta "${g.title}"?`)) return;
    try {
      await api.delete(`/api/goals/${g.id}`);
      toast.success("Excluída");
      fetchData();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const respondInvite = async (invite: GoalInvite, accept: boolean) => {
    try {
      await api.post(`/api/goals/invites/${invite.id}/${accept ? "accept" : "decline"}`);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      if (accept) {
        toast.success("Meta compartilhada adicionada!");
        fetchData();
      }
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  return (
    <div className="space-y-6" data-testid="goals-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-extrabold tracking-tight">
            Metas
          </h1>
          <p className="text-muted dark:text-muted mt-1">
            Defina objetivos e acompanhe seu progresso
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="btn-primary"
          data-testid="new-goal-btn"
        >
          <Plus className="w-4 h-4" /> Nova meta
        </button>
      </div>

      {invites.length > 0 && (
        <div className="card space-y-2">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4" /> Convites de metas compartilhadas
          </p>
          {invites.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-strong p-3 text-sm">
              <span>
                <strong>{inv.sender?.name || inv.sender?.email}</strong> te convidou para "{inv.goal?.title}"
              </span>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => respondInvite(inv, true)} className="btn-primary !py-1.5 !px-3 text-xs">
                  <Check className="w-3.5 h-3.5" /> Aceitar
                </button>
                <button onClick={() => respondInvite(inv, false)} className="btn-outline !py-1.5 !px-3 text-xs">
                  Recusar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {items === null ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-40" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card text-center py-14">
          <Target className="w-12 h-12 mx-auto text-muted" />
          <p className="mt-3 font-semibold text-lg">Nenhuma meta ainda</p>
          <p className="text-sm text-muted mt-1">
            Crie sua primeira meta e transforme desejos em planos.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((g, i) => {
            const pct = Math.min(100, (g.currentAmount / g.targetAmount) * 100);
            const done = pct >= 100;
            return (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card relative overflow-hidden"
                data-testid={`goal-card-${g.id}`}
              >
                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gradient-to-br from-brand-blue/20 to-brand-purple/20 blur-2xl" />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {done ? (
                        <Trophy className="w-5 h-5 text-amber-500" />
                      ) : (
                        <Target className="w-5 h-5 text-brand-blue" />
                      )}
                      <h3 className="font-display font-bold truncate">
                        {g.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted mt-1">
                      <CalendarDays className="w-3.5 h-3.5" />{" "}
                      {dateBR(g.deadline)}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      className="btn-ghost !p-2"
                      onClick={() => setInviteFor(g)}
                      title="Convidar alguém para esta meta"
                      data-testid={`invite-goal-${g.id}`}
                    >
                      <UserPlus className="w-4 h-4" />
                    </button>
                    <button
                      className="btn-ghost !p-2"
                      onClick={() => {
                        setEditing(g);
                        setOpen(true);
                      }}
                      data-testid={`edit-goal-${g.id}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      className="btn-ghost !p-2 hover:!text-red-600"
                      onClick={() => onDelete(g)}
                      data-testid={`delete-goal-${g.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {g.members && g.members.length > 0 && (
                  <div className="relative flex items-center gap-1.5 mt-2 text-xs text-muted">
                    <Users className="w-3.5 h-3.5" />
                    {g.members.map((m) => m.user?.name).filter(Boolean).join(", ")}
                  </div>
                )}
                <div className="relative mt-5">
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-2xl font-display font-bold">
                      {currency(g.currentAmount)}
                    </span>
                    <span className="text-sm text-muted">
                      de {currency(g.targetAmount)}
                    </span>
                  </div>
                  <div className="h-3 bg-surface dark:bg-surface-strong rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-full rounded-full ${done ? "bg-gradient-to-r from-amber-400 to-orange-500" : "bg-gradient-to-r from-brand-blue to-brand-purple"}`}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs">
                    <span className="font-semibold text-brand-blue">
                      {pct.toFixed(0)}% concluído
                    </span>
                    <span className="text-muted">{forecast(g)}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {open && (
          <GoalModal
            key={editing?.id || "new"}
            editing={editing}
            onClose={() => setOpen(false)}
            onSaved={() => {
              setOpen(false);
              fetchData();
            }}
          />
        )}
        {inviteFor && (
          <InviteModal goal={inviteFor} onClose={() => setInviteFor(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function InviteModal({ goal, onClose }: { goal: Goal; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const onInvite = async () => {
    if (!email) return;
    setSending(true);
    try {
      await api.post(`/api/goals/${goal.id}/invite`, { email });
      toast.success("Convite enviado!");
      onClose();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setSending(false);
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
        className="bg-surface dark:bg-surface-strong rounded-2xl shadow-2xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Convidar para "{goal.title}"</h2>
          <button onClick={onClose} className="btn-ghost !p-2">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-muted mt-2">
          A pessoa precisa já ter uma conta Finix com esse e-mail para aceitar o convite.
        </p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input mt-4"
          placeholder="email@exemplo.com"
          autoFocus
        />
        <button onClick={onInvite} disabled={sending || !email} className="btn-primary w-full mt-4">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar convite"}
        </button>
      </motion.div>
    </motion.div>
  );
}

function GoalModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: Goal | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: yupResolver(schema) as any,
    defaultValues: editing
      ? {
          title: editing.title,
          targetAmount: editing.targetAmount,
          currentAmount: editing.currentAmount,
          deadline: dateISOForInput(editing.deadline),
        }
      : ({
          currentAmount: 0,
          deadline: dateISOForInput(
            new Date(Date.now() + 180 * 86400000).toISOString(),
          ),
        } as any),
  });

  const onSubmit = async (data: Form) => {
    try {
      const payload = {
        ...data,
        deadline: new Date(data.deadline).toISOString(),
      };
      if (editing) await api.put(`/api/goals/${editing.id}`, payload);
      else await api.post("/api/goals", payload);
      toast.success(editing ? "Atualizada" : "Criada");
      onSaved();
    } catch (e) {
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
        className="bg-surface dark:bg-surface-strong rounded-2xl shadow-2xl w-full max-w-lg p-6"
        onClick={(e) => e.stopPropagation()}
        data-testid="goal-modal"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">
            {editing ? "Editar meta" : "Nova meta"}
          </h2>
          <button onClick={onClose} className="btn-ghost !p-2">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-5 space-y-3"
          data-testid="goal-form"
        >
          <div>
            <label className="text-sm font-medium">Título</label>
            <input
              {...register("title")}
              className="input mt-1"
              data-testid="goal-title"
            />
            {errors.title && (
              <p className="text-xs text-red-500 mt-1">
                {errors.title.message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Meta (R$)</label>
              <input
                type="number"
                step="0.01"
                {...register("targetAmount")}
                className="input mt-1"
                data-testid="goal-target"
              />
              {errors.targetAmount && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.targetAmount.message}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Já guardado (R$)</label>
              <input
                type="number"
                step="0.01"
                {...register("currentAmount")}
                className="input mt-1"
                data-testid="goal-current"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Prazo</label>
            <input
              type="date"
              {...register("deadline")}
              className="input mt-1"
              data-testid="goal-deadline"
            />
            {errors.deadline && (
              <p className="text-xs text-red-500 mt-1">
                {errors.deadline.message}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-outline">
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting}
              data-testid="goal-save"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Salvar"
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
