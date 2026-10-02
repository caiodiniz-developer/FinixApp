import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { currency } from "../../utils/format";
import { CalendarDay } from "./types";

// ─── SPENDING HEATMAP ─────────────────────────────────────────────────────────
export function SpendingHeatmap({ days }: { days: CalendarDay[] }) {
  const [hovered, setHovered] = useState<CalendarDay | null>(null);
  if (days.length === 0) return <div className="h-20 flex items-center justify-center text-xs" style={{ color: "var(--color-text-low)" }}>Sem dados</div>;
  const maxE = Math.max(...days.map(d => d.expense), 1);
  const first = new Date(days[0].date + "T12:00:00");
  const cells: (CalendarDay | null)[] = [...Array(first.getDay()).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  const col = (e: number) => {
    if (e === 0) return "var(--color-hairline)";
    const i = Math.pow(e / maxE, 0.5);
    return `rgba(239,${Math.round(68 * (1 - i * 0.7))},${Math.round(68 * (1 - i * 0.7))},${0.1 + i * 0.65})`;
  };
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-0.5">
        {["D","S","T","Q","Q","S","S"].map((d, i) => (
          <div key={i} className="text-center text-2xs font-semibold uppercase" style={{ color: "var(--color-text-low)" }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => (
          <div key={i} className="aspect-square rounded-md transition-all hover:scale-110 hover:ring-1 hover:ring-[var(--color-hairline-strong)] cursor-default"
            style={{ background: day ? col(day.expense) : "transparent" }}
            onMouseEnter={() => day && setHovered(day)} onMouseLeave={() => setHovered(null)}>
            {day && (
              <div className="w-full h-full flex items-center justify-center text-2xs font-medium" style={{ color: "var(--color-text-low)" }}>
                {new Date(day.date + "T12:00:00").getDate()}
              </div>
            )}
          </div>
        ))}
      </div>
      <AnimatePresence>
        {hovered && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-2 flex items-center justify-between rounded-control px-3 py-2 text-xs"
            style={{ background: "var(--color-hairline)", border: "1px solid var(--color-hairline-strong)" }}>
            <span style={{ color: "var(--color-text-muted)" }}>{new Date(hovered.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
            <span className="text-rose-400 font-semibold num">{hovered.expense > 0 ? `- ${currency(hovered.expense)}` : "—"}</span>
            {hovered.revenue > 0 && <span className="text-emerald-400 font-semibold num">+ {currency(hovered.revenue)}</span>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
