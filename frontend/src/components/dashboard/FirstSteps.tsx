import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronRight, X } from "lucide-react";
import { ProgressBar } from "../motion";

export interface Step {
  id: string;
  title: string;
  hint: string;
  done: boolean;
  /** Where the step is done: a route… */
  to?: string;
  /** …or an action on this screen. */
  onClick?: () => void;
}

const dismissedKey = (userId: string) => `finix_first_steps_dismissed_${userId}`;

/**
 * Guided first access: the three or four things that make the app useful,
 * ticked off as they happen. Goes away by itself once everything is done (or
 * when dismissed) and never comes back for that account on this device.
 */
export function FirstSteps({ userId, steps }: { userId: string; steps: Step[] }) {
  const [dismissed, setDismissed] = useState(() => window.localStorage.getItem(dismissedKey(userId)) === "1");
  const done = steps.filter((s) => s.done).length;
  if (dismissed || done === steps.length) return null;

  const dismiss = () => {
    window.localStorage.setItem(dismissedKey(userId), "1");
    setDismissed(true);
  };
  const next = steps.find((s) => !s.done);

  return (
    <section className="glass rounded-card p-5" data-testid="first-steps">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Primeiros passos</h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-low)" }}>
            {done} de {steps.length} concluídos — leva menos de dois minutos.
          </p>
        </div>
        <button onClick={dismiss} title="Dispensar" className="btn-icon -mt-1 -mr-1" data-testid="first-steps-dismiss">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="mt-3"><ProgressBar pct={(done / steps.length) * 100} color="var(--color-primary)" /></div>
      <ol className="stagger mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => {
          const isNext = step === next;
          const body = (
            <>
              <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold num"
                style={step.done
                  ? { background: "rgb(var(--c-income) / 0.14)", color: "var(--color-income)" }
                  : isNext
                    ? { background: "rgb(var(--c-primary-solid))", color: "#fff" }
                    : { background: "var(--color-hairline-strong)", color: "var(--color-text-low)" }}>
                {step.done ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-medium ${step.done ? "line-through" : ""}`}
                  style={{ color: step.done ? "var(--color-text-low)" : "var(--color-text)" }}>{step.title}</span>
                <span className="block text-xs mt-0.5" style={{ color: "var(--color-text-low)" }}>{step.hint}</span>
              </span>
              {!step.done && <ChevronRight className="w-4 h-4 shrink-0 mt-1" style={{ color: "var(--color-text-low)" }} />}
            </>
          );
          const className = `pressable w-full flex items-start gap-3 rounded-control p-3 text-left transition-colors ${step.done ? "" : "hover:bg-[var(--color-card-hover)]"}`;
          const style = { border: `1px solid ${isNext ? "rgb(var(--c-primary) / 0.4)" : "var(--color-border)"}` };
          return (
            <li key={step.id}>
              {step.done ? <div className={className} style={style}>{body}</div>
                : step.to ? <Link to={step.to} className={className} style={style}>{body}</Link>
                : <button onClick={step.onClick} className={className} style={style}>{body}</button>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
