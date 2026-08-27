import { useEffect, useState } from "react";
import { Ghost, Repeat, X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../services/api";
import { DetectedSubscription } from "../types";
import { currency, dateBR } from "../utils/format";

export default function Subscriptions() {
  const [items, setItems] = useState<DetectedSubscription[] | null>(null);
  const [busySignature, setBusySignature] = useState<string | null>(null);

  const fetchData = async () => {
    const r = await api.get("/api/subscriptions/detected");
    setItems(r.data);
  };
  useEffect(() => {
    fetchData().catch(() => toast.error("Erro ao carregar"));
  }, []);

  const convert = async (item: DetectedSubscription) => {
    setBusySignature(item.signature);
    try {
      await api.post("/api/subscriptions/convert", {
        title: item.title,
        amount: item.avgAmount,
        category: "Assinaturas",
      });
      await api.post("/api/subscriptions/dismiss", { signature: item.signature });
      toast.success("Convertida em recorrência — agora ela aparece em Recorrências.");
      fetchData();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusySignature(null);
    }
  };

  const dismiss = async (item: DetectedSubscription) => {
    setBusySignature(item.signature);
    try {
      await api.post("/api/subscriptions/dismiss", { signature: item.signature });
      setItems((prev) => prev?.filter((i) => i.signature !== item.signature) || null);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setBusySignature(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="subscriptions-page">
      <div>
        <h1 className="text-3xl font-display font-extrabold tracking-tight flex items-center gap-2">
          <Ghost className="w-7 h-7 text-brand-purple" /> Caça-fantasma de assinaturas
        </h1>
        <p className="text-muted mt-1">
          Cobranças que se repetem no mesmo valor, todo mês, sem você ter marcado como recorrente. Pode ser uma assinatura que ninguém mais usa.
        </p>
      </div>

      {items === null ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => <div key={i} className="skeleton h-32" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="card text-center py-14">
          <Ghost className="w-12 h-12 mx-auto text-muted" />
          <p className="mt-3 font-semibold text-lg">Nenhum fantasma encontrado</p>
          <p className="text-sm text-muted mt-1">
            Assim que um mesmo lançamento se repetir 3 vezes com intervalo mensal, ele aparece aqui.
          </p>
        </div>
      ) : (
        <AnimatePresence>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <motion.div
                key={item.signature}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="card"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display font-bold truncate">{item.title}</h3>
                  <span className="text-xl font-bold text-red-500 shrink-0">{currency(item.avgAmount)}</span>
                </div>
                <p className="text-xs text-muted mt-1">
                  {item.occurrences}x cobrado, a cada ~{item.avgIntervalDays} dias, desde {dateBR(item.firstDate)}
                </p>
                <div className="mt-3 rounded-xl bg-surface-strong p-3 text-sm">
                  Já gastou <strong>{currency(item.totalSpent)}</strong> com isso até hoje.
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => convert(item)}
                    disabled={busySignature === item.signature}
                    className="btn-primary flex-1 !py-2 text-sm"
                  >
                    {busySignature === item.signature ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Repeat className="w-3.5 h-3.5" /> Rastrear</>}
                  </button>
                  <button
                    onClick={() => dismiss(item)}
                    disabled={busySignature === item.signature}
                    className="btn-outline !py-2 !px-3 text-sm"
                    title="Ignorar — não mostrar de novo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}
