import { useEffect, useState } from "react";
import { Users, UserPlus, Loader2, Check } from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../services/api";
import { HouseholdSummary, HouseholdInvite } from "../types";
import { currency } from "../utils/format";

export default function Household() {
  const [household, setHousehold] = useState<HouseholdSummary | null | undefined>(undefined);
  const [invites, setInvites] = useState<HouseholdInvite[]>([]);
  const [name, setName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchAll = () => {
    api.get("/api/household").then((r) => setHousehold(r.data)).catch(() => setHousehold(null));
    api.get("/api/household/invites").then((r) => setInvites(r.data)).catch(() => {});
  };
  useEffect(() => { fetchAll(); }, []);

  const create = async () => {
    if (!name) return;
    setBusy(true);
    try {
      await api.post("/api/household", { name });
      toast.success("Household criado!");
      setName("");
      fetchAll();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const invite = async () => {
    if (!inviteEmail) return;
    setBusy(true);
    try {
      await api.post("/api/household/invite", { email: inviteEmail });
      toast.success("Convite enviado!");
      setInviteEmail("");
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const respond = async (inv: HouseholdInvite, accept: boolean) => {
    try {
      await api.post(`/api/household/invites/${inv.id}/${accept ? "accept" : "decline"}`);
      setInvites((prev) => prev.filter((i) => i.id !== inv.id));
      if (accept) { toast.success("Você entrou no household!"); fetchAll(); }
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  if (household === undefined) return <div className="skeleton h-64" />;

  return (
    <div className="space-y-6" data-testid="household-page">
      <div>
        <h1 className="text-3xl font-display font-extrabold tracking-tight flex items-center gap-2">
          <Users className="w-7 h-7 text-brand-purple" /> Modo Casal / Família
        </h1>
        <p className="text-muted mt-1">
          Veja o total combinado de renda e gastos da família, sem juntar as contas bancárias de ninguém.
        </p>
      </div>

      {invites.length > 0 && (
        <div className="card space-y-2">
          <p className="text-sm font-semibold">Convites pendentes</p>
          {invites.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-strong p-3 text-sm">
              <span><strong>{inv.sender?.name}</strong> te convidou pro household "{inv.household?.name}"</span>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => respond(inv, true)} className="btn-primary !py-1.5 !px-3 text-xs"><Check className="w-3.5 h-3.5" /> Aceitar</button>
                <button onClick={() => respond(inv, false)} className="btn-outline !py-1.5 !px-3 text-xs">Recusar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!household ? (
        <div className="card text-center py-14">
          <Users className="w-12 h-12 mx-auto text-muted" />
          <p className="mt-3 font-semibold text-lg">Você ainda não tem um household</p>
          <p className="text-sm text-muted mt-1 mb-4">Crie um pra combinar sua visão financeira com seu parceiro(a) ou família.</p>
          <div className="flex gap-2 max-w-sm mx-auto">
            <input value={name} onChange={(e) => setName(e.target.value)} className="input flex-1" placeholder="Nome (ex: Casa)" />
            <button onClick={create} disabled={busy || !name} className="btn-primary shrink-0">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="card">
              <p className="text-xs text-muted uppercase tracking-wide font-semibold">Renda combinada</p>
              <p className="text-2xl font-display font-bold mt-1 text-emerald-500">{currency(household.combinedIncome)}</p>
            </div>
            <div className="card">
              <p className="text-xs text-muted uppercase tracking-wide font-semibold">Gasto combinado</p>
              <p className="text-2xl font-display font-bold mt-1 text-red-500">{currency(household.combinedExpense)}</p>
            </div>
            <div className="card">
              <p className="text-xs text-muted uppercase tracking-wide font-semibold">Saldo combinado</p>
              <p className={`text-2xl font-display font-bold mt-1 ${household.combinedBalance >= 0 ? "text-text" : "text-red-500"}`}>
                {currency(household.combinedBalance)}
              </p>
            </div>
          </div>

          <div className="card">
            <h2 className="font-display font-bold text-lg">Membros — {household.name}</h2>
            <div className="mt-4 space-y-2">
              {household.members.map((m) => (
                <motion.div key={m.userId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between rounded-xl bg-surface-strong p-3 text-sm">
                  <span className="font-semibold">{m.name}</span>
                  <span className="flex gap-4">
                    <span className="text-emerald-500">+{currency(m.income)}</span>
                    <span className="text-red-500">-{currency(m.expense)}</span>
                  </span>
                </motion.div>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="input flex-1" placeholder="E-mail de quem convidar" />
              <button onClick={invite} disabled={busy || !inviteEmail} className="btn-primary shrink-0">
                <UserPlus className="w-4 h-4" /> Convidar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
