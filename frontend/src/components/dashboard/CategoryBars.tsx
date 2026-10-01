import { motion } from "framer-motion";
import { currency, CATEGORY_COLORS } from "../../utils/format";

// ─── CATEGORY BARS ────────────────────────────────────────────────────────────
export function CategoryBars({ categories }: { categories: { category: string; amount: number }[] }) {
  const COLORS = ["#2563eb","#0891b2","#059669","#d97706","#dc2626","#8b5cf6","#0ea5e9","#be185d"];
  if (categories.length === 0) return <div className="h-20 flex items-center justify-center text-xs" style={{ color: "var(--color-text-low)" }}>Sem dados</div>;
  const total = categories.reduce((s, c) => s + c.amount, 0);
  return (
    <div className="space-y-3">
      {categories.slice(0, 6).map((cat, i) => {
        const pct = total > 0 ? (cat.amount / total) * 100 : 0;
        const color = CATEGORY_COLORS[cat.category] || COLORS[i % COLORS.length];
        return (
          <div key={cat.category}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 6px ${color}80` }} />
                <span className="text-xs font-medium truncate max-w-[100px]" style={{ color: "var(--color-text)" }}>{cat.category}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-[10px]" style={{ color: "var(--color-text-low)" }}>{pct.toFixed(0)}%</span>
                <span className="text-xs font-semibold num" style={{ color: "var(--color-text)" }}>{currency(cat.amount)}</span>
              </div>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--color-hairline)" }}>
              <motion.div className="h-full rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}60` }}
                initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                transition={{ duration: 0.9, ease: "easeOut", delay: i * 0.06 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
