import { useEffect, useRef } from "react";
import { gsap } from "../../lib/gsap";
import { currency } from "../../utils/format";

/** Animates a currency value counting up from 0 whenever it changes. */
export function CountUpCurrency({
  value,
  className,
  style,
  duration = 1.1,
}: {
  value: number;
  className?: string;
  style?: React.CSSProperties;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = currency(value);
      return;
    }
    const proxy = { v: 0 };
    const tween = gsap.to(proxy, {
      v: value,
      duration,
      ease: "power3.out",
      onUpdate: () => {
        if (el) el.textContent = currency(proxy.v);
      },
    });
    return () => {
      tween.kill();
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={className} style={style}>
      {currency(0)}
    </span>
  );
}
