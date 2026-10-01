export function currency(v: number, curr: string = "BRL") {
  const currencyMap: Record<string, string> = {
    BRL: "BRL",
    USD: "USD",
    EUR: "EUR",
    GBP: "GBP",
  };
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currencyMap[curr] || "BRL",
  }).format(v || 0);
}

// The API stores calendar dates (transaction date, due date, deadline...) as
// UTC midnight. Formatting them in the browser's own timezone would show the
// previous day for anyone west of Greenwich — in Brazil, "01/10" came out as
// "30/09". Always read them back in UTC.
export function dateBR(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
  } catch {
    return iso;
  }
}

/** Today's date as YYYY-MM-DD on the user's own calendar (not UTC's). */
export function todayISO() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export function dateISOForInput(iso?: string) {
  if (!iso) return todayISO();
  return new Date(iso).toISOString().slice(0, 10);
}

export const CATEGORIES = [
  "Alimentação",
  "Moradia",
  "Transporte",
  "Saúde",
  "Lazer",
  "Educação",
  "Salário",
  "Freelance",
  "Investimento",
  "Outros",
];

export const CATEGORY_COLORS: Record<string, string> = {
  Alimentação: "#F97316",
  Moradia: "#3B82F6",
  Transporte: "#8B5CF6",
  Saúde: "#EF4444",
  Lazer: "#EC4899",
  Educação: "#06B6D4",
  Salário: "#22C55E",
  Freelance: "#10B981",
  Investimento: "#EAB308",
  Outros: "#64748B",
};
