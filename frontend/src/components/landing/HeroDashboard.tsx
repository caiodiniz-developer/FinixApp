import { motion } from "framer-motion";
import { Target, TrendingUp, Brain } from "lucide-react";

export function HeroDashboard() {
  const bars = [40, 62, 50, 78, 55, 84, 70, 92, 66, 88, 75, 95];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, rotateX: -5 }}
      animate={{ opacity: 1, scale: 1, rotateX: 0 }}
      transition={{ duration: 0.8, delay: 0.2, type: "spring", stiffness: 70 }}
      className="relative perspective"
    >
      <div className="absolute -inset-4 sm:-inset-8 bg-gradient-to-br from-brand-blue/30 via-brand-blue-strong/30 to-brand-green/30 blur-3xl rounded-full opacity-60" />
      <motion.div
        initial={{ opacity: 0, x: 30, y: 20 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 0.8 }}
        className="hidden sm:block absolute -left-8 top-44 z-20 card !p-4 w-56 bg-surface/95 backdrop-blur"
        style={{ boxShadow: "0 20px 60px -20px rgba(37,99,235,0.4)" }}
      >
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-blue-strong to-pink-500 flex items-center justify-center text-white">
              <Brain className="w-4 h-4" />
            </div>
            <div className="text-xs font-semibold">Finix IA</div>
          </div>
          <p className="text-xs text-muted mt-2 leading-snug">
            Você economizou <b className="text-brand-green">62%</b> da sua renda
            este mês! 🎉
          </p>
        </motion.div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: -30, y: -10 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ delay: 1 }}
        className="hidden sm:block absolute -right-6 -bottom-6 z-20 card !p-4 w-52 bg-surface/95 backdrop-blur"
        style={{ boxShadow: "0 20px 60px -20px rgba(34,197,94,0.4)" }}
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-green to-emerald-500 flex items-center justify-center text-white">
              <Target className="w-4 h-4" />
            </div>
            <div className="text-xs font-semibold">Meta atingível</div>
          </div>
          <div className="text-xs text-muted mt-1.5">Notebook novo</div>
          <div className="h-2 bg-surface rounded-full mt-1.5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "69%" }}
              transition={{ delay: 1.2, duration: 1.2 }}
              className="h-full bg-gradient-to-r from-brand-green to-emerald-500"
            />
          </div>
          <div className="text-[10px] text-muted mt-1">
            R$ 5.500 / 8.000 · 69%
          </div>
        </motion.div>
      </motion.div>
      <div
        className="relative card !p-4 sm:!p-6 bg-surface/95 backdrop-blur border border-white"
        style={{ boxShadow: "0 30px 80px -30px rgba(37,99,235,0.5)" }}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
          <div>
            <div className="text-xs font-semibold text-muted uppercase tracking-wider">
              Saldo total
            </div>
            <div className="text-2xl sm:text-3xl font-display font-extrabold mt-1 tabular-nums">
              R$ 19.230,75
            </div>
          </div>
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="chip bg-brand-green/10 text-brand-green border border-brand-green/30"
          >
            <TrendingUp className="w-3.5 h-3.5" /> +18%
          </motion.div>
        </div>
        <div className="mt-4 sm:mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          {[
            {
              label: "Receitas",
              value: "R$ 31,1k",
              color: "from-green-500 to-emerald-500",
            },
            {
              label: "Despesas",
              value: "R$ 11,9k",
              color: "from-rose-500 to-red-500",
            },
            {
              label: "Metas",
              value: "R$ 16,0k",
              color: "from-brand-blue to-brand-blue-strong",
            },
          ].map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + i * 0.1 }}
              className="rounded-lg sm:rounded-xl bg-background p-2 sm:p-3"
            >
              <div
                className={`h-0.5 sm:h-1 rounded-full bg-gradient-to-r ${c.color} mb-1 sm:mb-2`}
              />
              <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted">
                {c.label}
              </div>
              <div className="font-bold text-xs sm:text-sm">{c.value}</div>
            </motion.div>
          ))}
        </div>
        <div className="mt-4 sm:mt-6 h-24 sm:h-32 flex items-end gap-1">
          {bars.map((h, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{
                delay: 0.3 + i * 0.04,
                duration: 0.6,
                ease: "easeOut",
              }}
              className="flex-1 rounded-t-md bg-gradient-to-t from-brand-blue to-brand-blue-strong"
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-muted mt-1">
          <span>Nov</span>
          <span className="hidden sm:inline">Dez</span>
          <span>Jan</span>
          <span className="hidden sm:inline">Fev</span>
          <span>Mar</span>
          <span className="hidden sm:inline">Abr</span>
        </div>
      </div>
    </motion.div>
  );
}
