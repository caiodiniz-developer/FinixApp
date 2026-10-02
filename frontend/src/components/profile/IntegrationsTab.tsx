import { useEffect, useState } from "react";
import { Webhook, KeyRound, Copy, Trash2, Landmark } from "lucide-react";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../../services/api";
import { WebhookSubscription, ApiKeySummary, ExternalConnection } from "../../types";

/** Profile → Integrações: Open Finance connections, outbound webhooks and API keys. */
export function IntegrationsTab() {
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeySummary[]>([]);
  const [connections, setConnections] = useState<ExternalConnection[]>([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newApiKeyLabel, setNewApiKeyLabel] = useState("");
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  const [createdWebhookSecret, setCreatedWebhookSecret] = useState<string | null>(null);

  useEffect(() => {
    api.get("/api/webhooks").then((r) => setWebhooks(r.data)).catch(() => {});
    api.get("/api/api-keys").then((r) => setApiKeys(r.data)).catch(() => {});
    api.get("/api/open-finance/connections").then((r) => setConnections(r.data)).catch(() => {});
  }, []);

  const createWebhook = async () => {
    if (!newWebhookUrl) return;
    try {
      const { data } = await api.post("/api/webhooks", {
        url: newWebhookUrl,
        events: ["transaction.created", "goal.completed", "alert.due_soon"],
      });
      setCreatedWebhookSecret(data.secret);
      setWebhooks((prev) => [...prev, data]);
      setNewWebhookUrl("");
    } catch (err: any) {
      toast.error(apiErrorMessage(err));
    }
  };

  const deleteWebhook = async (id: string) => {
    await api.delete(`/api/webhooks/${id}`).catch(() => {});
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  };

  const createApiKey = async () => {
    if (!newApiKeyLabel) return;
    try {
      const { data } = await api.post("/api/api-keys", { label: newApiKeyLabel });
      setCreatedApiKey(data.key);
      setApiKeys((prev) => [{ id: data.id, label: data.label, keyPrefix: data.keyPrefix, createdAt: new Date().toISOString() }, ...prev]);
      setNewApiKeyLabel("");
    } catch (err: any) {
      toast.error(apiErrorMessage(err));
    }
  };

  const deleteApiKey = async (id: string) => {
    await api.delete(`/api/api-keys/${id}`).catch(() => {});
    setApiKeys((prev) => prev.filter((k) => k.id !== id));
  };

  const connectBank = async () => {
    try {
      await api.post("/api/open-finance/connect-token");
      toast("Conexão bancária: fluxo de widget ainda não embutido — token gerado com sucesso.");
    } catch (err: any) {
      toast.error(
        err?.response?.status === 501
          ? "Conexão bancária não configurada (faltam credenciais Pluggy no servidor)"
          : apiErrorMessage(err),
      );
    }
  };

  return (
    <section className="space-y-6">
      {/* Open Finance */}
      <div className="rounded-card border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display font-semibold text-lg text-text flex items-center gap-2">
              <Landmark className="w-5 h-5" /> Contas conectadas (Open Finance)
            </h2>
            <p className="mt-2 text-sm text-muted">
              Conecte contas bancárias para importar transações automaticamente.
            </p>
          </div>
          <button onClick={connectBank} className="btn-primary shrink-0">Conectar banco</button>
        </div>
        {connections.length > 0 ? (
          <div className="mt-4 space-y-2">
            {connections.map((c) => (
              <div key={c.id} className="rounded-card bg-surface-strong p-3 text-sm text-text flex items-center justify-between">
                <span>{c.institution || c.provider} — {c.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-xs text-muted">
            Nenhuma conta conectada ainda. Requer configuração de credenciais Pluggy no servidor.
          </p>
        )}
      </div>

      {/* Webhooks */}
      <div className="rounded-card border border-border bg-surface p-6 shadow-sm">
        <h2 className="font-display font-semibold text-lg text-text flex items-center gap-2">
          <Webhook className="w-5 h-5" /> Webhooks
        </h2>
        <p className="mt-2 text-sm text-muted">
          Receba um POST assinado (HMAC) quando uma transação, meta ou alerta acontecer — útil para integrar com Zapier, n8n ou seu próprio backend.
        </p>
        <div className="mt-4 flex gap-2">
          <input value={newWebhookUrl} onChange={(e) => setNewWebhookUrl(e.target.value)}
            className="input flex-1" placeholder="https://seu-endpoint.com/webhook" />
          <button onClick={createWebhook} className="btn-primary shrink-0">Adicionar</button>
        </div>
        {createdWebhookSecret && (
          <div className="mt-3 rounded-card border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
            <p className="font-semibold text-text">Segredo de assinatura (mostrado uma única vez):</p>
            <code className="block mt-1 font-mono break-all text-text">{createdWebhookSecret}</code>
          </div>
        )}
        <div className="mt-4 space-y-2">
          {webhooks.map((w) => (
            <div key={w.id} className="rounded-card bg-surface-strong p-3 text-sm text-text flex items-center justify-between gap-2">
              <span className="truncate">{w.url}</span>
              <button onClick={() => deleteWebhook(w.id)} className="text-muted hover:text-rose-500 shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* API Keys */}
      <div className="rounded-card border border-border bg-surface p-6 shadow-sm">
        <h2 className="font-display font-semibold text-lg text-text flex items-center gap-2">
          <KeyRound className="w-5 h-5" /> Chaves de API
        </h2>
        <p className="mt-2 text-sm text-muted">
          Use uma chave no header <code>X-Api-Key</code> para ler seus dados de fora do Finix (planilha, script, Zapier).
        </p>
        <div className="mt-4 flex gap-2">
          <input value={newApiKeyLabel} onChange={(e) => setNewApiKeyLabel(e.target.value)}
            className="input flex-1" placeholder="Nome da chave (ex: Planilha mensal)" />
          <button onClick={createApiKey} className="btn-primary shrink-0">Gerar</button>
        </div>
        {createdApiKey && (
          <div className="mt-3 rounded-card border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
            <p className="font-semibold text-text">Chave gerada (mostrada uma única vez):</p>
            <div className="flex items-center gap-2 mt-1">
              <code className="block font-mono break-all text-text flex-1">{createdApiKey}</code>
              <button onClick={() => { navigator.clipboard.writeText(createdApiKey); toast.success("Copiado!"); }}>
                <Copy className="w-4 h-4 text-muted hover:text-text" />
              </button>
            </div>
          </div>
        )}
        <div className="mt-4 space-y-2">
          {apiKeys.map((k) => (
            <div key={k.id} className="rounded-card bg-surface-strong p-3 text-sm text-text flex items-center justify-between gap-2">
              <span>{k.label} <span className="text-muted font-mono text-xs">({k.keyPrefix}…)</span></span>
              <button onClick={() => deleteApiKey(k.id)} className="text-muted hover:text-rose-500 shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
