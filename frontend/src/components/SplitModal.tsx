import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Split, X } from "lucide-react";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../services/api";
import { Contact, Transaction } from "../types";
import { currency } from "../utils/format";

/**
 * "Dividir com contatos" — picks one or more contacts and how much each owes
 * for a given expense, then POSTs to /api/transactions/:id/split. Amounts
 * default to an even split of the transaction total and can be overridden.
 */
export function SplitModal({
  transaction,
  contacts,
  onClose,
  onSaved,
}: {
  transaction: Transaction;
  contacts: Contact[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected],
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      const activeCount = Object.keys(next).filter((k) => next[k]).length || 1;
      const even = (transaction.amount / activeCount).toFixed(2);
      setAmounts((amts) => {
        const updated = { ...amts };
        Object.keys(next).forEach((k) => {
          if (next[k] && !updated[k]) updated[k] = even;
        });
        return updated;
      });
      return next;
    });
  };

  const total = selectedIds.reduce((s, id) => s + (parseFloat(amounts[id]) || 0), 0);

  const submit = async () => {
    if (selectedIds.length === 0) {
      toast.error("Selecione ao menos um contato");
      return;
    }
    setLoading(true);
    try {
      await api.post(`/api/transactions/${transaction.id}/split`, {
        splits: selectedIds.map((id) => ({
          contactId: id,
          amount: parseFloat(amounts[id]) || 0,
        })),
      });
      toast.success("Divisão registrada!");
      onSaved();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setLoading(false);
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
        data-testid="split-modal"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              <Split className="w-4 h-4 text-brand-purple" /> Dividir despesa
            </h2>
            <p className="text-xs text-muted mt-0.5">
              {transaction.title} · {currency(transaction.amount)}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost !p-2">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-2 max-h-64 overflow-y-auto">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 p-2.5 rounded-xl border border-border"
              data-testid={`split-contact-${c.id}`}
            >
              <input
                type="checkbox"
                checked={!!selected[c.id]}
                onChange={() => toggle(c.id)}
                className="w-4 h-4 rounded accent-brand-blue"
              />
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ background: c.color || "#f59e0b" }}
              >
                {c.name.charAt(0).toUpperCase()}
              </div>
              <span className="flex-1 text-sm font-medium truncate">{c.name}</span>
              {selected[c.id] && (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input !w-24 !py-1.5 text-right num"
                  value={amounts[c.id] || ""}
                  onChange={(e) => setAmounts((a) => ({ ...a, [c.id]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>

        {selectedIds.length > 0 && (
          <p className="text-xs text-muted mt-3 text-right">
            Total dividido: <span className="font-semibold text-text">{currency(total)}</span>{" "}
            de {currency(transaction.amount)}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <button type="button" onClick={onClose} className="btn-outline">
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            className="btn-primary"
            disabled={loading}
            data-testid="split-save"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar divisão"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
