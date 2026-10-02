import { useEffect, useState, type ReactNode } from "react";
import { motion, useAnimationControls, type PanInfo } from "framer-motion";
import { Edit2, Trash2 } from "lucide-react";

const ACTIONS_WIDTH = 128;

/** True on devices driven by a finger (phones, tablets). */
export function useTouchDevice() {
  const [touch, setTouch] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    const onChange = () => setTouch(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return touch;
}

/**
 * A list row that, on a phone, slides to the left to show "edit" and
 * "delete". With a mouse it is just a plain wrapper — the row keeps its own
 * buttons there.
 */
export function SwipeRow({ children, onEdit, onDelete, enabled, testid }: {
  children: ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  enabled: boolean;
  testid?: string;
}) {
  const controls = useAnimationControls();
  const [open, setOpen] = useState(false);

  if (!enabled) return <div data-testid={testid}>{children}</div>;

  const settle = (toOpen: boolean) => {
    setOpen(toOpen);
    controls.start({ x: toOpen ? -ACTIONS_WIDTH : 0, transition: { type: "spring", stiffness: 480, damping: 40 } });
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const far = info.offset.x < -ACTIONS_WIDTH / 2 || info.velocity.x < -400;
    settle(open ? info.offset.x < ACTIONS_WIDTH / 2 && info.velocity.x < 400 : far);
  };

  const act = (fn: () => void) => () => { settle(false); fn(); };

  return (
    <div className="relative overflow-hidden" data-testid={testid}>
      <div className="absolute inset-y-0 right-0 flex" style={{ width: ACTIONS_WIDTH }} aria-hidden={!open}>
        <button onClick={act(onEdit)} tabIndex={open ? 0 : -1} title="Editar"
          className="flex-1 flex flex-col items-center justify-center gap-1 text-2xs font-medium text-white"
          style={{ background: "rgb(var(--c-primary-solid))" }}>
          <Edit2 className="w-4 h-4" /> Editar
        </button>
        <button onClick={act(onDelete)} tabIndex={open ? 0 : -1} title="Excluir"
          className="flex-1 flex flex-col items-center justify-center gap-1 text-2xs font-medium text-white"
          style={{ background: "#dc2626" }}>
          <Trash2 className="w-4 h-4" /> Excluir
        </button>
      </div>
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -ACTIONS_WIDTH, right: 0 }}
        dragElastic={0.06}
        animate={controls}
        onDragEnd={onDragEnd}
        onClick={() => { if (open) settle(false); }}
        style={{ background: "var(--color-surface)", touchAction: "pan-y" }}
      >
        {children}
      </motion.div>
    </div>
  );
}
