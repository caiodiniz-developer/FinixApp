import { Link } from "react-router-dom";
import { X } from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  message?: string;
}

export function UpgradeModal({ open, onClose, message }: UpgradeModalProps) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel w-full max-w-xl p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--color-primary)" }}>
              Recurso bloqueado
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-text">
              Faça upgrade para liberar
            </h2>
          </div>
          <button
            onClick={onClose}
            title="Fechar"
            className="p-2 rounded-control text-muted transition-colors hover:bg-[var(--color-card-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="mt-4 text-muted">
          {message ||
            "Este recurso está disponível somente nos planos pagos. Veja nossos planos e escolha a melhor opção para você."}
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-control border border-border p-4">
            <p className="text-sm font-semibold text-text">Plano Básico</p>
            <p className="mt-1.5 text-sm text-muted">
              Até 500 transações, exportar PDF, calendário e parcelamento.
            </p>
          </div>
          <div className="rounded-control border p-4" style={{ borderColor: "var(--color-primary)", background: "var(--color-primary-soft)" }}>
            <p className="text-sm font-semibold text-text">Plano Pro</p>
            <p className="mt-1.5 text-sm text-muted">
              Transações ilimitadas, exportar Excel e PDF, alertas avançados
              e suporte prioritário.
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button onClick={onClose} className="btn-outline w-full sm:w-auto">
            Fechar
          </button>
          <Link to="/app/plans" onClick={onClose} className="btn-primary w-full sm:w-auto">
            Ver planos
          </Link>
        </div>
      </div>
    </div>
  );
}
