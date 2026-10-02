import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { currency } from "../utils/format";

/** True when the person asked the system for less motion. */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * A number that counts up to its value: from zero the first time, from the
 * previous value when it changes. The final frame is always the exact value.
 */
export function CountUp({ value, format = currency, duration = 900 }: {
  value: number;
  format?: (v: number) => string;
  duration?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const from = useRef(0);

  useEffect(() => {
    if (reduced) { setShown(value); from.current = value; return; }
    const start = from.current;
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 4);
      const current = t === 1 ? value : start + (value - start) * eased;
      from.current = current;
      setShown(current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced]);

  return <>{format(shown)}</>;
}

/**
 * The highlight behind the selected item of a group (menu, tabs). Render it
 * inside the selected item only; items sharing a `group` make it slide from
 * one to the other. The parent needs `relative`, its content `relative z-10`.
 */
export function ActivePill({ group, className = "", style }: {
  group: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <motion.span
      layoutId={group}
      aria-hidden="true"
      className={`absolute inset-0 ${className}`}
      style={style}
      transition={{ type: "spring", stiffness: 520, damping: 40 }}
    />
  );
}

/** Progress bar that fills when it appears. */
export function ProgressBar({ pct, color, className = "h-1.5" }: { pct: number; color: string; className?: string }) {
  return (
    <div className={`${className} rounded-full overflow-hidden`} style={{ background: "var(--color-hairline-strong)" }}>
      <div className="progress-fill h-full rounded-full" style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, background: color }} />
    </div>
  );
}
