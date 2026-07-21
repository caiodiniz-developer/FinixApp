import { useEffect, useRef } from "react";
import { gsap } from "../../lib/gsap";

const COLORS = ["#7c3aed", "#22c55e", "#38bdf8", "#fbbf24", "#f87171"];
const SESSION_KEY = "finix_celebration_fired";

/**
 * A short confetti burst (plain DOM nodes animated with GSAP, no canvas/lib)
 * fired once per session the first time the dashboard loads with an
 * "excellent" health score — a small reward moment, not a persistent widget.
 */
export function Celebration({ trigger }: { trigger: boolean }) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!trigger || firedRef.current) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    firedRef.current = true;
    sessionStorage.setItem(SESSION_KEY, "1");

    const root = document.createElement("div");
    root.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:60;overflow:hidden;";
    document.body.appendChild(root);

    const originX = window.innerWidth * 0.5;
    const originY = 110;
    const count = 28;
    const pieces: HTMLDivElement[] = [];

    for (let i = 0; i < count; i++) {
      const el = document.createElement("div");
      const size = 6 + Math.random() * 5;
      el.style.cssText = `position:absolute;left:${originX}px;top:${originY}px;width:${size}px;height:${size}px;border-radius:${Math.random() > 0.5 ? "50%" : "2px"};background:${COLORS[i % COLORS.length]};opacity:0.95;`;
      root.appendChild(el);
      pieces.push(el);
    }

    pieces.forEach((el, i) => {
      const angle = (Math.PI * 2 * i) / pieces.length + Math.random() * 0.6;
      const dist = 140 + Math.random() * 180;
      gsap.to(el, {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist + 80,
        rotation: Math.random() * 360,
        opacity: 0,
        duration: 1.1 + Math.random() * 0.5,
        ease: "power2.out",
      });
    });

    gsap.delayedCall(2, () => root.remove());
  }, [trigger]);

  return null;
}
