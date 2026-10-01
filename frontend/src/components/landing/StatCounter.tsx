import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

export function useCountUp(to: number, duration = 1.6, start = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / (duration * 1000));
      setVal(Math.floor(to * (0.5 - Math.cos(Math.PI * p) / 2)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, duration, start]);
  return val;
}

export function StatCounter({
  value,
  label,
  suffix = "",
  prefix = "",
}: {
  value: number;
  label: string;
  suffix?: string;
  prefix?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const n = useCountUp(value, 1.8, inView);
  return (
    <div ref={ref} className="text-center">
      <div className="text-4xl sm:text-5xl font-display font-extrabold bg-gradient-to-br from-brand-blue via-brand-purple to-brand-green bg-clip-text text-transparent tabular-nums">
        {prefix}
        {n.toLocaleString("pt-BR")}
        {suffix}
      </div>
      <div className="text-sm text-muted mt-2">{label}</div>
    </div>
  );
}
