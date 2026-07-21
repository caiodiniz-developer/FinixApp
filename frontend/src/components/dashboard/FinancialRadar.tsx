import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ResponsiveContainer, Tooltip,
} from "recharts";

export interface RadarAxis { label: string; value: number; }

/**
 * "Raio-X financeiro" — a five-axis snapshot of the same signals that feed
 * the health score (savings rate, spend control, budget health, streak,
 * runway), visualized as a single shape instead of five separate numbers.
 */
export function FinancialRadar({ axes }: { axes: RadarAxis[] }) {
  const data = axes.map(a => ({ subject: a.label, value: Math.round(Math.min(100, Math.max(0, a.value))) }));
  return (
    <div className="h-52">
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="var(--color-hairline-strong)" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--color-text-muted)", fontSize: 10 }} />
          <Radar dataKey="value" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.28} strokeWidth={2} />
          <Tooltip
            formatter={(v: number) => [`${v}/100`, "Score"]}
            contentStyle={{ borderRadius: 10, border: "1px solid var(--color-border-strong)", background: "var(--color-surface)", color: "var(--color-text)", boxShadow: "var(--color-shadow)", fontSize: 11 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
