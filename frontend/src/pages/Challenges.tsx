import { useEffect, useState } from "react";
import { Plus, Trophy, X, Loader2, Trash2, Users, PlusCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../services/api";
import { Challenge } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { currency, dateBR } from "../utils/format";

const schema = yup.object({
  title: yup.string().required("Título obrigatório"),
  targetAmount: yup.number().typeError("Valor inválido").positive().required(),
  startDate: yup.string().required(),
  endDate: yup.string().required(),
});
type Form = yup.InferType<typeof schema>;

export default function Challenges() {
  const { user } = useAuth();
  const [items, setItems] = useState<Challenge[] | null>(null);
  const [open, setOpen] = useState(false);
  const [addingProgress, setAddingProgress] = useState<Challenge | null>(null);
  const [progressValue, setProgressValue] = useState("");

  const fetchData = async () => {
    const r = await api.get("/api/challenges");
    setItems(r.data);
  };
  useEffect(() => {
    fetchData().catch(() => toast.error("Erro ao carregar"));
  }, []);

  const onDelete = async (c: Challenge) => {
    if (!window.confirm(`Excluir desafio "${c.title}"?`)) return;
    try {
      await api.delete(`/api/challenges/${c.id}`);
      toast.success("Excluído");
      fetchData();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const submitProgress = async () => {
    if (!addingProgress || !progressValue) return;
    try {
      await api.put(`/api/challenges/${addingProgress.id}/progress`, { amount: Number(progressValue) });
      setAddingProgress(null);
      setProgressValue("");
      fetchData();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  return (
    <div className="space-y-6" data-testid="challenges-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-extrabold tracking-tight flex items-center gap-2">
            <Trophy className="w-7 h-7 text-amber-500" /> Desafios em grupo
          </h1>
          <p className="text-muted mt-1">Economize em equipe — quem chega mais perto da meta lidera o ranking.</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Novo desafio
        </button>
      </div>

      {items === null ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => <div key={i} className="skeleton h-40" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="card text-center py-14">
          <Users className="w-12 h-12 mx-auto text-muted" />
          <p className="mt-3 font-semibold text-lg">Nenhum desafio ainda</p>
          <p className="text-sm text-muted mt-1">Crie um e chame os amigos pra economizar junto.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((c) => {
            const ranked = [...c.participants].sort((a, b) => b.progressAmount - a.progressAmount);
            const mine = c.participants.find((p) => p.userId === user?.id);
            const pct = mine ? Math.min(100, (mine.progressAmount / c.targetAmount) * 100) : 0;
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display font-bold truncate">{c.title}</h3>
                  {c.creatorId === user?.id && (
                    <button onClick={() => onDelete(c)} className="btn-ghost !p-1.5 hover:!text-red-600 shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted mt-1">Meta: {currency(c.targetAmount)} até {dateBR(c.endDate)}</p>

                <div className="mt-4 space-y-1.5">
                  {ranked.map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${i === 0 ? "bg-amber-400 text-white" : "bg-surface-strong text-muted"}`}>{i + 1}</span>
                        {p.user?.name || "Participante"} {p.userId === user?.id && "(você)"}
                      </span>
                      <span className="font-semibold">{currency(p.progressAmount)}</span>
                    </div>
                  ))}
                </div>

                {mine && (
                  <div className="mt-3">
                    <div className="h-2 bg-surface-strong rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setAddingProgress(c)}
                  className="btn-outline w-full mt-4 !py-2 text-sm inline-flex items-center justify-center gap-1.5"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Registrar economia
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {open && <ChallengeModal onClose={() => setOpen(false)} onSaved={() => { setOpen(false); fetchData(); }} />}
        {addingProgress && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setAddingProgress(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-surface dark:bg-surface-strong rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="font-display text-lg font-bold">Registrar economia em "{addingProgress.title}"</h2>
              <input
                type="number"
                value={progressValue}
                onChange={(e) => setProgressValue(e.target.value)}
                className="input mt-4"
                placeholder="Quanto você economizou (R$)"
                autoFocus
              />
              <button onClick={submitProgress} disabled={!progressValue} className="btn-primary w-full mt-4">Registrar</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChallengeModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: yupResolver(schema) as any });

  const onSubmit = async (data: Form) => {
    try {
      await api.post("/api/challenges", data);
      toast.success("Desafio criado!");
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
          <h2 className="font-display text-xl font-bold">Novo desafio</h2>
          <button onClick={onClose} className="btn-ghost !p-2"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-3">
          <div>
            <label className="text-sm font-medium">Título</label>
            <input {...register("title")} className="input mt-1" placeholder="Ex: Economizar R$300 em agosto" />
            {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium">Meta (R$)</label>
            <input type="number" step="0.01" {...register("targetAmount")} className="input mt-1" />
            {errors.targetAmount && <p className="text-xs text-red-500 mt-1">{errors.targetAmount.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Início</label>
              <input type="date" {...register("startDate")} className="input mt-1" />
              {errors.startDate && <p className="text-xs text-red-500 mt-1">{errors.startDate.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Fim</label>
              <input type="date" {...register("endDate")} className="input mt-1" />
              {errors.endDate && <p className="text-xs text-red-500 mt-1">{errors.endDate.message}</p>}
            </div>
          </div>
          <p className="text-xs text-muted">Depois de criado, compartilhe o convite de metas ou chame amigos pra participar.</p>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-outline">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
