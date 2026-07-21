import { useMemo, useState } from "react";
import { PiggyBank } from "lucide-react";
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
    <div className="rounded-2xl p-5 transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--color-shadow)" }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold" style={{ color: "var(--color-text)" }}>Simulador &quot;e se eu poupasse mais?&quot;</h3>
          <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-low)" }}>Projeção sobre o ritmo atual de receitas/despesas</p>
        </div>
        <PiggyBank className="w-4 h-4" style={{ color: "var(--color-text-low)" }} />
      </div>

      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-text-low)" }}>Poupar a mais por mês</span>
        <span className="text-sm font-black text-violet-400 num">{extraPct}%</span>
      </div>
      <input
        type="range" min={0} max={50} step={1} value={extraPct}
        onChange={e => setExtraPct(Number(e.target.value))}
        className="w-full accent-violet-500"
        data-testid="savings-simulator-slider"
      />

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="rounded-xl p-3" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.18)" }}>
          <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: "rgba(196,181,253,0.7)" }}>Em 6 meses</p>
          <p className="text-base font-black num" style={{ color: "var(--color-text)" }}>{currency(boosted6)}</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.18)" }}>
          <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: "rgba(196,181,253,0.7)" }}>Em 12 meses</p>
          <p className="text-base font-black num" style={{ color: "var(--color-text)" }}>{currency(boosted12)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 px-1">
        <span className="text-[10px]" style={{ color: "var(--color-text-low)" }}>vs. mantendo o ritmo atual ({currency(baseline12)})</span>
        <span className={`text-xs font-bold num ${delta12 >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {delta12 >= 0 ? "+" : ""}{currency(delta12)}
        </span>
      </div>
    </div>
  );
}
