import { motion } from "framer-motion";

// ─── HEALTH RING ──────────────────────────────────────────────────────────────
export function HealthRing({ score }: { score: number }) {
  const r = 38, circ = 2 * Math.PI * r, dash = (score / 100) * circ;
  const color = score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";
  const label = score >= 70 ? "Excelente" : score >= 40 ? "Regular" : "Atenção";
  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      <div className="relative w-20 h-20">
        <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" stroke="var(--color-hairline)" strokeWidth="6" />
          <motion.circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
            initial={{ strokeDasharray: `0 ${circ}` }} animate={{ strokeDasharray: `${dash} ${circ}` }}
            transition={{ duration: 1.3, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0 0 6px ${color}60)` }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span className="text-lg font-black leading-none num" style={{ color }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>{score}</motion.span>
          <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-low)" }}>/100</span>
        </div>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{label}</span>
    </div>
  );
}

// ─── SPARKLINE ────────────────────────────────────────────────────────────────
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1), min = Math.min(...values), range = max - min || 1;
  const W = 60, H = 22;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - ((v - min) / range) * (H - 4) - 2}`).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
    </svg>
  );
}

// ─── METRIC CARD ──────────────────────────────────────────────────────────────
export function MetricCard({ label, value, sub, color, barPct }: { label: string; value: string; sub: string; color: string; barPct?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="rounded-2xl p-4 flex flex-col gap-2"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--color-shadow)" }}>
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-low)" }}>{label}</p>
      <p className="text-xl font-black num leading-none" style={{ color }}>{value}</p>
      {barPct !== undefined && (
        <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--color-hairline)" }}>
          <motion.div className="h-full rounded-full" style={{ background: color }}
            initial={{ width: 0 }} animate={{ width: `${Math.min(barPct, 100)}%` }}
            transition={{ duration: 0.9 }} />
        </div>
      )}
      <p className="text-[10px]" style={{ color: "var(--color-text-low)" }}>{sub}</p>
    </motion.div>
  );
}
