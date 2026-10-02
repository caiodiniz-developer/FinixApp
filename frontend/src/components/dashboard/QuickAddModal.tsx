import { useState } from "react";
import { Loader2, X } from "lucide-react";
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
    } catch (e) { toast.error(apiErrorMessage(e) || "Erro"); }
    finally { setLoading(false); }
  };
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold text-base" style={{ color: "var(--color-text)" }}>Nova transação</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-low)" }}>Adicione uma receita ou despesa</p>
          </div>
          <button onClick={onClose} title="Fechar" className="p-2 rounded-control transition-colors hover:bg-[var(--color-card-hover)]" style={{ color: "var(--color-text-low)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-control" style={{ background: "var(--color-hairline-strong)" }}>
            {(["EXPENSE", "INCOME"] as const).map(t => {
              const active = form.type === t;
              return (
                <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t }))}
                  className="py-2 rounded-lg text-sm font-medium transition-colors duration-150"
                  style={active
                    ? { background: t === "EXPENSE" ? "var(--color-expense)" : "var(--color-income)", color: "#fff" }
                    : { color: "var(--color-text-muted)" }}>
                  {t === "EXPENSE" ? "Despesa" : "Receita"}
                </button>
              );
            })}
          </div>
          <input className="input" placeholder="Descrição" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" step="0.01" min="0.01" className="input num" placeholder="Valor em R$" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
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
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar transação"}
          </button>
        </form>
      </div>
    </div>
  );
}
