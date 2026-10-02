import { forwardRef, type InputHTMLAttributes } from "react";
import { useController, type Control, type FieldValues, type Path } from "react-hook-form";

const MAX_DIGITS = 12; // up to R$ 9.999.999.999,99

/** 1234.5 → "R$ 1.234,50"; empty → "". */
export function formatMoneyInput(value: number | string | null | undefined) {
  if (value === "" || value === null || value === undefined) return "";
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** What was typed → the amount. Digits fill in from the cents, like a card machine: 1 → 0,01 → 0,12 → 1,23. */
export function parseMoneyInput(text: string): number | "" {
  const digits = text.replace(/\D/g, "").slice(0, MAX_DIGITS);
  if (!digits) return "";
  return Number(digits) / 100;
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number | string | null | undefined;
  onChange: (value: number | "") => void;
};

/**
 * Amount field in reais that formats itself while you type — no need to
 * think about dots and commas. The value handed back is a plain number.
 */
export const MoneyInput = forwardRef<HTMLInputElement, Props>(function MoneyInput(
  { value, onChange, className = "input", placeholder = "R$ 0,00", ...rest }, ref,
) {
  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      className={`${className} num`}
      value={formatMoneyInput(value)}
      onChange={(e) => onChange(parseMoneyInput(e.target.value))}
      {...rest}
    />
  );
});

/** MoneyInput wired to react-hook-form. */
export function MoneyField<T extends FieldValues>({ control, name, ...rest }: {
  control: Control<T>;
  name: Path<T>;
} & Omit<Props, "value" | "onChange" | "name">) {
  const { field } = useController({ control, name });
  return (
    <MoneyInput
      {...rest}
      ref={field.ref}
      name={field.name}
      value={field.value as number | string | null | undefined}
      onChange={field.onChange}
      onBlur={field.onBlur}
    />
  );
}
