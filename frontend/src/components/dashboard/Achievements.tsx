import { useEffect, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { gsap } from "../../lib/gsap";

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
 * Unlocked badges pop in with a GSAP stagger the first time the strip
 * scrolls into view; locked ones stay dim as a nudge toward what's next.
 */
export function Achievements({ items }: { items: Achievement[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(el.querySelectorAll("[data-badge]"), { opacity: 1, scale: 1 });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el.querySelectorAll("[data-badge]"),
        { opacity: 0, scale: 0.6, y: 10 },
        {
          opacity: 1, scale: 1, y: 0,
          duration: 0.5, stagger: 0.06, ease: "back.out(2.2)",
          scrollTrigger: { trigger: el, start: "top 90%", toggleActions: "play none none none" },
        },
      );
    }, ref);
    return () => ctx.revert();
  }, [items.length]);

  return (
    <div ref={ref} className="flex flex-wrap gap-2" data-testid="achievements">
      {items.map(a => (
        <div key={a.id} data-badge title={a.hint}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-transform hover:-translate-y-0.5"
          style={a.unlocked
            ? { color: a.color, background: `${a.color}14`, border: `1px solid ${a.color}35` }
            : { color: "var(--color-text-low)", background: "var(--color-hairline)", border: "1px solid var(--color-border)" }
          }>
          <a.icon className="w-3.5 h-3.5" style={{ opacity: a.unlocked ? 1 : 0.5 }} />
          {a.label}
        </div>
      ))}
    </div>
  );
}
