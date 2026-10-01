import { currency } from "../../utils/format";

// ─── CHART TOOLTIP ────────────────────────────────────────────────────────────
export const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl p-3"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border-strong)", boxShadow: "var(--color-shadow)", backdropFilter: "blur(12px)" }}>
      <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-text-low)" }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: "var(--color-text-muted)" }}>{p.name}</span>
          <span className="font-bold ml-auto pl-4 num" style={{ color: p.color }}>{currency(p.value)}</span>
        </div>
      ))}
    </div>
  );
};
