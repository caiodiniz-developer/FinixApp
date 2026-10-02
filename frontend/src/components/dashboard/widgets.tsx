// ─── HEALTH RING ──────────────────────────────────────────────────────────────
export function HealthRing({ score }: { score: number }) {
  const r = 34, circ = 2 * Math.PI * r, dash = (Math.min(Math.max(score, 0), 100) / 100) * circ;
  const color = score >= 70 ? "var(--color-income)" : score >= 40 ? "var(--color-warning)" : "var(--color-expense)";
  return (
    <div className="relative w-20 h-20">
      <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--color-hairline-strong)" strokeWidth="6" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold leading-none num" style={{ color: "var(--color-text)" }}>{score}</span>
        <span className="text-2xs" style={{ color: "var(--color-text-low)" }}>de 100</span>
      </div>
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
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
    </svg>
  );
}

// ─── METRIC CARD ──────────────────────────────────────────────────────────────
export function MetricCard({ label, value, sub, color, barPct }: { label: string; value: string; sub: string; color: string; barPct?: number }) {
  return (
    <section className="card !p-4 flex flex-col gap-2">
      <span className="eyebrow">{label}</span>
      <p className="text-xl font-semibold num leading-none" style={{ color: "var(--color-text)" }}>{value}</p>
      {barPct !== undefined && (
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-hairline-strong)" }}>
          <div className="h-full rounded-full transition-[width] duration-500" style={{ background: color, width: `${Math.min(Math.max(barPct, 0), 100)}%` }} />
        </div>
      )}
      <p className="text-xs" style={{ color: "var(--color-text-low)" }}>{sub}</p>
    </section>
  );
}
