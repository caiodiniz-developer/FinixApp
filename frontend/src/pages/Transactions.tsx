import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  X,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  CheckCircle2,
  Clock,
  Split,
  HeartCrack,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../services/api";
import { Budget, Transaction, Contact } from "../types";
import { currency, dateBR, dateISOForInput } from "../utils/format";
import { useAuth } from "../contexts/AuthContext";
import { UpgradeModal } from "../components/UpgradeModal";
import { SplitModal } from "../components/SplitModal";

const DEFAULT_CATEGORIES = [
  "Alimentação",
  "Transporte",
  "Saúde",
  "Salário",
  "Investimento",
  "Pagamento",
  "Lazer",
  "Educação",
  "Moradia",
  "Serviços",
];

const schema = yup.object({
  title: yup.string().min(1).required("Título obrigatório"),
  amount: yup
    .number()
    .typeError("Valor inválido")
    .positive("Valor deve ser positivo")
    .required(),
  type: yup.string().oneOf(["INCOME", "EXPENSE"]).required(),
  category: yup.string().required("Categoria obrigatória"),
  description: yup.string().default(""),
  date: yup.string().required("Data obrigatória"),
  recurring: yup.boolean().default(false),
  recurringFrequency: yup.string().nullable().default(null),
  paymentMethod: yup
    .string()
    .oneOf(["credito", "debito", "pix"])
    .default("pix"),
  installments: yup.number().min(1).max(60).default(1),
  currency: yup.string().oneOf(["BRL", "USD", "EUR", "GBP"]).default("BRL"),
  accountId: yup.string().nullable().default(null),
  cardId: yup.string().nullable().default(null),
  dueDate: yup.string().nullable().default(null),
});
type Form = yup.InferType<typeof schema>;

// ─── CORREÇÃO 1: groupInstallments ───────────────────────────────────────────
// Agrupa todas as parcelas de um mesmo grupo em UMA linha.
// Exibe a parcela com o menor installmentNumber (a próxima a vencer / mais recente a pagar).
// Conta quantas já foram pagas e quantas estão pendentes com base nos dados do grupo.
function groupInstallments(items: Transaction[]): Transaction[] {
  // Separa parceladas de avulsas
  const groups = new Map<string, Transaction[]>();
  const standalone: Transaction[] = [];

  for (const t of items) {
    if (t.installmentGroupId && (t.totalInstallments ?? 0) > 1) {
      const list = groups.get(t.installmentGroupId) ?? [];
      list.push(t);
      groups.set(t.installmentGroupId, list);
    } else {
      standalone.push(t);
    }
  }

  // Para cada grupo, escolhe o representante (menor installmentNumber = mais atual a pagar)
  const representatives: Transaction[] = [];
  for (const [, group] of groups) {
    group.sort(
      (a, b) => (a.installmentNumber ?? 0) - (b.installmentNumber ?? 0),
    );
    // O representante carrega metadados extras para a UI
    const rep = { ...group[0], _groupSize: group.length } as Transaction & {
      _groupSize: number;
    };
    representatives.push(rep);
  }

  const all = [...standalone, ...representatives];
  return all.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

export default function Transactions() {
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState<"" | "INCOME" | "EXPENSE">("");
  const [category, setCategory] = useState("");
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [userCategories, setUserCategories] =
    useState<string[]>(DEFAULT_CATEGORIES);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [cards, setCards] = useState<{ id: string; name: string }[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [splitting, setSplitting] = useState<Transaction | null>(null);
  const [impulseReview, setImpulseReview] = useState<Transaction[]>([]);
  const isFree = user?.plan === "FREE";

  const fetchImpulseReview = () =>
    api.get("/api/transactions/impulse-review").then((r) => setImpulseReview(r.data)).catch(() => {});

  const reflectImpulse = async (id: string) => {
    await api.post(`/api/transactions/${id}/reflect`).catch(() => {});
    setImpulseReview((prev) => prev.filter((t) => t.id !== id));
  };

  const effectiveCategories =
    user?.plan === "PRO" ? userCategories : DEFAULT_CATEGORIES;

  const fetchBudgets = async () =>
    setBudgets((await api.get("/api/budgets")).data);

  const fetchCategories = async () => {
    if (!user || user.plan !== "PRO") {
      setUserCategories(DEFAULT_CATEGORIES);
      return;
    }
    try {
      const r = await api.get("/api/categories");
      setUserCategories(
        r.data.length > 0 ? r.data.map((c: any) => c.name) : DEFAULT_CATEGORIES,
      );
    } catch {
      setUserCategories(DEFAULT_CATEGORIES);
    }
  };

  const fetchData = useCallback(async () => {
    if (isFree) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params: any = {};
      if (q) params.search = q;
      if (type) params.type = type;
      if (category) params.category = category;
      const r = await api.get("/api/transactions", { params });
      setItems(r.data);
    } catch {
      toast.error("Erro ao carregar transações");
    } finally {
      setLoading(false);
    }
  }, [q, type, category, isFree]);

  useEffect(() => {
    fetchData().catch(() => toast.error("Erro ao carregar"));
  }, [fetchData]);
  useEffect(() => {
    fetchBudgets().catch(() => toast.error("Erro ao carregar orçamentos"));
  }, []);
  useEffect(() => {
    fetchCategories();
  }, [user]);
  useEffect(() => {
    if (isFree) return;
    api.get("/api/accounts").then((r) => setAccounts(r.data)).catch(() => {});
    api.get("/api/cards").then((r) => setCards(r.data)).catch(() => {});
    api.get("/api/contacts").then((r) => setContacts(r.data)).catch(() => {});
    fetchImpulseReview();
  }, [isFree]);

  const openUpgrade = () => setUpgradeOpen(true);
  const openNew = () => {
    if (isFree) {
      openUpgrade();
      return;
    }
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (t: Transaction) => {
    if (isFree) {
      openUpgrade();
      return;
    }
    setEditing(t);
    setOpen(true);
  };

  const onDelete = async (t: Transaction) => {
    const isInstallment =
      t.installmentGroupId && (t.totalInstallments ?? 0) > 1;
    const msg = isInstallment
      ? `Excluir todas as ${t.totalInstallments} parcelas de "${t.title}"?`
      : `Excluir "${t.title}"?`;
    if (!window.confirm(msg)) return;
    try {
      if (isInstallment) {
        await api.delete(`/api/transactions/${t.id}?deleteGroup=true`);
      } else {
        await api.delete(`/api/transactions/${t.id}`);
      }
      toast.success("Excluído");
      fetchData();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  // Agrupa exibição de parceladas — cada grupo aparece como 1 linha
  const displayItems = groupInstallments(items);

  return (
    <div className="space-y-6" data-testid="transactions-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-extrabold tracking-tight">
            Transações
          </h1>
          <p className="text-sm md:text-base text-muted dark:text-muted mt-1">
            Organize seus ganhos e gastos
          </p>
        </div>
        <button
          onClick={openNew}
          className="btn-primary"
          data-testid="new-transaction-btn"
        >
          <Plus className="w-4 h-4" /> Nova transação
        </button>
      </div>

      {isFree && (
        <div className="rounded-3xl border border-brand-blue/10 bg-brand-blue/5 p-5 text-brand-blue">
          <h2 className="font-semibold">Plano Grátis: acesso básico</h2>
          <p className="mt-2 text-sm text-text">
            Você ainda não pode criar transações ou acessar recursos avançados.
            Faça upgrade para o plano Básico ou Pro e desbloqueie tudo.
          </p>
          <button onClick={openUpgrade} className="btn-primary mt-4">
            Ver planos
          </button>
        </div>
      )}

      {impulseReview.length > 0 && (
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-5">
          <h2 className="font-semibold text-text flex items-center gap-2">
            <HeartCrack className="w-4 h-4 text-amber-500" /> Ainda vale a pena?
          </h2>
          <p className="mt-1 text-sm text-muted">Compras que você marcou como "não planejadas" — dá uma olhada de novo com a cabeça fria.</p>
          <div className="mt-3 space-y-2">
            {impulseReview.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface p-3 text-sm">
                <span>{t.title} — <strong>{currency(t.amount)}</strong></span>
                <button onClick={() => reflectImpulse(t.id)} className="btn-outline !py-1.5 !px-3 text-xs">Já refleti</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card !p-4">
        <div className="grid sm:grid-cols-4 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Pesquisar por nome..."
              className="input pl-10"
              data-testid="search-input"
            />
          </div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="input"
            data-testid="filter-type"
          >
            <option value="">Todos os tipos</option>
            <option value="INCOME">Receitas</option>
            <option value="EXPENSE">Despesas</option>
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input"
            data-testid="filter-category"
          >
            <option value="">Todas as categorias</option>
            {effectiveCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      <div className="card !p-0 overflow-hidden">
        {loading ? (
          <div className="p-8">
            <div className="skeleton h-16" />
          </div>
        ) : displayItems.length === 0 ? (
          <div className="p-12 text-center">
            <Filter className="w-10 h-10 mx-auto text-muted" />
            <p className="mt-3 font-semibold">Nenhuma transação encontrada</p>
            <p className="text-sm text-muted mt-1">
              Clique em "Nova transação" para começar.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {displayItems.map((t) => {
              const isInstallment =
                t.installmentGroupId && (t.totalInstallments ?? 0) > 1;
              const currentNum = t.installmentNumber ?? 1; // parcela mais atual (ex: 1 de 4)
              const totalNum = t.totalInstallments ?? 1;
              // "Pago X de N" — o representante é o de menor número, então paidCount = currentNum - 1
              // Se installmentNumber === totalNum, tudo pago.
              const paidCount = currentNum - 1; // parcelas já quitadas
              const pendingCount = totalNum - paidCount; // parcelas ainda por pagar (inclui a atual)
              const allPaid = currentNum === totalNum;

              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-4 p-4 hover:bg-background dark:hover:bg-surface-strong/50 transition"
                  data-testid={`tx-row-${t.id}`}
                >
                  <div
                    className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${t.type === "INCOME" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300"}`}
                  >
                    {t.type === "INCOME" ? (
                      <ArrowUpRight className="w-5 h-5" />
                    ) : (
                      <ArrowDownRight className="w-5 h-5" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate flex items-center gap-2 flex-wrap">
                      {t.title}
                      {t.recurring && (
                        <span className="chip bg-brand-purple/10 text-brand-purple !py-0.5 text-[10px]">
                          <RefreshCw className="w-3 h-3" />{" "}
                          {t.recurringFrequency || "recorrente"}
                        </span>
                      )}
                      {/* ── CORREÇÃO: chip único "Pago X de N" ── */}
                      {isInstallment && (
                        <span className="chip bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 !py-0.5 text-[10px] font-semibold">
                          Pago {paidCount} de {totalNum}
                        </span>
                      )}
                      {isInstallment &&
                        (allPaid ? (
                          <span className="chip bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 !py-0.5 text-[10px] inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Quitado
                          </span>
                        ) : (
                          <span className="chip bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 !py-0.5 text-[10px] inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {pendingCount}{" "}
                            restante{pendingCount > 1 ? "s" : ""}
                          </span>
                        ))}
                    </div>

                    <div className="text-xs text-muted flex items-center gap-2 flex-wrap mt-0.5">
                      <span className="chip bg-surface dark:bg-surface-strong !py-0.5 text-muted dark:text-muted">
                        {t.category}
                      </span>
                      <span className="chip bg-surface dark:bg-surface-strong !py-0.5 text-muted dark:text-muted">
                        {t.paymentMethod || "pix"}
                      </span>
                      {t.currency !== "BRL" && (
                        <span className="chip bg-surface dark:bg-surface-strong !py-0.5 text-muted dark:text-muted">
                          {t.currency}
                        </span>
                      )}
                      {dateBR(t.date)}
                    </div>

                    {/* Barra de progresso das parcelas */}
                    {isInstallment && totalNum > 1 && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-surface-strong dark:bg-surface overflow-hidden max-w-[120px]">
                          <div
                            className="h-full rounded-full bg-brand-blue transition-all"
                            style={{
                              width: `${(paidCount / totalNum) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-muted">
                          {paidCount}/{totalNum} pagas
                        </span>
                      </div>
                    )}
                  </div>

                  <div
                    className={`min-w-[104px] text-right font-bold ${t.type === "INCOME" ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"} flex flex-col items-end`}
                  >
                    <span className="text-base sm:text-lg">
                      {t.type === "INCOME" ? "+" : "-"}
                      {currency(t.amount)}
                    </span>
                    {isInstallment && t.totalAmount && (
                      <span className="text-[10px] text-muted font-normal">
                        total {currency(t.totalAmount)}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-1 items-center">
                    {contacts.length > 0 && t.type === "EXPENSE" && !isInstallment && (
                      <button
                        className="btn-ghost !p-2"
                        onClick={() => setSplitting(t)}
                        data-testid={`split-${t.id}`}
                        title="Dividir com contatos"
                      >
                        <Split className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      className="btn-ghost !p-2"
                      onClick={() => openEdit(t)}
                      data-testid={`edit-${t.id}`}
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      className="btn-ghost !p-2 hover:!text-red-600"
                      onClick={() => onDelete(t)}
                      data-testid={`delete-${t.id}`}
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <TxModal
            key={editing?.id || "new"}
            editing={editing}
            budgets={budgets}
            categories={effectiveCategories}
            accounts={accounts}
            cards={cards}
            onClose={() => setOpen(false)}
            onSaved={() => {
              setOpen(false);
              fetchData();
              fetchBudgets();
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {splitting && (
          <SplitModal
            transaction={splitting}
            contacts={contacts}
            onClose={() => setSplitting(null)}
            onSaved={() => setSplitting(null)}
          />
        )}
      </AnimatePresence>
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  );
}

function TxModal({
  editing,
  onClose,
  onSaved,
  budgets,
  categories,
  accounts,
  cards,
}: {
  editing: Transaction | null;
  budgets: Budget[];
  categories: string[];
  accounts: { id: string; name: string }[];
  cards: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const categoryOptions = categories.length ? categories : DEFAULT_CATEGORIES;
  const transactionCategories = Array.from(
    new Set([
      ...(categoryOptions || []),
      ...(editing ? [editing.category] : []),
    ]),
  );
  const defaultCategory = editing
    ? editing.category
    : transactionCategories[0] || DEFAULT_CATEGORIES[0];

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: yupResolver(schema) as any,
    defaultValues: editing
      ? {
          title: editing.title,
          amount: editing.amount,
          type: editing.type,
          category: editing.category,
          description: editing.description || "",
          date: dateISOForInput(editing.date),
          recurring: editing.recurring || false,
          recurringFrequency: (editing.recurringFrequency as any) || null,
          paymentMethod: editing.paymentMethod || "pix",
          installments: editing.installments || 1,
          currency: editing.currency || "BRL",
          accountId: editing.accountId || null,
          cardId: editing.cardId || null,
          dueDate: (editing as any).dueDate
            ? dateISOForInput((editing as any).dueDate)
            : null,
        }
      : ({
          type: "EXPENSE",
          category: defaultCategory,
          date: dateISOForInput(),
          description: "",
          recurring: false,
          recurringFrequency: null,
          paymentMethod: "pix",
          installments: 1,
          currency: "BRL",
          accountId: null,
          cardId: null,
          dueDate: null,
        } as any),
  });

  const [isRec, setIsRec] = useState<boolean>(editing?.recurring ?? false);

  const watchedCategory = watch("category");
  const watchedAmount = Number(watch("amount") || 0);
  const watchedPaymentMethod = watch("paymentMethod");
  const watchedInstallments = Number(watch("installments") || 1);
  const watchedCurrency = watch("currency") || "BRL";
  const selectedBudget = budgets.find((b) => b.category === watchedCategory);
  const currentSpent = selectedBudget
    ? selectedBudget.spent -
      (editing &&
      editing.type === "EXPENSE" &&
      editing.category === selectedBudget.category
        ? editing.amount
        : 0)
    : 0;
  const overLimit = selectedBudget
    ? currentSpent + watchedAmount > selectedBudget.limit
    : false;

  const onSubmit = async (data: Form) => {
    try {
      const payload: any = {
        ...data,
        date: new Date(data.date).toISOString(),
        recurring: isRec,
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
      };
      if (isRec)
        payload.recurringFrequency = data.recurringFrequency || "monthly";

      // Pausa de 24h pra compra por impulso: só pergunta em despesas novas
      // (não em edição) acima de um piso razoável — o backend decide se ela
      // é "grande o bastante pra este usuário" comparando com a média dele.
      if (!editing && payload.type === "EXPENSE" && payload.amount >= 150) {
        payload.plannedPurchase = window.confirm("Essa compra foi planejada?");
      }

      if (
        payload.type === "EXPENSE" &&
        selectedBudget &&
        currentSpent + payload.amount > selectedBudget.limit
      ) {
        const confirmed = window.confirm(
          `Você já chegou ao seu limite de ${currency(selectedBudget.limit)} para ${selectedBudget.category}. Tem certeza disso?`,
        );
        if (!confirmed) return;
      }

      if (editing) await api.put(`/api/transactions/${editing.id}`, payload);
      else await api.post("/api/transactions", payload);
      toast.success(editing ? "Atualizado" : "Criado");
      // Notifica o Calendário para atualizar imediatamente com a data da transação
      window.dispatchEvent(
        new CustomEvent("transaction-saved", {
          detail: { date: payload.date },
        }),
      );
      onSaved();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-surface dark:bg-surface-strong border border-border dark:border-border rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        data-testid="tx-modal"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-text text-text">
            {editing ? "Editar transação" : "Nova transação"}
          </h2>
          <button onClick={onClose} className="btn-ghost !p-2">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-5 space-y-3"
          data-testid="tx-form"
        >
          <div>
            <label className="text-sm font-medium text-text dark:text-muted">
              Título
            </label>
            <input
              {...register("title")}
              className="input mt-1"
              data-testid="tx-title"
            />
            {errors.title && (
              <p className="text-xs text-red-400 mt-1">
                {errors.title.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-text dark:text-muted">
                Valor (R$)
              </label>
              <input
                type="number"
                step="0.01"
                {...register("amount")}
                className="input mt-1"
                data-testid="tx-amount"
              />
              {errors.amount && (
                <p className="text-xs text-red-400 mt-1">
                  {errors.amount.message}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-text dark:text-muted">
                Data
              </label>
              <input
                type="date"
                {...register("date")}
                className="input mt-1"
                data-testid="tx-date"
              />
              {errors.date && (
                <p className="text-xs text-red-400 mt-1">
                  {errors.date.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-text dark:text-muted">
                Tipo
              </label>
              <select
                {...register("type")}
                className="input mt-1"
                data-testid="tx-type"
              >
                <option value="EXPENSE">Despesa</option>
                <option value="INCOME">Receita</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-text dark:text-muted">
                Categoria
              </label>
              <select
                {...register("category")}
                className="input mt-1"
                data-testid="tx-category"
                disabled={transactionCategories.length === 0}
              >
                {transactionCategories.length === 0 ? (
                  <option value="">Configure categorias no onboarding</option>
                ) : (
                  transactionCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))
                )}
              </select>
              {selectedBudget && (
                <p
                  className={`text-xs mt-2 ${overLimit ? "text-rose-500" : "text-muted dark:text-muted"}`}
                >
                  Orçamento: {currency(selectedBudget.limit)} · Gasto:{" "}
                  {currency(currentSpent)}
                  {overLimit && " · ⚠ Ultrapassará o limite"}
                  {(selectedBudget as any).dueDate && (
                    <> · Vence: {dateBR((selectedBudget as any).dueDate)}</>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-text dark:text-muted">
                Método de Pagamento
              </label>
              <select
                {...register("paymentMethod")}
                className="input mt-1"
                data-testid="tx-payment-method"
              >
                <option value="pix">PIX</option>
                <option value="debito">Débito</option>
                <option value="credito">Crédito</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-text dark:text-muted">
                Moeda
              </label>
              <select
                {...register("currency")}
                className="input mt-1"
                data-testid="tx-currency"
              >
                <option value="BRL">Real (BRL)</option>
                <option value="USD">Dólar (USD)</option>
                <option value="EUR">Euro (EUR)</option>
                <option value="GBP">Libra (GBP)</option>
              </select>
            </div>
          </div>

          {(accounts.length > 0 || (watchedPaymentMethod === "credito" && cards.length > 0)) && (
            <div className="grid grid-cols-2 gap-3">
              {accounts.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-text dark:text-muted">
                    Conta
                  </label>
                  <select {...register("accountId")} className="input mt-1" data-testid="tx-account">
                    <option value="">Sem conta</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {watchedPaymentMethod === "credito" && cards.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-text dark:text-muted">
                    Cartão
                  </label>
                  <select {...register("cardId")} className="input mt-1" data-testid="tx-card">
                    <option value="">Sem cartão</option>
                    {cards.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {watchedPaymentMethod === "credito" && (
            <div>
              <label className="text-sm font-medium text-text dark:text-muted">
                Parcelas
              </label>
              <input
                type="number"
                min="1"
                max="60"
                {...register("installments")}
                className="input mt-1"
                data-testid="tx-installments"
              />
              {errors.installments && (
                <p className="text-xs text-red-400 mt-1">
                  {errors.installments.message}
                </p>
              )}
              <p className="text-xs text-muted dark:text-muted mt-1">
                Aparece como 1 linha com progresso "Pago X de N".
              </p>
            </div>
          )}

          {/* Data limite de pagamento — só para crédito */}
          {watchedPaymentMethod === "credito" && (
            <div>
              <label className="text-sm font-medium text-text dark:text-muted">
                Data limite de pagamento
                <span className="ml-1 text-muted dark:text-muted font-normal">
                  (opcional)
                </span>
              </label>
              <input
                type="date"
                {...register("dueDate")}
                className="input mt-1"
                data-testid="tx-due-date"
              />
              <p className="text-xs text-muted dark:text-muted mt-1">
                Data de vencimento da fatura / última parcela. Aparece nos
                alertas.
              </p>
            </div>
          )}

          {watchedPaymentMethod === "credito" && watchedInstallments > 1 && (
            <div className="rounded-xl bg-surface dark:bg-surface-strong/60 border border-border dark:border-border p-3 space-y-1">
              <div className="flex justify-between text-sm text-text dark:text-muted">
                <span>Valor por parcela</span>
                <span className="font-semibold">
                  {currency(watchedAmount, watchedCurrency)}
                </span>
              </div>
              <div className="flex justify-between text-sm text-text dark:text-muted">
                <span>Total ({watchedInstallments}x)</span>
                <span className="font-semibold text-rose-500">
                  {currency(
                    watchedAmount * watchedInstallments,
                    watchedCurrency,
                  )}
                </span>
              </div>
            </div>
          )}

          <div className="rounded-xl bg-background dark:bg-surface-strong p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isRec}
                onChange={(e) => setIsRec(e.target.checked)}
                className="w-4 h-4 rounded accent-brand-blue"
                data-testid="tx-recurring"
              />
              <span className="text-sm font-medium text-text dark:text-muted">
                Transação recorrente
              </span>
              <RefreshCw className="w-4 h-4 text-brand-purple ml-auto" />
            </label>
            {isRec && (
              <div className="mt-2">
                <label className="text-xs text-muted dark:text-muted">
                  Frequência
                </label>
                <select
                  {...register("recurringFrequency")}
                  className="input mt-1"
                  data-testid="tx-recurring-frequency"
                  defaultValue={editing?.recurringFrequency || "monthly"}
                >
                  <option value="monthly">Mensal</option>
                  <option value="weekly">Semanal</option>
                  <option value="yearly">Anual</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-muted dark:text-muted">
              Descrição (opcional)
            </label>
            <textarea
              {...register("description")}
              rows={2}
              className="input mt-1"
              data-testid="tx-description"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-outline">
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting || transactionCategories.length === 0}
              data-testid="tx-save"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Salvar"
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
