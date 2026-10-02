import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CornerDownLeft, Plus, Search, type LucideIcon } from "lucide-react";

export interface Command {
  label: string;
  icon: LucideIcon;
  /** Route to open… */
  to?: string;
  /** …or something to do. */
  run?: () => void;
  /** Extra words that should also find it. */
  keywords?: string;
}

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
};

/**
 * "Ir para…": Ctrl/⌘ + K opens a search over every screen of the app, and
 * the letter N starts a new transaction from anywhere.
 */
export function CommandPalette({ commands, onNewTransaction, open, setOpen }: {
  commands: Command[];
  onNewTransaction: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const nav = useNavigate();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
        return;
      }
      if (open || isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      // Not while a dialog is already on screen.
      if (document.querySelector(".modal-overlay")) return;
      if (e.key.toLowerCase() === "n") { e.preventDefault(); onNewTransaction(); }
      if (e.key === "/") { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen, onNewTransaction]);

  useEffect(() => { if (open) { setQuery(""); setIndex(0); } }, [open]);

  const all = useMemo<Command[]>(
    () => [{ label: "Nova transação", icon: Plus, run: onNewTransaction, keywords: "adicionar criar gasto receita despesa" }, ...commands],
    [commands, onNewTransaction],
  );
  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return all;
    return all.filter((c) => normalize(`${c.label} ${c.keywords ?? ""}`).includes(q));
  }, [all, query]);

  useEffect(() => { setIndex(0); }, [query]);
  useEffect(() => {
    list.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!open) return null;

  const choose = (command: Command | undefined) => {
    if (!command) return;
    setOpen(false);
    if (command.run) command.run();
    else if (command.to) nav(command.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(results[index]); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div className="modal-overlay palette-overlay !z-[60]" onClick={() => setOpen(false)} data-testid="command-palette">
      <div className="modal-panel w-full max-w-lg !p-0 overflow-hidden" role="dialog" aria-label="Ir para" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <Search className="w-4 h-4 shrink-0" style={{ color: "var(--color-text-low)" }} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ir para…"
            className="flex-1 bg-transparent py-3.5 text-sm outline-none"
            style={{ color: "var(--color-text)" }}
            data-testid="command-input"
          />
          <kbd className="kbd hidden sm:inline-flex">Esc</kbd>
        </div>
        <div ref={list} className="max-h-[min(22rem,55vh)] overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm" style={{ color: "var(--color-text-low)" }}>Nada encontrado para "{query}"</p>
          ) : results.map((c, i) => (
            <button key={c.label} data-index={i} onClick={() => choose(c)} onMouseMove={() => setIndex(i)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-control text-sm text-left"
              style={i === index
                ? { background: "var(--color-primary-soft)", color: "var(--color-primary)" }
                : { color: "var(--color-text-muted)" }}>
              <c.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate">{c.label}</span>
              {i === index && <CornerDownLeft className="w-3.5 h-3.5 opacity-70" />}
            </button>
          ))}
        </div>
        <div className="hidden sm:flex items-center gap-4 px-4 py-2.5 text-2xs" style={{ borderTop: "1px solid var(--color-border)", color: "var(--color-text-low)" }}>
          <span><kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> navegar</span>
          <span><kbd className="kbd">Enter</kbd> abrir</span>
          <span className="ml-auto"><kbd className="kbd">N</kbd> nova transação em qualquer tela</span>
        </div>
      </div>
    </div>
  );
}
