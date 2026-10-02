const COLORS = ["#2563eb", "#38bdf8", "#22c55e", "#f59e0b", "#ec4899"];

/**
 * A short burst of confetti from the top of the screen. Reserved for the rare
 * good moment (a goal reached) — never for routine actions. Does nothing when
 * the system asks for less motion.
 */
export function celebrate() {
  if (typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:100;overflow:hidden";

  for (let i = 0; i < 70; i++) {
    const piece = document.createElement("span");
    const size = 6 + Math.random() * 6;
    piece.style.cssText = [
      "position:absolute",
      "top:-12px",
      `left:${Math.random() * 100}%`,
      `width:${size}px`,
      `height:${size * (Math.random() > 0.5 ? 1 : 0.45)}px`,
      `background:${COLORS[i % COLORS.length]}`,
      `border-radius:${Math.random() > 0.6 ? "50%" : "2px"}`,
      `--dx:${(Math.random() - 0.5) * 240}px`,
      `--dy:${window.innerHeight * (0.55 + Math.random() * 0.5)}px`,
      `--rot:${(Math.random() - 0.5) * 900}deg`,
      `animation:confetti-fall ${1.4 + Math.random() * 1.2}s cubic-bezier(0.2,0.6,0.4,1) ${Math.random() * 0.25}s forwards`,
    ].join(";");
    layer.appendChild(piece);
  }

  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), 3200);
}
