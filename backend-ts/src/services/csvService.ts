import { stringify } from "csv-stringify/sync";
import { parse } from "csv-parse/sync";

export interface ImportedRow {
  date: Date;
  title: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  category: string;
}

export const transactionsToCsv = (
  transactions: { date: Date; title: string; amount: number; type: string; category: string; paymentMethod: string | null }[],
): string => {
  const rows = transactions.map((t) => ({
    data: t.date.toISOString().slice(0, 10),
    titulo: t.title,
    tipo: t.type,
    categoria: t.category,
    valor: t.amount.toFixed(2),
    metodo_pagamento: t.paymentMethod || "",
  }));
  return stringify(rows, {
    header: true,
    columns: ["data", "titulo", "tipo", "categoria", "valor", "metodo_pagamento"],
  });
};

/**
 * Accepts a loose set of header spellings (pt-BR and en-US, our own export
 * format included) so a user's existing spreadsheet doesn't have to be
 * reshaped by hand before importing.
 */
const HEADER_ALIASES: Record<string, string[]> = {
  date: ["data", "date", "dt"],
  title: ["titulo", "título", "title", "descricao", "descrição", "description"],
  amount: ["valor", "amount", "value"],
  type: ["tipo", "type"],
  category: ["categoria", "category"],
};

const resolveColumn = (headers: string[], key: string): string | null => {
  const aliases = HEADER_ALIASES[key];
  const normalized = headers.map((h) => h.trim().toLowerCase());
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias);
    if (idx !== -1) return headers[idx];
  }
  return null;
};

export const parseCsvTransactions = (buffer: Buffer): ImportedRow[] => {
  const records: Record<string, string>[] = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });
  if (records.length === 0) return [];

  const headers = Object.keys(records[0]);
  const dateCol = resolveColumn(headers, "date");
  const titleCol = resolveColumn(headers, "title");
  const amountCol = resolveColumn(headers, "amount");
  const typeCol = resolveColumn(headers, "type");
  const categoryCol = resolveColumn(headers, "category");

  if (!dateCol || !titleCol || !amountCol) {
    throw new Error(
      "CSV precisa ter ao menos colunas de data, título/descrição e valor (ex: data,titulo,valor,tipo,categoria)",
    );
  }

  return records
    .map((row): ImportedRow | null => {
      const rawAmount = row[amountCol].replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
      const amount = parseFloat(row[amountCol].includes(",") ? rawAmount : row[amountCol]);
      const date = new Date(row[dateCol]);
      if (!row[titleCol] || Number.isNaN(amount) || Number.isNaN(date.getTime())) return null;

      const typeRaw = (typeCol ? row[typeCol] : "").toUpperCase();
      const type: "INCOME" | "EXPENSE" =
        typeRaw.includes("INCOME") || typeRaw.includes("RECEITA") || amount > 0 && !typeCol
          ? "INCOME"
          : "EXPENSE";

      return {
        date,
        title: row[titleCol],
        amount: Math.abs(amount),
        type,
        category: categoryCol ? row[categoryCol] || "Outros" : "Outros",
      };
    })
    .filter((r): r is ImportedRow => r !== null);
};
