import { useEffect, useState } from "react";
import {
  Plus,
  Users,
  Edit2,
  Trash2,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  HandCoins,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../services/api";
import { Contact, SplitExpense, PersonalLoan } from "../types";
import { currency, dateBR } from "../utils/format";
import { UpgradeModal } from "../components/UpgradeModal";

const schema = yup.object({
  name: yup.string().min(1).required("Nome obrigatório"),
  email: yup.string().email("E-mail inválido").nullable().default(null),
  phone: yup.string().default(""),
  color: yup.string().default("#f59e0b"),
});
type Form = yup.InferType<typeof schema>;

export default function Contacts() {
  const [items, setItems] = useState<Contact[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [splits, setSplits] = useState<SplitExpense[]>([]);
  const [splitsLoading, setSplitsLoading] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const fetchData = async () => setItems((await api.get("/api/contacts")).data);
  useEffect(() => {
    fetchData().catch(() => toast.error("Erro ao carregar contatos"));
  }, []);

  // Empréstimos entre pessoas
  const [loans, setLoans] = useState<PersonalLoan[]>([]);
  const [loanForm, setLoanForm] = useState({ contactId: "", direction: "LENT" as "LENT" | "BORROWED", principal: "" });
  const fetchLoans = () => api.get("/api/personal-loans").then((r) => setLoans(r.data)).catch(() => {});
  useEffect(() => { fetchLoans(); }, []);

  const addLoan = async () => {
    if (!loanForm.contactId || !loanForm.principal) return;
    try {
      await api.post("/api/personal-loans", {
        contactId: loanForm.contactId,
        direction: loanForm.direction,
        principal: Number(loanForm.principal),
        remaining: Number(loanForm.principal),
      });
      setLoanForm({ contactId: "", direction: "LENT", principal: "" });
      fetchLoans();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const settleLoan = async (loan: PersonalLoan) => {
    try {
      await api.put(`/api/personal-loans/${loan.id}`, { remaining: 0 });
      fetchLoans();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const deleteLoan = async (loan: PersonalLoan) => {
    if (!window.confirm("Remover este empréstimo?")) return;
    await api.delete(`/api/personal-loans/${loan.id}`).catch(() => {});
    fetchLoans();
  };

  const onDelete = async (c: Contact) => {
    if (!window.confirm(`Excluir o contato "${c.name}"? Os itens divididos com ele também somem.`))
      return;
    try {
      await api.delete(`/api/contacts/${c.id}`);
      toast.success("Excluído");
      if (expanded === c.id) setExpanded(null);
      fetchData();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const settleAll = async (c: Contact) => {
    if (!window.confirm(`Marcar tudo que ${c.name} te deve como pago?`)) return;
    try {
      await api.post(`/api/contacts/${c.id}/settle-all`);
      toast.success("Liquidado!");
      fetchData();
      if (expanded === c.id) toggleExpand(c);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const toggleExpand = async (c: Contact) => {
    if (expanded === c.id) {
      setExpanded(null);
      return;
    }
    setExpanded(c.id);
    setSplitsLoading(true);
    try {
      const r = await api.get(`/api/contacts/${c.id}/splits`);
      setSplits(r.data);
    } catch {
      toast.error("Erro ao carregar itens divididos");
    } finally {
      setSplitsLoading(false);
    }
  };

  const toggleSettled = async (s: SplitExpense) => {
    try {
      const r = await api.put(`/api/split-expenses/${s.id}`, { settled: !s.settled });
      setSplits((prev) => prev.map((x) => (x.id === s.id ? r.data : x)));
      fetchData();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  return (
    <div className="space-y-6" data-testid="contacts-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Contatos</h1>
          <p className="page-subtitle">
            Divida despesas e acompanhe quem ainda te deve
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="btn-primary"
          data-testid="new-contact-btn"
        >
          <Plus className="w-4 h-4" /> Novo contato
        </button>
      </div>

      {items && items.length > 0 && (
        <div className="card">
          <h2 className="font-display font-semibold text-lg flex items-center gap-2">
            <HandCoins className="w-5 h-5 text-income" /> Empréstimos entre pessoas
          </h2>
          <p className="text-sm text-muted mt-1">Diferente de dividir uma conta — isso é "emprestei/peguei emprestado", com controle de quitação.</p>

          {loans.filter((l) => !l.settled).length > 0 && (
            <div className="mt-4 space-y-2">
              {loans.filter((l) => !l.settled).map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 rounded-control bg-surface-strong p-3 text-sm">
                  <span>
                    {l.direction === "LENT" ? "Você emprestou pra" : "Você pegou emprestado de"} <strong>{l.contact?.name}</strong>
                  </span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`font-semibold ${l.direction === "LENT" ? "text-income" : "text-expense"}`}>{currency(l.remaining)}</span>
                    <button onClick={() => settleLoan(l)} className="btn-outline !py-1 !px-2 text-xs">Quitar</button>
                    <button onClick={() => deleteLoan(l)} className="text-muted hover:text-expense"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-4">
            <select value={loanForm.contactId} onChange={(e) => setLoanForm((f) => ({ ...f, contactId: e.target.value }))} className="input !w-40">
              <option value="">Contato</option>
              {items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={loanForm.direction} onChange={(e) => setLoanForm((f) => ({ ...f, direction: e.target.value as any }))} className="input !w-44">
              <option value="LENT">Eu emprestei</option>
              <option value="BORROWED">Peguei emprestado</option>
            </select>
            <input
              type="number"
              value={loanForm.principal}
              onChange={(e) => setLoanForm((f) => ({ ...f, principal: e.target.value }))}
              className="input !w-32"
              placeholder="Valor (R$)"
            />
            <button onClick={addLoan} className="btn-primary">Registrar</button>
          </div>
        </div>
      )}

      {items === null ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-16" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <Users className="w-8 h-8" />
          <p className="empty-state-title mt-1">Nenhum contato cadastrado</p>
          <p className="text-sm max-w-sm">
            Cadastre amigos ou familiares para dividir despesas com eles.
          </p>
          <button onClick={() => {
              setEditing(null);
              setOpen(true);
            }} className="btn-primary mt-3">
            <Plus className="w-4 h-4" /> Novo contato
          </button>
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="divide-y divide-border ">
            {items.map((c) => (
              <div key={c.id} data-testid={`contact-row-${c.id}`}>
                <div
                  className="flex items-center gap-4 p-4 hover:bg-background dark:hover:bg-surface-strong/50 transition cursor-pointer"
                  onClick={() => toggleExpand(c)}
                >
                  <div
                    className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center font-semibold text-white"
                    style={{ background: c.color || "#f59e0b" }}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{c.name}</p>
                    <p className="text-xs text-muted truncate">
                      {c.email || c.phone || "Sem contato cadastrado"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted">a receber</p>
                    <p className={`font-semibold ${c.totalOwed > 0 ? "text-income " : "text-muted"}`}>
                      {currency(c.totalOwed)}
                    </p>
                  </div>
                  {c.totalOwed > 0 && (
                    <button
                      className="btn-outline !py-1.5 !px-3 text-xs shrink-0"
                      onClick={(e) => { e.stopPropagation(); settleAll(c); }}
                    >
                      Liquidar tudo
                    </button>
                  )}
                  <div className="flex gap-1 items-center">
                    <button
                      className="btn-ghost !p-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(c);
                        setOpen(true);
                      }}
                      data-testid={`edit-contact-${c.id}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      className="btn-ghost !p-2 hover:!text-expense"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(c);
                      }}
                      data-testid={`delete-contact-${c.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {expanded === c.id ? (
                      <ChevronUp className="w-4 h-4 text-muted" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted" />
                    )}
                  </div>
                </div>
                <AnimatePresence>
                  {expanded === c.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-background dark:bg-surface-strong/40 overflow-hidden"
                      data-testid={`contact-splits-${c.id}`}
                    >
                      {splitsLoading ? (
                        <div className="p-4">
                          <div className="skeleton h-10" />
                        </div>
                      ) : splits.length === 0 ? (
                        <p className="text-sm text-muted text-center py-5">
                          Nenhuma despesa dividida com esse contato ainda.
                        </p>
                      ) : (
                        <div className="divide-y divide-border px-4">
                          {splits.map((s) => (
                            <div key={s.id} className="flex items-center gap-3 py-3">
                              <button
                                onClick={() => toggleSettled(s)}
                                title={s.settled ? "Marcar como pendente" : "Marcar como pago"}
                                data-testid={`toggle-split-${s.id}`}
                              >
                                {s.settled ? (
                                  <CheckCircle2 className="w-5 h-5 text-income" />
                                ) : (
                                  <Circle className="w-5 h-5 text-muted" />
                                )}
                              </button>
                              <div className="min-w-0 flex-1">
                                <p className={`text-sm font-medium truncate ${s.settled ? "line-through text-muted" : ""}`}>
                                  {s.transaction?.title || "Despesa"}
                                </p>
                                <p className="text-xs text-muted">
                                  {s.transaction ? dateBR(s.transaction.date) : dateBR(s.createdAt)}
                                </p>
                              </div>
                              <span className={`text-sm font-semibold ${s.settled ? "text-muted" : "text-income "}`}>
                                {currency(s.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {open && (
          <ContactModal
            key={editing?.id || "new"}
            editing={editing}
            onClose={() => setOpen(false)}
            onSaved={() => {
              setOpen(false);
              fetchData();
            }}
            onLimitReached={() => {
              setOpen(false);
              setUpgradeOpen(true);
            }}
          />
        )}
      </AnimatePresence>
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  );
}

function ContactModal({
  editing,
  onClose,
  onSaved,
  onLimitReached,
}: {
  editing: Contact | null;
  onClose: () => void;
  onSaved: () => void;
  onLimitReached: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: yupResolver(schema) as any,
    defaultValues: editing
      ? {
          name: editing.name,
          email: editing.email || null,
          phone: editing.phone || "",
          color: editing.color || "#f59e0b",
        }
      : ({ email: null, phone: "", color: "#f59e0b" } as any),
  });

  const onSubmit = async (data: Form) => {
    try {
      if (editing) await api.put(`/api/contacts/${editing.id}`, data);
      else await api.post("/api/contacts", data);
      toast.success(editing ? "Atualizado" : "Criado");
      onSaved();
    } catch (e: any) {
      if (e?.response?.data?.upgrade) {
        toast.error(apiErrorMessage(e));
        onLimitReached();
        return;
      }
      toast.error(apiErrorMessage(e));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="modal-overlay"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="modal-panel w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
        data-testid="contact-modal"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">
            {editing ? "Editar contato" : "Novo contato"}
          </h2>
          <button onClick={onClose} className="btn-ghost !p-2">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-3" data-testid="contact-form">
          <div>
            <label className="text-sm font-medium">Nome</label>
            <input {...register("name")} aria-invalid={!!errors.name} className="input mt-1" data-testid="contact-name" />
            {errors.name && <p className="text-xs text-expense mt-1">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">E-mail (opcional)</label>
              <input {...register("email")} aria-invalid={!!errors.email} className="input mt-1" data-testid="contact-email" />
              {errors.email && <p className="text-xs text-expense mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">Telefone (opcional)</label>
              <input {...register("phone")} aria-invalid={!!errors.phone} className="input mt-1" data-testid="contact-phone" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Cor</label>
            <input type="color" {...register("color")} aria-invalid={!!errors.color} className="input mt-1 h-10 !p-1" data-testid="contact-color" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-outline">
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting} data-testid="contact-save">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
