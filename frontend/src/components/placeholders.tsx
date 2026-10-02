import type { LucideIcon } from "lucide-react";

/**
 * Small illustration for an empty screen: the screen's own icon on a glass
 * tile, over a soft halo with a couple of "ghost" cards behind it — a hint of
 * what will live there.
 */
export function EmptyArt({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="empty-art" aria-hidden="true">
      <svg viewBox="0 0 160 120" width="160" height="120" fill="none">
        <defs>
          <radialGradient id="empty-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgb(var(--c-primary))" stopOpacity="0.22" />
            <stop offset="100%" stopColor="rgb(var(--c-primary))" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="80" cy="62" r="58" fill="url(#empty-halo)" />
        <circle cx="80" cy="62" r="44" stroke="rgb(var(--c-primary))" strokeOpacity="0.25" strokeDasharray="3 6" />
        {/* ghost cards */}
        <rect x="26" y="38" width="64" height="40" rx="9" transform="rotate(-10 58 58)"
          fill="var(--color-surface)" stroke="var(--color-border-strong)" />
        <rect x="72" y="46" width="64" height="40" rx="9" transform="rotate(8 104 66)"
          fill="var(--color-surface)" stroke="var(--color-border-strong)" />
        <rect x="82" y="58" width="26" height="4" rx="2" transform="rotate(8 104 66)" fill="var(--color-hairline-strong)" />
        <rect x="82" y="67" width="40" height="4" rx="2" transform="rotate(8 104 66)" fill="var(--color-hairline-strong)" />
        {/* sparkles */}
        <circle className="empty-art-dot" cx="30" cy="26" r="3" fill="rgb(var(--c-primary))" fillOpacity="0.5" />
        <circle className="empty-art-dot" cx="134" cy="30" r="2.5" fill="rgb(var(--c-income))" fillOpacity="0.6" style={{ animationDelay: "0.6s" }} />
        <circle className="empty-art-dot" cx="138" cy="98" r="3.5" fill="rgb(var(--c-warning))" fillOpacity="0.5" style={{ animationDelay: "1.2s" }} />
        <path d="M22 92h8M26 88v8" stroke="rgb(var(--c-primary))" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <div className="empty-art-tile glass">
        <Icon className="w-6 h-6" />
      </div>
    </div>
  );
}

/** Loading placeholder shaped like the cards of a list screen (goal, budget, account…). */
export function SkeletonCard() {
  return (
    <div className="card space-y-4" aria-hidden="true">
      <div className="flex items-center gap-3">
        <div className="skeleton w-10 h-10 !rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3.5 w-1/2" />
          <div className="skeleton h-3 w-1/3" />
        </div>
      </div>
      <div className="skeleton h-6 w-2/5" />
      <div className="skeleton h-2 w-full !rounded-full" />
    </div>
  );
}

/** Loading placeholder shaped like list rows (transactions, alerts, categories). */
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y" style={{ borderColor: "var(--color-hairline-strong)" }} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-4" style={{ borderColor: "var(--color-hairline-strong)" }}>
          <div className="skeleton w-9 h-9 !rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5" style={{ width: `${45 - (i % 3) * 8}%` }} />
            <div className="skeleton h-3" style={{ width: `${28 - (i % 2) * 6}%` }} />
          </div>
          <div className="skeleton h-4 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}
