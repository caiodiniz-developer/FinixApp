import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, HelpCircle, Undo2 } from "lucide-react";
import { apiErrorMessage } from "../services/api";

// ─── Confirmation dialog ─────────────────────────────────────────────────────
// Replaces the browser's own confirm() box. Call `confirmDialog(...)` from
// anywhere and await the answer; <ConfirmHost /> (mounted once, in App) draws it.

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive action: red button and warning icon. */
  danger?: boolean;
}

interface Pending extends ConfirmOptions {
  resolve: (answer: boolean) => void;
}

let show: ((pending: Pending) => void) | null = null;

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    // No host on screen (should not happen): fall back to the native box.
    if (!show) return resolve(window.confirm(options.title));
    show({ ...options, resolve });
  });
}

export function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    show = setPending;
    return () => { show = null; };
  }, []);

  const answer = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  };

  useEffect(() => {
    if (!pending) return;
    confirmButton.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") answer(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  if (!pending) return null;
  const Icon = pending.danger ? AlertTriangle : HelpCircle;
  const tone = pending.danger ? "var(--color-expense)" : "var(--color-primary)";

  return (
    <div className="modal-overlay !z-[70]" onClick={() => answer(false)} data-testid="confirm-dialog">
      <div className="modal-panel w-full max-w-sm p-6" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4"
          style={{ color: tone, background: pending.danger ? "rgb(var(--c-expense) / 0.1)" : "var(--color-primary-soft)" }}>
          <Icon className="w-5 h-5" />
        </div>
        <h3 id="confirm-title" className="text-base font-semibold" style={{ color: "var(--color-text)" }}>{pending.title}</h3>
        {pending.message && (
          <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "var(--color-text-muted)" }}>{pending.message}</p>
        )}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
          <button className="btn-outline" onClick={() => answer(false)} data-testid="confirm-cancel">
            {pending.cancelLabel ?? "Cancelar"}
          </button>
          <button ref={confirmButton} onClick={() => answer(true)} data-testid="confirm-ok"
            className={pending.danger ? "btn-primary btn-danger-solid" : "btn-primary"}>
            {pending.confirmLabel ?? (pending.danger ? "Excluir" : "Confirmar")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete with "undo" ──────────────────────────────────────────────────────
// The item leaves the screen at once, but the request is only sent after a few
// seconds — time enough to press "Desfazer". Switching tab or leaving the page
// sends what is pending straight away. If the browser is closed before the
// request gets out, the item simply is still there next time: nothing is lost.

const UNDO_MS = 5000;
const pendingCommits = new Map<string, () => void>();

if (typeof window !== "undefined") {
  const flush = () => pendingCommits.forEach((run) => run());
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
}

interface UndoableDelete {
  /** Text of the notice, e.g. `"Mercado" excluída`. */
  message: string;
  /** Take the item off the screen now. */
  hide: () => void;
  /** The real deletion. */
  commit: () => Promise<unknown>;
  /** Reload the list: called after the deletion, after an undo and on error. */
  refresh: () => void;
}

export function deleteWithUndo({ message, hide, commit, refresh }: UndoableDelete) {
  const id = `undo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  hide();

  const run = async () => {
    if (!pendingCommits.delete(id)) return;
    window.clearTimeout(timer);
    try {
      await commit();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
    refresh();
  };
  const timer = window.setTimeout(run, UNDO_MS);
  pendingCommits.set(id, run);

  const undo = () => {
    if (!pendingCommits.delete(id)) return;
    window.clearTimeout(timer);
    toast.dismiss(id);
    refresh();
  };

  toast(
    <span className="flex items-center gap-3">
      <span className="min-w-0 truncate">{message}</span>
      <button onClick={undo} data-testid="undo-delete"
        className="shrink-0 inline-flex items-center gap-1 font-semibold" style={{ color: "var(--color-primary)" }}>
        <Undo2 className="w-3.5 h-3.5" /> Desfazer
      </button>
    </span>,
    { id, duration: UNDO_MS },
  );
}
