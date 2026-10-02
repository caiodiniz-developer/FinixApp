import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  message?: string;
}

export function UpgradeModal({ open, onClose, message }: UpgradeModalProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-surface-strong/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="w-full max-w-xl rounded-card bg-surface p-8 shadow-2xl"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-brand-blue font-semibold">
                  Recurso bloqueado
                </p>
                <h2 className="mt-2 text-2xl font-display font-bold text-text">
                  Faça upgrade para liberar
                </h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-full border border-border p-2 text-muted hover:bg-surface"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-4 text-muted">
              {message ||
                "Este recurso está disponível somente nos planos pagos. Veja nossos planos e escolha a melhor opção para você."}
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-card border border-border p-5">
                <p className="text-sm font-semibold text-text">Plano Básico</p>
                <p className="mt-2 text-sm text-muted">
                  Até 500 transações, exportar PDF, calendário e parcelamento.
                </p>
              </div>
              <div className="rounded-card border border-border p-5 bg-brand-blue/5">
                <p className="text-sm font-semibold text-text">Plano Pro</p>
                <p className="mt-2 text-sm text-muted">
                  Transações ilimitadas, exportar Excel e PDF, alertas avançados
                  e suporte prioritário.
                </p>
              </div>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <a
                href="/app/plans"
                className="btn-primary w-full text-center sm:w-auto"
              >
                Ver planos
              </a>
              <button
                onClick={onClose}
                className="btn-outline w-full text-center sm:w-auto"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
