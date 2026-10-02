import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { motion } from "framer-motion";
import { api, apiErrorMessage } from "../../services/api";
import { todayISO } from "../../utils/format";
import toast from "react-hot-toast";

// ─── QUICK-ADD MODAL ──────────────────────────────────────────────────────────
export function QuickAddModal({ open, onClose, onAdded, categories, accounts }: {
  open: boolean; onClose: () => void; onAdded: () => void; categories: string[]; accounts: { id: string; name: string }[];
}) {
  const [form, setForm] = useState({ title: "", amount: "", type: "EXPENSE" as "INCOME" | "EXPENSE", category: categories[0] || "Outros", date: todayISO(), accountId: "" });
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/api/transactions", { ...form, amount: parseFloat(form.amount), accountId: form.accountId || null, paymentMethod: "pix", installments: 1 });
      toast.success("Transação adicionada!");
      onAdded(); onClose();
      setForm(f => ({ ...f, title: "", amount: "" }));
    } catch (e: any) { toast.error(apiErrorMessage(e) || "Erro"); }
    finally { setLoading(false); }
  };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(14px)" }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }} transition={{ type: "spring", damping: 26, stiffness: 340 }}
        className="w-full max-w-md rounded-card overflow-hidden"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-hairline-strong)", boxShadow: "0 40px 80px rgba(0,0,0,0.7)" }}
        onClick={e => e.stopPropagation()}>
        {/* header strip */}
        <div className="px-6 pt-5 pb-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-base" style={{ color: "var(--color-text)" }}>Nova transação</h2>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-low)" }}>Adicione uma receita ou despesa</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-control flex items-center justify-center transition-colors hover:bg-[var(--color-hairline)]" style={{ color: "var(--color-text-low)" }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {/* type toggle */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-control" style={{ background: "var(--color-surface-strong)" }}>
            {(["EXPENSE", "INCOME"] as const).map(t => (
              <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t }))}
                className={`py-3 rounded-lg text-xs font-bold transition-all ${form.type === t ? t === "EXPENSE" ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" : "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "opacity-40"}`}
                style={{ color: form.type === t ? undefined : "var(--color-text-muted)" }}>
                {t === "EXPENSE" ? "↓ Despesa" : "↑ Receita"}
              </button>
            ))}
          </div>
          <input className="input w-full" placeholder="Descrição da transação..." value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" step="0.01" min="0.01" className="input num" placeholder="Valor R$" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
            <input type="date" className="input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {(categories.length ? categories : ["Outros"]).map(c => <option key={c}>{c}</option>)}
          </select>
          {accounts.length > 0 && (
            <select className="input" value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}>
              <option value="">Sem conta</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-control text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg,#10b981,#059669)", boxShadow: "0 4px 20px rgba(16,185,129,0.3)" }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Salvar transação"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
