import { motion } from "framer-motion";
import { Target, Sparkles } from "lucide-react";

export function DashboardVisual() {
  return (
    <div
      className="card !p-5 bg-surface"
      style={{ boxShadow: "0 30px 60px -30px rgba(0,0,0,0.3)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="text-xs text-muted">finixapp.com.br/dashboard</div>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          {
            label: "Saldo",
            v: "R$ 19,2k",
            c: "from-brand-blue to-brand-purple",
          },
          {
            label: "Receitas",
            v: "R$ 31,1k",
            c: "from-green-500 to-emerald-500",
          },
          { label: "Despesas", v: "R$ 11,9k", c: "from-rose-500 to-red-500" },
          { label: "Metas", v: "R$ 16,0k", c: "from-amber-500 to-orange-500" },
        ].map((k) => (
          <div key={k.label} className="rounded-lg bg-background p-2">
            <div className={`h-0.5 rounded bg-gradient-to-r ${k.c} mb-1`} />
            <div className="text-[9px] uppercase text-muted">{k.label}</div>
            <div className="font-bold text-xs">{k.v}</div>
          </div>
        ))}
      </div>
      <svg viewBox="0 0 400 120" className="w-full">
        <defs>
          <linearGradient id="gLine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22C55E" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rLine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EF4444" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.5 }}
          d="M0 80 C 50 70, 90 40, 150 45 S 250 20, 320 15 L 400 10 L 400 120 L 0 120 Z"
          fill="url(#gLine)"
          stroke="#22C55E"
          strokeWidth="2"
        />
        <motion.path
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.5, delay: 0.3 }}
          d="M0 100 C 60 95, 100 85, 170 88 S 270 70, 340 65 L 400 62 L 400 120 L 0 120 Z"
          fill="url(#rLine)"
          stroke="#EF4444"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

export function AIInsightsVisual() {
  const items = [
    {
      t: "success",
      title: "Excelente controle! 🎉",
      msg: "Você economizou 62% da sua renda. Continue assim!",
    },
    {
      t: "warning",
      title: "Atenção: Moradia",
      msg: "Representa 67% dos gastos. Reavalie se possível.",
    },
    {
      t: "info",
      title: "Meta próxima 🎯",
      msg: "Notebook 69% concluído. Faltam R$ 2.500.",
    },
    {
      t: "success",
      title: "Saldo saudável 💰",
      msg: "R$ 19k é 62% da receita total. Ótima gestão.",
    },
  ];
  const colors: Record<string, string> = {
    success: "bg-emerald-50 border-emerald-200 text-emerald-900",
    warning: "bg-amber-50 border-amber-200 text-amber-900",
    info: "bg-blue-50 border-blue-200 text-blue-900",
  };
  return (
    <div
      className="relative rounded-2xl p-5 border border-brand-purple/20"
      style={{
        background:
          "linear-gradient(135deg, rgba(37,99,235,0.08) 0%, rgba(124,58,237,0.12) 50%, rgba(34,197,94,0.08) 100%)",
        boxShadow: "0 30px 60px -30px rgba(124,58,237,0.4)",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-blue to-brand-purple flex items-center justify-center text-white">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <div className="font-bold text-sm">Finix IA</div>
          <div className="text-[10px] text-muted">Análise inteligente</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.15 }}
            className={`rounded-lg border p-2.5 ${colors[item.t]}`}
          >
            <div className="font-semibold text-[11px]">{item.title}</div>
            <div className="text-[10px] opacity-80 mt-0.5 leading-snug">
              {item.msg}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function GoalsVisual() {
  const goals = [
    {
      t: "Reserva de emergência",
      pct: 41,
      cur: "R$ 6.200",
      tgt: "R$ 15.000",
      c: "from-brand-blue to-brand-purple",
    },
    {
      t: "Viagem Europa",
      pct: 17,
      cur: "R$ 4.300",
      tgt: "R$ 25.000",
      c: "from-brand-purple to-pink-500",
    },
    {
      t: "Notebook novo",
      pct: 69,
      cur: "R$ 5.500",
      tgt: "R$ 8.000",
      c: "from-brand-green to-emerald-500",
    },
  ];
  return (
    <div
      className="card !p-5 space-y-3"
      style={{ boxShadow: "0 30px 60px -30px rgba(0,0,0,0.3)" }}
    >
      {goals.map((g, i) => (
        <motion.div
          key={g.t}
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.15 }}
          className="rounded-xl border border-border p-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-brand-blue" />
              <span className="font-semibold text-sm">{g.t}</span>
            </div>
            <span className="text-xs font-bold text-brand-blue">{g.pct}%</span>
          </div>
          <div className="h-2 bg-surface rounded-full overflow-hidden mt-2">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${g.pct}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, delay: i * 0.15 }}
              className={`h-full rounded-full bg-gradient-to-r ${g.c}`}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted mt-1">
            <span>{g.cur}</span>
            <span>de {g.tgt}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export function CalendarVisual() {
  const days = [
    { d: 1, inc: 5000, exp: 0 },
    { d: 2, inc: 0, exp: 120 },
    { d: 3, inc: 0, exp: 350 },
    { d: 4, inc: 0, exp: 0 },
    { d: 5, inc: 0, exp: 89 },
    { d: 6, inc: 0, exp: 210 },
    { d: 7, inc: 2000, exp: 1200 },
    { d: 8, inc: 0, exp: 45 },
    { d: 9, inc: 0, exp: 0 },
    { d: 10, inc: 0, exp: 890 },
    { d: 11, inc: 500, exp: 67 },
    { d: 12, inc: 0, exp: 340 },
    { d: 13, inc: 0, exp: 123 },
    { d: 14, inc: 3000, exp: 2100 },
  ];
  return (
    <div
      className="card !p-5 bg-surface"
      style={{ boxShadow: "0 30px 60px -30px rgba(0,0,0,0.3)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-bold text-sm">Maio 2026</h4>
        <span className="text-xs text-brand-green font-semibold">
          +R$ 10.300
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
          <div key={i} className="text-[10px] text-muted font-semibold pb-1">
            {d}
          </div>
        ))}
        {days.map((day) => (
          <motion.div
            key={day.d}
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: day.d * 0.03 }}
            className={`rounded-lg p-1 text-center cursor-pointer hover:scale-105 transition ${day.inc > 0 ? "bg-green-50 border border-green-200" : day.exp > 0 ? "bg-red-50 border border-red-100" : "bg-background"}`}
          >
            <div className="text-[10px] font-semibold text-text">{day.d}</div>
            {day.inc > 0 && (
              <div className="text-[8px] text-green-600 font-bold truncate">
                +{(day.inc / 1000).toFixed(1)}k
              </div>
            )}
            {day.exp > 0 && (
              <div className="text-[8px] text-red-500 truncate">-{day.exp}</div>
            )}
          </motion.div>
        ))}
      </div>
      <div className="mt-3 flex gap-3 text-[10px] text-muted">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-green-100 border border-green-200" />{" "}
          Receita
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-red-50 border border-red-100" />{" "}
          Despesa
        </div>
      </div>
    </div>
  );
}
