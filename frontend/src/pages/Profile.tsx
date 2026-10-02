import { useEffect, useState } from "react";
import { blobToDataUrl, downscaleImage } from "../utils/image";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Download,
  Upload,
  ShieldCheck,
  Loader2,
  Camera,
  Landmark,
  FileSpreadsheet,
} from "lucide-react";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../services/api";
import { ActivePill } from "../components/motion";
import { useAuth } from "../contexts/AuthContext";
import { useUserPhoto } from "../hooks/useUserPhoto";
import { IntegrationsTab } from "../components/profile/IntegrationsTab";
import { ToolsTab } from "../components/profile/ToolsTab";

// Standard VAPID-key conversion (base64url -> Uint8Array) required by the
// browser's PushManager.subscribe — same snippet every Web Push guide uses.
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

const nameSchema = yup.object({
  name: yup.string().min(2).required("Informe seu nome"),
});
const pwSchema = yup.object({
  currentPassword: yup.string().required("Informe a senha atual"),
  newPassword: yup
    .string()
    .min(6, "Mínimo 6 caracteres")
    .required("Informe a nova senha"),
});

type Tab =
  | "Perfil"
  | "Segurança"
  | "Assinatura"
  | "Notificações"
  | "Empresa"
  | "Exportação"
  | "Integrações"
  | "Ferramentas";

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const userPhoto = useUserPhoto(user);
  const [tab, setTab] = useState<Tab>("Perfil");
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [planInfo, setPlanInfo] = useState<any>(null);
  const [notifSettings, setNotifSettings] = useState({
    email: true,
    push: true,
    whatsapp: true,
  });

  // 2FA
  const [twoFactorSetup, setTwoFactorSetup] = useState<{ secret: string; qrCode: string } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);

  // Push notifications
  const [pushSubscribed, setPushSubscribed] = useState(false);

  const [importing, setImporting] = useState(false);

  const startTwoFactorSetup = async () => {
    setTwoFactorLoading(true);
    try {
      const { data } = await api.post("/api/2fa/setup");
      setTwoFactorSetup(data);
    } catch (err: any) {
      toast.error(apiErrorMessage(err));
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const confirmTwoFactorSetup = async () => {
    setTwoFactorLoading(true);
    try {
      const { data } = await api.post("/api/2fa/verify", { token: twoFactorCode });
      setBackupCodes(data.backupCodes);
      setTwoFactorSetup(null);
      setTwoFactorCode("");
      await refreshUser();
      toast.success("2FA ativado! Guarde seus códigos de backup.");
    } catch (err: any) {
      toast.error(apiErrorMessage(err));
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const disableTwoFactor = async () => {
    setTwoFactorLoading(true);
    try {
      await api.post("/api/2fa/disable", { password: disablePassword, token: disableCode });
      setDisablePassword("");
      setDisableCode("");
      await refreshUser();
      toast.success("2FA desativado");
    } catch (err: any) {
      toast.error(apiErrorMessage(err));
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const enablePush = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast.error("Seu navegador não suporta notificações push");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Permissão de notificação negada");
        return;
      }
      const { data: vapid } = await api.get("/api/push/vapid-public-key");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
      });
      await api.post("/api/push/subscribe", sub.toJSON());
      setPushSubscribed(true);
      toast.success("Notificações push ativadas!");
    } catch (err: any) {
      toast.error(err?.response?.status === 501 ? "Push não configurado no servidor" : apiErrorMessage(err));
    }
  };

  const exportCsv = async () => {
    try {
      const response = await api.get("/api/reports/csv", { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "finix-transacoes.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(apiErrorMessage(err));
    }
  };

  const exportOfx = async () => {
    try {
      const response = await api.get("/api/reports/ofx", { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "finix-transacoes.ofx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(apiErrorMessage(err));
    }
  };

  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post("/api/transactions/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(`${data.imported} transações importadas!`);
    } catch (err: any) {
      toast.error(apiErrorMessage(err));
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const nameForm = useForm<{ name: string }>({
    resolver: yupResolver(nameSchema) as any,
    defaultValues: { name: user?.name || "" },
  });

  const pwForm = useForm<{ currentPassword: string; newPassword: string }>({
    resolver: yupResolver(pwSchema) as any,
  });

  useEffect(() => {
    fetchPlanInfo();
  }, [user?.id]);

  const fetchPlanInfo = async () => {
    if (!user) return;
    try {
      const response = await api.get("/api/plans/me");
      setPlanInfo(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Reduz a imagem no navegador (avatar não precisa de mais que 512px) e envia
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem válida");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 15MB)");
      return;
    }

    setUploading(true);
    try {
      const photo = await blobToDataUrl(await downscaleImage(file, 512));
      setPreview(photo);
      await api.put("/api/profile", { photo });
      toast.success("Foto atualizada!");
      await refreshUser();
    } catch (err: any) {
      toast.error(apiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const onSaveName = async (data: { name: string }) => {
    try {
      await api.put("/api/profile", { name: data.name });
      toast.success("Nome atualizado!");
      await refreshUser();
    } catch (err: any) {
      toast.error(apiErrorMessage(err));
    }
  };

  const onChangePw = async (data: {
    currentPassword: string;
    newPassword: string;
  }) => {
    try {
      await api.put("/api/profile", data);
      toast.success("Senha alterada!");
      pwForm.reset();
    } catch (err: any) {
      toast.error(apiErrorMessage(err));
    }
  };

  const exportData = async (kind: "pdf" | "excel") => {
    try {
      const response = await api.get(`/api/export/${kind}`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        kind === "pdf" ? "finix-relatorio.pdf" : "finix-transacoes.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exportação iniciada!");
    } catch (err: any) {
      toast.error(apiErrorMessage(err));
    }
  };

  if (!user) return null;

  const photoSrc = preview || userPhoto.photo || null;
  const initials = user.name.charAt(0).toUpperCase();

  const planName =
    planInfo?.planDetails?.name ||
    (user.plan === "PRO"
      ? "Finix Pro"
      : user.plan === "BASIC"
        ? "Finix Básico"
        : "Grátis");
  const transactionLimit =
    planInfo?.planDetails?.transactionsLimit ??
    (user.plan === "BASIC" ? 500 : user.plan === "PRO" ? -1 : 0);
  const usedTransactions =
    planInfo?.transactionsUsed ?? user.transactionsUsed ?? 0;
  const planUsedPercent =
    transactionLimit === -1
      ? 100
      : transactionLimit === 0
        ? 0
        : Math.min(
            100,
            Math.round((usedTransactions / transactionLimit) * 100),
          );

  // Avatar reutilizável
  const Avatar = ({ size = 56 }: { size?: number }) => (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "999px",
        overflow: "hidden",
        flexShrink: 0,
        position: "relative",
      }}
    >
      {photoSrc ? (
        <img
          src={photoSrc}
          alt="Avatar"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "var(--color-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: size * 0.4,
            fontWeight: 700,
          }}
        >
          {initials}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6" data-testid="profile-page">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <Avatar size={48} />
          <div>
            <h1 className="page-title">{user.name}</h1>
            <p className="page-subtitle">Ajuste sua conta, veja o uso do plano e acesse exportações.</p>
          </div>
        </div>
        <span className="chip chip-primary self-start sm:self-auto">{planName}</span>
      </div>

      {/* Tabs — one row, scrolls sideways on a phone */}
      <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0" role="tablist"
        style={{ borderBottom: "1px solid var(--color-border)" }}>
        {(
          [
            "Perfil",
            "Segurança",
            "Assinatura",
            "Notificações",
            "Empresa",
            "Exportação",
            "Integrações",
            "Ferramentas",
          ] as Tab[]
        ).map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
            className="relative shrink-0 px-3.5 py-2.5 text-sm font-medium transition-colors -mb-px"
            style={{ color: tab === item ? "var(--color-primary)" : "var(--color-text-muted)" }}
          >
            {item}
            {tab === item && (
              <ActivePill group="profile-tab" className="!top-auto h-0.5 rounded-full" style={{ background: "var(--color-primary)" }} />
            )}
          </button>
        ))}
      </div>

      <div>
        <div className="space-y-6">
          {/* Perfil tab */}
          {tab === "Perfil" && (
            <section className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card"
                >
                  <h2 className="font-display font-semibold text-lg text-text">
                    Dados de usuário
                  </h2>
                  <form
                    onSubmit={nameForm.handleSubmit(onSaveName)}
                    className="mt-6 space-y-4"
                    data-testid="name-form"
                  >
                    <div>
                      <label className="text-sm font-medium text-muted">
                        Nome
                      </label>
                      <input
                        {...nameForm.register("name")} aria-invalid={!!nameForm.formState.errors.name}
                        className="input mt-1 text-text placeholder:text-muted dark:text-text"
                      />
                      {nameForm.formState.errors.name && (
                        <p className="text-xs text-expense mt-1">
                          {nameForm.formState.errors.name.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted">
                        E-mail
                      </label>
                      <input
                        value={user.email}
                        disabled
                        className="input mt-1 bg-surface-strong border-border text-muted cursor-not-allowed bg-surface-strong dark:border-border dark:text-muted"
                      />
                    </div>
                    <button
                      type="submit"
                      className="btn-primary w-full"
                      disabled={nameForm.formState.isSubmitting}
                    >
                      {nameForm.formState.isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Salvar alterações"
                      )}
                    </button>
                  </form>
                </motion.div>

                {/* Card de foto */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card"
                >
                  <h2 className="font-display font-semibold text-lg text-text">
                    Foto de perfil
                  </h2>
                  <div className="mt-6 flex flex-col items-center gap-6">
                    {/* Avatar grande com botão de câmera */}
                    <div
                      style={{ position: "relative", display: "inline-block" }}
                    >
                      <div
                        style={{
                          width: 100,
                          height: 100,
                          borderRadius: "999px",
                          overflow: "hidden",
                          border: "3px solid var(--color-primary)",
                        }}
                      >
                        {photoSrc ? (
                          <img
                            src={photoSrc}
                            alt="Foto de perfil"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              background:
                                "var(--color-primary)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#fff",
                              fontSize: 40,
                              fontWeight: 700,
                            }}
                          >
                            {initials}
                          </div>
                        )}
                      </div>

                      {/* Botão de câmera sobreposto */}
                      <label
                        htmlFor="photo-upload"
                        style={{
                          position: "absolute",
                          bottom: 0,
                          right: 0,
                          width: 32,
                          height: 32,
                          borderRadius: "999px",
                          background: "var(--color-primary)",
                          border: "2px solid #0F172A",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        {uploading ? (
                          <Loader2
                            style={{
                              width: 16,
                              height: 16,
                              color: "#fff",
                              animation: "spin 1s linear infinite",
                            }}
                          />
                        ) : (
                          <Camera
                            style={{ width: 16, height: 16, color: "#fff" }}
                          />
                        )}
                      </label>
                      <input
                        id="photo-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        style={{ display: "none" }}
                      />
                    </div>

                    <div className="text-center">
                      <p className="text-sm font-semibold text-text">
                        {user.name}
                      </p>
                      <p className="text-xs text-muted mt-1">
                        Clique no ícone de câmera para trocar a foto
                      </p>
                      <p className="text-xs text-muted mt-1">
                        JPG, PNG ou GIF • máx 5MB
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </section>
          )}

          {/* Segurança tab */}
          {tab === "Segurança" && (
            <section className="card">
              <h2 className="font-display font-semibold text-lg text-text">
                Segurança
              </h2>
              <p className="mt-2 text-sm text-muted">
                Mantenha sua conta protegida.
              </p>
              <form
                onSubmit={pwForm.handleSubmit(onChangePw)}
                className="mt-6 space-y-4"
                data-testid="password-form"
              >
                <div>
                  <label className="text-sm font-medium text-muted">
                    Senha atual
                  </label>
                  <input
                    type="password"
                    {...pwForm.register("currentPassword")} aria-invalid={!!pwForm.formState.errors.currentPassword}
                    className="input mt-1 text-text placeholder:text-muted dark:text-text"
                  />
                  {pwForm.formState.errors.currentPassword && (
                    <p className="text-xs text-expense mt-1">
                      {pwForm.formState.errors.currentPassword.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-muted">
                    Nova senha
                  </label>
                  <input
                    type="password"
                    {...pwForm.register("newPassword")} aria-invalid={!!pwForm.formState.errors.newPassword}
                    className="input mt-1 text-text placeholder:text-muted dark:text-text"
                  />
                  {pwForm.formState.errors.newPassword && (
                    <p className="text-xs text-expense mt-1">
                      {pwForm.formState.errors.newPassword.message}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  className="btn-primary w-full"
                  disabled={pwForm.formState.isSubmitting}
                >
                  {pwForm.formState.isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Atualizar senha"
                  )}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-text">Autenticação em duas etapas (2FA)</h3>
                    <p className="text-sm text-muted mt-1">
                      {user.twoFactorEnabled
                        ? "Ativada — seu login pede um código do aplicativo autenticador."
                        : "Adicione uma camada extra de proteção usando um aplicativo autenticador (Google Authenticator, Authy...)."}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${user.twoFactorEnabled ? "bg-income/10 text-income" : "bg-surface-strong text-muted"}`}>
                    {user.twoFactorEnabled ? "Ativado" : "Desativado"}
                  </span>
                </div>

                {!user.twoFactorEnabled && !twoFactorSetup && !backupCodes && (
                  <button onClick={startTwoFactorSetup} disabled={twoFactorLoading} className="btn-primary mt-4">
                    {twoFactorLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ativar 2FA"}
                  </button>
                )}

                {twoFactorSetup && (
                  <div className="mt-4 rounded-card border border-border bg-surface-strong p-4 space-y-3">
                    <p className="text-sm text-text">1. Escaneie o QR code com seu app autenticador:</p>
                    <img src={twoFactorSetup.qrCode} alt="QR code 2FA" className="w-40 h-40 rounded-control border border-border" />
                    <p className="text-xs text-muted">Ou digite manualmente: <code className="font-mono">{twoFactorSetup.secret}</code></p>
                    <p className="text-sm text-text">2. Digite o código de 6 dígitos gerado:</p>
                    <input
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value)}
                      className="input text-center font-mono"
                      placeholder="000000"
                      maxLength={6}
                    />
                    <button onClick={confirmTwoFactorSetup} disabled={twoFactorLoading || !twoFactorCode} className="btn-primary w-full">
                      {twoFactorLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar e ativar"}
                    </button>
                  </div>
                )}

                {backupCodes && (
                  <div className="mt-4 rounded-card border border-warning/30 bg-warning/5 p-4">
                    <p className="text-sm font-semibold text-text">Guarde seus códigos de backup</p>
                    <p className="text-xs text-muted mt-1">Cada um funciona uma vez, caso você perca acesso ao autenticador. Eles não serão mostrados novamente.</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs">
                      {backupCodes.map((c) => (
                        <div key={c} className="rounded-lg bg-surface-strong px-2 py-1.5 text-text">{c}</div>
                      ))}
                    </div>
                    <button onClick={() => setBackupCodes(null)} className="btn-outline mt-3 w-full">Já guardei</button>
                  </div>
                )}

                {user.twoFactorEnabled && (
                  <div className="mt-4 rounded-card border border-border bg-surface-strong p-4 space-y-3">
                    <p className="text-sm text-text">Para desativar, confirme sua senha e um código atual:</p>
                    <input type="password" value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)}
                      className="input" placeholder="Senha atual" />
                    <input value={disableCode} onChange={(e) => setDisableCode(e.target.value)}
                      className="input font-mono" placeholder="Código 2FA" maxLength={6} />
                    <button onClick={disableTwoFactor} disabled={twoFactorLoading || !disablePassword || !disableCode}
                      className="btn-outline w-full text-expense">
                      {twoFactorLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Desativar 2FA"}
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Assinatura tab */}
          {tab === "Assinatura" && (
            <section className="grid gap-6 lg:grid-cols-2">
              <div className="card">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted">
                      Plano atual
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-text">
                      {planName}
                    </h2>
                  </div>
                  <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                    {user.plan}
                  </div>
                </div>
                <div className="mt-6">
                  <div className="flex items-center justify-between text-sm text-muted">
                    <span>Transações usadas</span>
                    <span>
                      {usedTransactions}
                      {transactionLimit === -1 ? "" : ` / ${transactionLimit}`}
                    </span>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-surface-strong">
                    <div
                      className="h-full rounded-full bg-primary-solid"
                      style={{ width: `${planUsedPercent}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs text-muted">
                    {transactionLimit === -1
                      ? "Movimentações ilimitadas"
                      : `${planUsedPercent}% do limite usado`}
                  </p>
                </div>
                <div className="mt-6 space-y-3">
                  <div className="rounded-card bg-surface-strong p-4 text-sm text-muted">
                    Transações:{" "}
                    {transactionLimit === -1
                      ? "Ilimitadas"
                      : transactionLimit === 0
                        ? "Não disponível no plano Free"
                        : `${transactionLimit} por mês`}
                  </div>
                  <div className="rounded-card bg-surface-strong p-4 text-sm text-muted">
                    Categoria personalizada:{" "}
                    {user.plan === "PRO" ? "Ativado" : "Bloqueado"}
                  </div>
                  <div className="rounded-card bg-surface-strong p-4 text-sm text-muted">
                    Exportação:{" "}
                    {user.plan === "PRO"
                      ? "PDF e Excel"
                      : user.plan === "BASIC"
                        ? "PDF apenas"
                        : "Não disponível"}
                  </div>
                </div>
              </div>
              <div className="card">
                <h3 className="font-semibold text-text">Atualize seu plano</h3>
                <p className="mt-2 text-sm text-muted">
                  Acesse recursos premium como gestão de categorias, IA e
                  suporte prioritário.
                </p>
                <Link
                  to="/app/plans"
                  className="btn-primary mt-6 inline-flex items-center gap-2"
                >
                  <ArrowRight className="w-4 h-4" /> Ver planos
                </Link>
              </div>
            </section>
          )}

          {/* Notificações tab */}
          {tab === "Notificações" && (
            <section className="card">
              <h2 className="font-display font-semibold text-lg text-text">
                Notificações
              </h2>
              <p className="mt-2 text-sm text-muted">
                Configure os canais de alerta que deseja receber.
              </p>
              <div className="mt-6 space-y-4">
                {(["email", "push", "whatsapp"] as const).map((channel) => (
                  <label
                    key={channel}
                    className="flex items-center justify-between rounded-card border border-border bg-surface-strong p-4"
                  >
                    <div>
                      <p className="font-semibold text-text">
                        {channel === "email"
                          ? "E-mail"
                          : channel === "push"
                            ? "Push"
                            : "WhatsApp"}
                      </p>
                      <p className="text-sm text-muted">
                        Receba alertas sobre parcelas e pendências por{" "}
                        {channel === "email"
                          ? "e-mail"
                          : channel === "push"
                            ? "notificações no navegador"
                            : "WhatsApp"}
                        .
                      </p>
                    </div>
                    {channel === "push" ? (
                      <button
                        onClick={enablePush}
                        disabled={pushSubscribed}
                        className={`rounded-full px-4 py-1.5 text-xs font-semibold ${pushSubscribed ? "bg-income/10 text-income" : "btn-primary !py-1.5"}`}
                      >
                        {pushSubscribed ? "Ativado" : "Ativar"}
                      </button>
                    ) : (
                      <input
                        type="checkbox"
                        checked={notifSettings[channel]}
                        onChange={(e) =>
                          setNotifSettings((prev) => ({
                            ...prev,
                            [channel]: e.target.checked,
                          }))
                        }
                        className="h-5 w-5 rounded border-border text-primary focus:ring-primary"
                      />
                    )}
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* Empresa tab */}
          {tab === "Empresa" && (
            <section className="card">
              <h2 className="font-display font-semibold text-lg text-text">
                Empresa
              </h2>
              <p className="mt-2 text-sm text-muted">
                Gerencie informações da sua empresa.
              </p>
              {user.plan === "PRO" ? (
                <div className="mt-6 grid gap-4">
                  <div className="rounded-card border border-border bg-surface-strong p-4">
                    <p className="text-sm text-muted">Razão social</p>
                    <p className="mt-2 text-text">
                      {user.companyName || "Não informada"}
                    </p>
                  </div>
                  <div className="rounded-card border border-border bg-surface-strong p-4">
                    <p className="text-sm text-muted">Logo</p>
                    {userPhoto.companyLogo ? (
                      <img
                        src={userPhoto.companyLogo}
                        alt="Logo da empresa"
                        className="mt-3 h-20 w-20 rounded-card object-cover"
                      />
                    ) : (
                      <p className="mt-2 text-muted">Nenhuma logo carregada.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-card border border-border bg-surface-strong p-6 text-muted">
                  <p className="font-semibold text-text">
                    Recurso disponível apenas no plano Pro
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    Para adicionar empresa, CNPJ e personalização, atualize seu
                    plano.
                  </p>
                  <Link
                    to="/app/plans"
                    className="btn-outline mt-4 inline-flex items-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4" /> Ver planos Pro
                  </Link>
                </div>
              )}
            </section>
          )}

          {/* Exportação tab */}
          {tab === "Exportação" && (
            <section className="card">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-display font-semibold text-lg text-text">
                    Exportação de dados
                  </h2>
                  <p className="mt-2 text-sm text-muted">
                    Baixe seu histórico em PDF ou Excel.
                  </p>
                </div>
                <div className="rounded-full bg-surface-strong px-3 py-1 text-sm text-muted">
                  {user.plan === "PRO"
                    ? "Completo"
                    : user.plan === "BASIC"
                      ? "Parcial"
                      : "Limitado"}
                </div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <button
                  onClick={() => exportData("pdf")}
                  className="btn-primary w-full inline-flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" /> Exportar PDF
                </button>
                <button
                  onClick={() => exportData("excel")}
                  className="btn-outline w-full inline-flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" /> Exportar Excel
                </button>
              </div>
              <p className="mt-4 text-sm text-muted">
                Exportação Excel disponível apenas no plano Pro.
              </p>

              <div className="mt-8 pt-6 border-t border-border">
                <h3 className="font-semibold text-text">CSV e OFX</h3>
                <p className="mt-1 text-sm text-muted">
                  CSV abre em qualquer planilha; OFX é lido por apps de finanças (Money, Quicken, GnuCash).
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <button onClick={exportCsv} className="btn-outline w-full inline-flex items-center justify-center gap-2">
                    <FileSpreadsheet className="w-4 h-4" /> Exportar CSV
                  </button>
                  <button onClick={exportOfx} className="btn-outline w-full inline-flex items-center justify-center gap-2">
                    <Landmark className="w-4 h-4" /> Exportar OFX
                  </button>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-border">
                <h3 className="font-semibold text-text">Importar transações</h3>
                <p className="mt-1 text-sm text-muted">
                  Envie um arquivo .csv (colunas: data, título, valor, tipo, categoria) ou .ofx/.qfx do seu banco.
                </p>
                <label className="btn-primary mt-4 inline-flex items-center gap-2 cursor-pointer">
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Escolher arquivo
                  <input type="file" accept=".csv,.ofx,.qfx" onChange={importFile} className="hidden" disabled={importing} />
                </label>
              </div>
            </section>
          )}

          {/* Integrações tab */}
          {tab === "Integrações" && (
            <IntegrationsTab />
          )}

          {/* Ferramentas tab */}
          {tab === "Ferramentas" && (
            <ToolsTab />
          )}
        </div>
      </div>
    </div>
  );
}
