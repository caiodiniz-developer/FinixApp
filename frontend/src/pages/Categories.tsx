import { useEffect, useMemo, useState } from "react";
import { activePlan } from "../types";
import { motion } from "framer-motion";
import { Edit2, Trash2, RefreshCcw, Loader2, Tag } from "lucide-react";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../services/api";
import { SkeletonRows } from "../components/placeholders";
import { confirmDialog } from "../components/confirm";
import { useAuth } from "../contexts/AuthContext";
import { Category } from "../types";

const DEFAULT_CATEGORIES = [
  "Alimentação",
  "Transporte",
  "Moradia",
  "Saúde",
  "Lazer",
  "Educação",
  "Salário",
  "Freelance",
  "Investimentos",
  "Serviços",
];

export default function Categories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState({
    name: "",
    type: "expense",
    icon: "Tag",
    color: "#2563EB",
  });
  const [editing, setEditing] = useState<Category | null>(null);

  const [hiddenDefaults, setHiddenDefaults] = useState<string[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("hiddenDefaultCategories") || "[]",
      );
    } catch {
      return [];
    }
  });

  const hideDefault = (name: string) => {
    const updated = [...hiddenDefaults, name];
    setHiddenDefaults(updated);
    localStorage.setItem("hiddenDefaultCategories", JSON.stringify(updated));
  };

  const restoreDefaults = () => {
    setHiddenDefaults([]);
    localStorage.removeItem("hiddenDefaultCategories");
  };

  const visibleDefaults = DEFAULT_CATEGORIES.filter(
    (n) => !hiddenDefaults.includes(n),
  );

  const plan = activePlan(user);
  const canManage = plan === "PRO" || plan === "TEST";

  const fetchCategories = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.get("/api/categories");
      setCategories(response.data || []);
    } catch (err: any) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [user?.id]);

  const defaultMessage = useMemo(() => {
    if (plan === "FREE")
      return "Você pode ver as categorias padrão, mas a criação e edição avançada estão disponíveis apenas no Plano Pro.";
    if (plan === "BASIC")
      return "Visualize categorias e filtros, mas o gerenciamento completo está disponível no Plano Pro.";
    return "Gerencie categorias personalizadas para organizar receitas e despesas.";
  }, [plan]);

  const resetForm = () =>
    setNewCategory({
      name: "",
      type: "expense",
      icon: "Tag",
      color: "#2563EB",
    });

  const saveCategory = async () => {
    if (!newCategory.name.trim()) {
      toast.error("Nome da categoria é obrigatório");
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      if (editing) {
        const response = await api.put(`/api/categories/${editing.id}`, {
          ...newCategory,
        });
        setCategories((current) =>
          current.map((cat) => (cat.id === editing.id ? response.data : cat)),
        );
        toast.success("Categoria atualizada!");
      } else {
        const response = await api.post("/api/categories", { ...newCategory });
        setCategories((current) => [response.data, ...current]);
        toast.success("Categoria criada!");
      }
      resetForm();
      setEditing(null);
    } catch (err: any) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const removeCategory = async (category: Category) => {
    if (!(await confirmDialog({ title: `Excluir a categoria "${category.name}"?`, danger: true }))) return;
    try {
      await api.delete(`/api/categories/${category.id}`);
      setCategories((current) =>
        current.filter((cat) => cat.id !== category.id),
      );
      toast.success("Categoria removida!");
    } catch (err: any) {
      toast.error(apiErrorMessage(err));
    }
  };

  const startEdit = (category: Category) => {
    setEditing(category);
    setNewCategory({
      name: category.name,
      type: category.type as "income" | "expense" | "both",
      icon: category.icon || "Tag",
      color: category.color || "#2563EB",
    });
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Categorias</h1>
          <p className="page-subtitle">
            Organize e personalize suas categorias conforme o plano.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-3 text-sm text-text dark:border-border dark:bg-surface dark:text-muted">
          <Tag className="w-4 h-4 text-primary" /> {user?.plan} •{" "}
          {canManage
            ? "Gerenciamento total ativado"
            : "Gerenciamento bloqueado"}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="card border border-border dark:border-border bg-surface dark:bg-surface p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted">
                Gerenciamento
              </p>
              <h2 className="mt-2 text-xl font-semibold text-text dark:text-text">
                Categorias personalizadas
              </h2>
            </div>
            <button
              onClick={fetchCategories}
              className="btn-outline inline-flex items-center gap-2 rounded-card px-4 py-3 text-sm"
            >
              <RefreshCcw className="w-4 h-4" /> Atualizar
            </button>
          </div>
          <p className="mt-4 text-sm text-muted">{defaultMessage}</p>

          <div className="mt-6 grid gap-3">
            <div className="rounded-card bg-surface p-4 text-sm text-muted dark:bg-surface-strong dark:text-text">
              {user?.plan !== "PRO"
                ? "Para criar, editar e excluir categorias você precisa atualizar para o Plano Pro."
                : "Use a área ao lado para adicionar ou editar categorias."}
            </div>

            <div className="rounded-card bg-surface p-4 text-sm text-muted dark:bg-surface-strong/60 dark:text-text">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "10px",
                }}
              >
                <span style={{ fontWeight: 500 }}>Categorias padrão:</span>
                {hiddenDefaults.length > 0 && (
                  <button
                    onClick={restoreDefaults}
                    style={{
                      fontSize: "12px",
                      color: "#60a5fa",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Restaurar padrões
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {visibleDefaults.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface-strong px-3 py-1 text-xs font-medium text-text dark:border-border dark:bg-surface-strong dark:text-text"
                  >
                    {name}
                    <button
                      onClick={() => hideDefault(name)}
                      title={`Remover ${name}`}
                      type="button"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-expense text-white text-2xs font-semibold"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {visibleDefaults.length === 0 && (
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    Nenhuma categoria padrão visível. Clique em "Restaurar
                    padrões" para exibir novamente.
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="card border border-border dark:border-border bg-surface dark:bg-surface p-6">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted">
                Nova categoria
              </p>
              <h2 className="mt-2 text-lg font-semibold text-text dark:text-text">
                Adicionar ou editar
              </h2>
            </div>
            {editing && (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                Modo edição
              </span>
            )}
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-text dark:text-muted">
                Nome
              </label>
              <input
                value={newCategory.name}
                onChange={(e) =>
                  setNewCategory((prev) => ({ ...prev, name: e.target.value }))
                }
                disabled={!canManage}
                className="input mt-1 text-text placeholder:text-muted dark:text-text"
                placeholder="Ex: Streaming"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-text dark:text-muted">
                  Tipo
                </label>
                <select
                  value={newCategory.type}
                  onChange={(e) =>
                    setNewCategory((prev) => ({
                      ...prev,
                      type: e.target.value as any,
                    }))
                  }
                  disabled={!canManage}
                  className="input mt-1 text-text dark:text-text"
                >
                  <option value="expense">Despesa</option>
                  <option value="income">Receita</option>
                  <option value="both">Ambos</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-text dark:text-muted">
                  Cor
                </label>
                <input
                  type="color"
                  value={newCategory.color}
                  disabled={!canManage}
                  onChange={(e) =>
                    setNewCategory((prev) => ({
                      ...prev,
                      color: e.target.value,
                    }))
                  }
                  className="mt-1 h-11 w-full rounded-control border border-border bg-surface p-1 text-text dark:border-border dark:bg-surface-strong dark:text-text"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-text dark:text-muted">
                Ícone
              </label>
              <input
                value={newCategory.icon}
                onChange={(e) =>
                  setNewCategory((prev) => ({ ...prev, icon: e.target.value }))
                }
                disabled={!canManage}
                className="input mt-1 text-text placeholder:text-muted dark:text-text"
                placeholder="Ex: Wallet"
              />
              <p className="text-xs text-muted mt-1">
                Nome do ícone Lucide (opcional)
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={saveCategory}
                disabled={!canManage || saving}
                className="btn-primary flex-1"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : editing ? (
                  "Salvar alterações"
                ) : (
                  "Adicionar categoria"
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setEditing(null);
                }}
                className="btn-outline flex-1"
              >
                Limpar
              </button>
            </div>
          </div>
        </section>
      </div>

      <section className="card border border-border dark:border-border bg-surface dark:bg-surface p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text dark:text-text">
              Categorias cadastradas
            </h2>
            <p className="text-sm text-muted dark:text-muted mt-1">
              Visualize suas categorias e gerencie conforme seu plano.
            </p>
          </div>
          <span className="rounded-full bg-surface-strong px-3 py-1 text-xs font-semibold text-text dark:bg-surface-strong dark:text-text">
            {categories.length} categorias
          </span>
        </div>

        {loading ? (
          <div className="mt-4"><SkeletonRows rows={5} /></div>
        ) : error ? (
          <div className="mt-6 rounded-card border border-expense/30 bg-expense/15 p-4 text-expense">
            {error}
          </div>
        ) : categories.length === 0 ? (
          <div className="mt-6 rounded-card border border-dashed border-border-strong bg-surface p-8 text-center text-muted dark:border-border dark:bg-surface-strong/40 dark:text-muted">
            Nenhuma categoria encontrada.
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {categories.map((category) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-card border border-border bg-surface p-4 dark:border-border dark:bg-surface-strong/50"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 text-text dark:text-text">
                      <span
                        className="inline-flex h-10 w-10 items-center justify-center rounded-card"
                        style={{ backgroundColor: category.color || "#E0E7FF" }}
                      >
                        <Tag className="w-5 h-5 text-white" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-text dark:text-text truncate">
                          {category.name}
                        </p>
                        <p className="text-sm text-muted dark:text-muted">
                          {category.type === "income"
                            ? "Receita"
                            : category.type === "expense"
                              ? "Despesa"
                              : "Ambos"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                      <span className="chip bg-surface-strong text-muted">
                        ID: {category.id.slice(0, 8)}
                      </span>
                      <span className="chip bg-surface-strong text-muted">
                        Ativa: {category.isActive ? "Sim" : "Não"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => startEdit(category)}
                      className="btn-outline flex items-center gap-2 rounded-card px-4 py-2 text-sm"
                      disabled={!canManage}
                    >
                      <Edit2 className="w-4 h-4" /> Editar
                    </button>
                    <button
                      onClick={() => removeCategory(category)}
                      className="btn-ghost flex items-center gap-2 rounded-card px-4 py-2 text-sm text-expense hover:bg-expense/15"
                      disabled={!canManage}
                    >
                      <Trash2 className="w-4 h-4" /> Excluir
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
