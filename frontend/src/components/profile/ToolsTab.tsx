import { useEffect, useState } from "react";
import { Loader2, Coins, Briefcase, Scale } from "lucide-react";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { Goal, TaxObligation, CltVsPjResult } from "../../types";

/** Profile → Ferramentas: round-up, Modo Autônomo/MEI and the CLT vs PJ calculator. */
export function ToolsTab() {
  const { user, refreshUser } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [roundUpEnabled, setRoundUpEnabled] = useState(false);
  const [roundUpGoalId, setRoundUpGoalId] = useState("");
  const [isAutonomous, setIsAutonomous] = useState(false);
  const [taxRegime, setTaxRegime] = useState<"MEI" | "CARNE_LEAO">("MEI");
  const [meiActivity, setMeiActivity] = useState<"COMERCIO_INDUSTRIA" | "SERVICOS" | "COMERCIO_SERVICOS">("SERVICOS");
  const [taxData, setTaxData] = useState<{ current: TaxObligation | null; clients: { client: string; amount: number }[]; disclaimer: string } | null>(null);
  const [toolsSaving, setToolsSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setRoundUpEnabled(!!user.roundUpEnabled);
    setRoundUpGoalId(user.roundUpGoalId || "");
    setIsAutonomous(!!user.isAutonomous);
    if (user.taxRegime) setTaxRegime(user.taxRegime);
    if (user.meiActivity) setMeiActivity(user.meiActivity);
    api.get("/api/goals").then((r) => setGoals(r.data)).catch(() => {});
    if (user.isAutonomous) {
      api.get("/api/tax/estimate").then((r) => setTaxData(r.data)).catch(() => {});
    }
  }, [user]);

  const saveRoundUp = async () => {
    setToolsSaving(true);
    try {
      await api.put("/api/settings/roundup", { enabled: roundUpEnabled, goalId: roundUpEnabled ? roundUpGoalId : null });
      await refreshUser();
      toast.success("Arredondamento atualizado!");
    } catch (err: any) {
      toast.error(apiErrorMessage(err));
    } finally {
      setToolsSaving(false);
    }
  };

  const saveAutonomous = async () => {
    setToolsSaving(true);
    try {
      await api.put("/api/settings/autonomous", { isAutonomous, taxRegime, meiActivity });
      await refreshUser();
      if (isAutonomous) {
        const { data } = await api.get("/api/tax/estimate");
        setTaxData(data);
      } else {
        setTaxData(null);
      }
      toast.success("Modo Autônomo atualizado!");
    } catch (err: any) {
      toast.error(apiErrorMessage(err));
    } finally {
      setToolsSaving(false);
    }
  };

  // Calculadora CLT vs PJ
  const [cltSalary, setCltSalary] = useState("5000");
  const [pjMonthly, setPjMonthly] = useState("7000");
  const [pjRegime, setPjRegime] = useState<"MEI" | "CARNE_LEAO">("CARNE_LEAO");
  const [pjFee, setPjFee] = useState("0");
  const [cltVsPj, setCltVsPj] = useState<CltVsPjResult | null>(null);
  const [comparing, setComparing] = useState(false);

  const compareCltVsPj = async () => {
    setComparing(true);
    try {
      const { data } = await api.post("/api/tax/clt-vs-pj", {
        cltGrossSalary: Number(cltSalary),
        pjContractedMonthly: Number(pjMonthly),
        pjTaxRegime: pjRegime,
        pjMeiActivity: meiActivity,
        pjAccountingFee: Number(pjFee) || 0,
      });
      setCltVsPj(data);
    } catch (err: any) {
      toast.error(apiErrorMessage(err));
    } finally {
      setComparing(false);
    }
  };

  return (
    <section className="space-y-6">
      {/* Round-up */}
      <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-lg text-text flex items-center gap-2">
              <Coins className="w-5 h-5" /> Arredondamento automático
            </h2>
            <p className="mt-2 text-sm text-muted">
              Cada despesa arredonda pro próximo real e a diferença cai direto numa meta — sem você perceber.
            </p>
          </div>
          <input
            type="checkbox"
            checked={roundUpEnabled}
            onChange={(e) => setRoundUpEnabled(e.target.checked)}
            className="h-5 w-5 rounded border-border text-brand-blue focus:ring-brand-blue shrink-0"
          />
        </div>
        {roundUpEnabled && (
          <div className="mt-4">
            <label className="text-sm font-medium text-muted">Meta que recebe o arredondamento</label>
            <select value={roundUpGoalId} onChange={(e) => setRoundUpGoalId(e.target.value)} className="input mt-1">
              <option value="">Selecione uma meta</option>
              {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select>
          </div>
        )}
        <button onClick={saveRoundUp} disabled={toolsSaving || (roundUpEnabled && !roundUpGoalId)} className="btn-primary mt-4">
          {toolsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
        </button>
      </div>

      {/* Modo Autônomo/MEI */}
      <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-lg text-text flex items-center gap-2">
              <Briefcase className="w-5 h-5" /> Modo Autônomo / MEI
            </h2>
            <p className="mt-2 text-sm text-muted">
              Estimativa de DAS-MEI ou Carnê-Leão com base na sua receita do mês.
            </p>
          </div>
          <input
            type="checkbox"
            checked={isAutonomous}
            onChange={(e) => setIsAutonomous(e.target.checked)}
            className="h-5 w-5 rounded border-border text-brand-blue focus:ring-brand-blue shrink-0"
          />
        </div>

        {isAutonomous && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-muted">Regime</label>
              <select value={taxRegime} onChange={(e) => setTaxRegime(e.target.value as any)} className="input mt-1">
                <option value="MEI">MEI (DAS)</option>
                <option value="CARNE_LEAO">Autônomo (Carnê-Leão)</option>
              </select>
            </div>
            {taxRegime === "MEI" && (
              <div>
                <label className="text-sm font-medium text-muted">Atividade</label>
                <select value={meiActivity} onChange={(e) => setMeiActivity(e.target.value as any)} className="input mt-1">
                  <option value="COMERCIO_INDUSTRIA">Comércio/Indústria</option>
                  <option value="SERVICOS">Serviços</option>
                  <option value="COMERCIO_SERVICOS">Comércio e Serviços</option>
                </select>
              </div>
            )}
          </div>
        )}
        <button onClick={saveAutonomous} disabled={toolsSaving} className="btn-primary mt-4">
          {toolsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
        </button>

        {taxData?.current && (
          <div className="mt-6 pt-6 border-t border-border">
            <div className="rounded-2xl bg-surface-strong p-4">
              <p className="text-xs text-muted uppercase tracking-wide font-semibold">
                Estimativa de {taxData.current.type === "DAS_MEI" ? "DAS-MEI" : "Carnê-Leão"} — {taxData.current.referenceMonth}
              </p>
              <p className="text-2xl font-display font-bold text-text mt-1">
                R$ {taxData.current.estimatedAmount.toFixed(2)}
              </p>
              <p className="text-xs text-muted mt-1">Receita do mês: R$ {taxData.current.grossIncome.toFixed(2)}</p>
            </div>
            {taxData.clients.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {taxData.clients.map((c) => (
                  <div key={c.client} className="flex items-center justify-between text-sm">
                    <span className="text-muted">{c.client}</span>
                    <span className="font-semibold text-text">R$ {c.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs text-amber-600 dark:text-amber-400">⚠ {taxData.disclaimer}</p>
          </div>
        )}
      </div>

      {/* CLT vs PJ */}
      <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="font-display font-bold text-lg text-text flex items-center gap-2">
          <Scale className="w-5 h-5" /> Calculadora CLT vs PJ
        </h2>
        <p className="mt-2 text-sm text-muted">
          Compara o salário líquido CLT (com 13º, férias e FGTS) contra uma proposta PJ, descontando o imposto do regime que você escolher acima.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-muted">Salário bruto CLT (R$)</label>
            <input type="number" value={cltSalary} onChange={(e) => setCltSalary(e.target.value)} className="input mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-muted">Valor mensal PJ (R$)</label>
            <input type="number" value={pjMonthly} onChange={(e) => setPjMonthly(e.target.value)} className="input mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium text-muted">Regime PJ</label>
            <select value={pjRegime} onChange={(e) => setPjRegime(e.target.value as any)} className="input mt-1">
              <option value="MEI">MEI</option>
              <option value="CARNE_LEAO">Autônomo (Carnê-Leão)</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-muted">Contador (R$/mês, opcional)</label>
            <input type="number" value={pjFee} onChange={(e) => setPjFee(e.target.value)} className="input mt-1" />
          </div>
        </div>
        <button onClick={compareCltVsPj} disabled={comparing} className="btn-primary mt-4">
          {comparing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Comparar"}
        </button>

        {cltVsPj && (
          <div className="mt-6 pt-6 border-t border-border grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-surface-strong p-4">
              <p className="text-xs text-muted uppercase tracking-wide font-semibold">CLT — equivalente mensal</p>
              <p className="text-2xl font-display font-bold mt-1">R$ {cltVsPj.clt.totalMonthlyEquivalent.toFixed(2)}</p>
              <p className="text-xs text-muted mt-1">líquido R$ {cltVsPj.clt.netMonthly.toFixed(2)} + 13º/férias diluídos · FGTS à parte: R$ {cltVsPj.clt.fgtsMonthlyEquivalent.toFixed(2)}</p>
            </div>
            <div className="rounded-2xl bg-surface-strong p-4">
              <p className="text-xs text-muted uppercase tracking-wide font-semibold">PJ — líquido mensal</p>
              <p className="text-2xl font-display font-bold mt-1">R$ {cltVsPj.pj.netMonthly.toFixed(2)}</p>
              <p className="text-xs text-muted mt-1">após R$ {cltVsPj.pj.estimatedTax.toFixed(2)} de imposto estimado</p>
            </div>
            <div className={`sm:col-span-2 rounded-2xl p-4 ${cltVsPj.difference >= 0 ? "border border-emerald-500/30 bg-emerald-500/5" : "border border-amber-500/30 bg-amber-500/5"}`}>
              <p className="text-sm font-semibold text-text">
                {cltVsPj.difference >= 0
                  ? `PJ compensa R$ ${cltVsPj.difference.toFixed(2)} a mais por mês.`
                  : `CLT compensa R$ ${Math.abs(cltVsPj.difference).toFixed(2)} a mais por mês.`}
              </p>
              <p className="text-xs text-muted mt-1">Lembre: PJ não tem estabilidade, FGTS nem 13º/férias garantidos por lei — é você quem precisa se planejar pra isso.</p>
            </div>
            <p className="sm:col-span-2 text-xs text-amber-600 dark:text-amber-400">⚠ {cltVsPj.disclaimer}</p>
          </div>
        )}
      </div>
    </section>
  );
}
