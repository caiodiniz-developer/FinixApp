import type { LucideIcon } from "lucide-react";

export interface Achievement {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  unlocked: boolean;
  color: string;
}

/**
 * A small gamification layer — badges computed entirely from data already on
 * the dashboard (streak, savings rate, budget health, goal progress...).
 * Unlocked ones are highlighted; locked ones stay dim as a nudge toward the
 * next one (the hint shows on hover).
 */
export function Achievements({ items }: { items: Achievement[] }) {
  const unlocked = items.filter(a => a.unlocked).length;
  return (
    <section className="card !p-5" data-testid="achievements">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>Conquistas</h3>
        <span className="text-xs num" style={{ color: "var(--color-text-low)" }}>{unlocked} de {items.length}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map(a => (
          <div key={a.id} data-badge title={a.hint}
            className="chip"
            style={a.unlocked
              ? { color: "var(--color-primary)", background: "var(--color-primary-soft)" }
              : { color: "var(--color-text-low)", background: "var(--color-hairline)" }
            }>
            <a.icon className="w-3.5 h-3.5" style={{ opacity: a.unlocked ? 1 : 0.6 }} />
            {a.label}
          </div>
        ))}
      </div>
    </section>
  );
}
