import { currency, CATEGORY_COLORS } from "../../utils/format";

const COLORS = ["#2563eb", "#0891b2", "#059669", "#d97706", "#dc2626", "#0ea5e9", "#64748b", "#be185d"];

// ─── CATEGORY BARS ────────────────────────────────────────────────────────────
export function CategoryBars({ categories }: { categories: { category: string; amount: number }[] }) {
  if (categories.length === 0) return <div className="h-20 flex items-center justify-center text-xs" style={{ color: "var(--color-text-low)" }}>Sem dados</div>;
  const total = categories.reduce((s, c) => s + c.amount, 0);
  return (
    <div className="space-y-3.5">
      {categories.slice(0, 6).map((cat, i) => {
        const pct = total > 0 ? (cat.amount / total) * 100 : 0;
        const color = CATEGORY_COLORS[cat.category] || COLORS[i % COLORS.length];
        return (
          <div key={cat.category}>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-sm font-medium truncate" style={{ color: "var(--color-text)" }}>{cat.category}</span>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <span className="text-xs num" style={{ color: "var(--color-text-low)" }}>{pct.toFixed(0)}%</span>
                <span className="text-sm font-medium num" style={{ color: "var(--color-text)" }}>{currency(cat.amount)}</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-hairline-strong)" }}>
              <div className="h-full rounded-full transition-[width] duration-500" style={{ background: color, width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
