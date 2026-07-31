import { ImportedRow } from "./csvService";

const ofxDate = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}000000`;

/** OFX 1.02 (SGML) — the widely-supported flavor; every desktop finance app
 * (Money, Quicken, GnuCash) and most banks can read this without XML fuss. */
export const transactionsToOfx = (
  transactions: { id: string; date: Date; title: string; amount: number; type: string }[],
  accountLabel = "Finix",
): string => {
  const now = new Date();
  const amounts = transactions.map((t) => (t.type === "EXPENSE" ? -Math.abs(t.amount) : Math.abs(t.amount)));
  const balance = amounts.reduce((s, a) => s + a, 0);

  const transactionsXml = transactions
    .map((t, i) => {
      const amount = amounts[i];
      return `        <STMTTRN>
          <TRNTYPE>${amount >= 0 ? "CREDIT" : "DEBIT"}</TRNTYPE>
          <DTPOSTED>${ofxDate(t.date)}</DTPOSTED>
          <TRNAMT>${amount.toFixed(2)}</TRNAMT>
          <FITID>${t.id}</FITID>
          <NAME>${t.title.replace(/[<>&]/g, "")}</NAME>
        </STMTTRN>`;
    })
    .join("\n");

  return `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:UTF-8
CHARSET:NONE
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>
      <DTSERVER>${ofxDate(now)}</DTSERVER>
      <LANGUAGE>POR</LANGUAGE>
    </SONRS>
  </SIGNONMSGSRSV1>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <TRNUID>1</TRNUID>
      <STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>
      <STMTRS>
        <CURDEF>BRL</CURDEF>
        <BANKACCTFROM>
          <BANKID>0000</BANKID>
          <ACCTID>${accountLabel}</ACCTID>
          <ACCTTYPE>CHECKING</ACCTTYPE>
        </BANKACCTFROM>
        <BANKTRANLIST>
${transactionsXml}
        </BANKTRANLIST>
        <LEDGERBAL>
          <BALAMT>${balance.toFixed(2)}</BALAMT>
          <DTASOF>${ofxDate(now)}</DTASOF>
        </LEDGERBAL>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;
};

/** Minimal but real OFX/QFX (SGML) parser — extracts each <STMTTRN> block via
 * regex rather than a full SGML parser, which is fine because OFX's tags are
 * always on their own line with no nesting inside a transaction record. */
export const parseOfxTransactions = (raw: string): ImportedRow[] => {
  const blocks = raw.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];

  const extract = (block: string, tag: string): string | null => {
    const match = block.match(new RegExp(`<${tag}>([^<\r\n]*)`, "i"));
    return match ? match[1].trim() : null;
  };

  return blocks
    .map((block): ImportedRow | null => {
      const amountRaw = extract(block, "TRNAMT");
      const dateRaw = extract(block, "DTPOSTED");
      const name = extract(block, "NAME") || extract(block, "MEMO") || "Transação importada";
      if (!amountRaw || !dateRaw) return null;

      const amount = parseFloat(amountRaw);
      const year = Number(dateRaw.slice(0, 4));
      const month = Number(dateRaw.slice(4, 6));
      const day = Number(dateRaw.slice(6, 8));
      const date = new Date(year, month - 1, day);
      if (Number.isNaN(amount) || Number.isNaN(date.getTime())) return null;

      return {
        date,
        title: name,
        amount: Math.abs(amount),
        type: amount < 0 ? "EXPENSE" : "INCOME",
        category: "Importado",
      };
    })
    .filter((r): r is ImportedRow => r !== null);
};
