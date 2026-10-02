import { currency } from "../../utils/format";

interface TooltipEntry { name: string; value: number; color: string; }

// ─── CHART TOOLTIP ────────────────────────────────────────────────────────────
export const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-control p-3">
      <p className="text-xs font-medium mb-1.5" style={{ color: "var(--color-text-low)" }}>{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: "var(--color-text-muted)" }}>{p.name}</span>
          <span className="font-medium ml-auto pl-4 num" style={{ color: "var(--color-text)" }}>{currency(p.value)}</span>
        </div>
      ))}
    </div>
  );
};
