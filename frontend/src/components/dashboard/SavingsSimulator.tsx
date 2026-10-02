import { useMemo, useState } from "react";
import { currency } from "../../utils/format";

/**
 * "E se eu poupasse mais?" — a client-side what-if projector. Takes the
 * current month's income/expense and the current balance (already loaded
 * for the dashboard) and lets the user drag an extra-savings percentage to
 * see where their balance would land in 6/12 months, versus today's pace.
 * Pure front-end math — no extra API calls.
 */
export function SavingsSimulator({
  income, expense, balance,
}: { income: number; expense: number; balance: number }) {
  const [extraPct, setExtraPct] = useState(10);

  const { baseline12, boosted12, boosted6, delta12 } = useMemo(() => {
    const monthlyNet = income - expense;
    const extra = income * (extraPct / 100);
    const boostedNet = monthlyNet + extra;
    return {
      baseline12: balance + monthlyNet * 12,
      boosted6: balance + boostedNet * 6,
      boosted12: balance + boostedNet * 12,
      delta12: boostedNet * 12 - monthlyNet * 12,
    };
  }, [income, expense, balance, extraPct]);

  return (
    <section className="card !p-5 h-full">
      <h3 className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>E se eu poupasse mais?</h3>
      <p className="text-xs mt-0.5 mb-5" style={{ color: "var(--color-text-low)" }}>Projeção sobre o ritmo atual de receitas e despesas</p>

      <div className="flex items-center justify-between mb-2">
        <label htmlFor="savings-extra" className="eyebrow">Poupar a mais por mês</label>
        <span className="text-sm font-semibold num" style={{ color: "var(--color-primary)" }}>{extraPct}%</span>
      </div>
      <input
        id="savings-extra"
        type="range" min={0} max={50} step={1} value={extraPct}
        onChange={e => setExtraPct(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: "var(--color-primary)" }}
        data-testid="savings-simulator-slider"
      />

      <div className="grid grid-cols-2 gap-3 mt-5">
        {[["Em 6 meses", boosted6], ["Em 12 meses", boosted12]].map(([label, value]) => (
          <div key={label as string} className="rounded-control p-3" style={{ background: "var(--color-card-hover)" }}>
            <span className="eyebrow">{label}</span>
            <p className="text-lg font-semibold num mt-0.5" style={{ color: "var(--color-text)" }}>{currency(value as number)}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 mt-4 text-xs">
        <span style={{ color: "var(--color-text-low)" }}>Mantendo o ritmo atual: {currency(baseline12)}</span>
        <span className="font-medium num" style={{ color: delta12 >= 0 ? "var(--color-income)" : "var(--color-expense)" }}>
          {delta12 >= 0 ? "+" : ""}{currency(delta12)}
        </span>
      </div>
    </section>
  );
}
