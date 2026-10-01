import { Router } from "express";
import { appNow } from "../lib/dates";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { prisma } from "../lib/prisma";
import { PLANS, planFor } from "../config/plans";
import { authenticate, requireFeature } from "../middlewares/auth";
import { upload } from "../lib/upload";
import { transactionsToCsv, parseCsvTransactions } from "../services/csvService";
import { transactionsToOfx, parseOfxTransactions } from "../services/ofxService";

const router = Router();

// ============================================================================
// CSV / OFX — export and import
// ============================================================================
router.get("/api/reports/csv", authenticate, requireFeature("canUseReports"), async (req, res) => {
  const user = req.user;
  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
  });
  const csv = transactionsToCsv(transactions);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="finix-transacoes.csv"');
  res.send(csv);
});

router.get("/api/reports/ofx", authenticate, requireFeature("canUseReports"), async (req, res) => {
  const user = req.user;
  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
  });
  const ofx = transactionsToOfx(transactions, user.name || "Finix");
  res.setHeader("Content-Type", "application/x-ofx");
  res.setHeader("Content-Disposition", 'attachment; filename="finix-transacoes.ofx"');
  res.send(ofx);
});

router.post(
  "/api/transactions/import",
  authenticate,
  requireFeature("canUseReports"),
  upload.single("file"),
  async (req, res) => {
    const user = req.user;
    if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });

    const isOfx = /\.(ofx|qfx)$/i.test(req.file.originalname);
    let rows;
    try {
      rows = isOfx
        ? parseOfxTransactions(req.file.buffer.toString("utf-8"))
        : parseCsvTransactions(req.file.buffer);
    } catch (err: any) {
      return res.status(400).json({ error: err.message || "Falha ao ler arquivo" });
    }
    if (rows.length === 0) {
      return res.status(400).json({ error: "Nenhuma transação reconhecida no arquivo" });
    }

    const plan = planFor(user);
    if (plan.transactionsLimit !== -1 && user.transactionsUsed + rows.length > plan.transactionsLimit) {
      return res.status(403).json({
        error: `Importar ${rows.length} transações excede o limite mensal do plano ${plan.name}.`,
        upgrade: true,
      });
    }

    const created = await prisma.$transaction(
      rows.map((r) =>
        prisma.transaction.create({
          data: {
            userId: user.id,
            title: r.title,
            amount: r.amount,
            type: r.type,
            category: r.category,
            date: r.date,
            description: "Importado via arquivo",
          },
        }),
      ),
    );
    await prisma.user.update({
      where: { id: user.id },
      data: { transactionsUsed: { increment: created.length } },
    });
    res.json({ imported: created.length });
  },
);

// ============================================================================
// EXPORTS (PDF / Excel)
// ============================================================================
router.get(
  "/api/export/pdf",
  authenticate,
  requireFeature("hasPDF"),
  async (req, res) => {
    const user = req.user;
    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
    });
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="finix-relatorio.pdf"',
      );
      res.send(Buffer.concat(chunks));
    });

    const totalIncome = transactions
      .filter((t) => t.type === "INCOME")
      .reduce((s, t) => s + t.amount, 0);
    const totalExpense = transactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((s, t) => s + t.amount, 0);
    const totalNet = totalIncome - totalExpense;

    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor("#111827")
      .text("Relatório Finix — Transações", { align: "left" });
    doc.moveDown(0.6);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#475569")
      .text(`Usuário: ${user.name} (${user.email})`);
    doc.text(`Plano: ${PLANS[user.plan]?.name || user.plan}`);
    doc.text(`Data de geração: ${appNow().toLocaleDateString("pt-BR")}`);
    doc.moveDown(0.8);

    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#111827")
      .text("Resumo", { underline: true });
    doc.moveDown(0.4);

    const summaryRows = [
      { label: "Total de transações", value: `${transactions.length}` },
      { label: "Receitas totais", value: `R$ ${totalIncome.toFixed(2)}` },
      { label: "Despesas totais", value: `R$ ${totalExpense.toFixed(2)}` },
      { label: "Saldo líquido", value: `R$ ${totalNet.toFixed(2)}` },
    ];

    summaryRows.forEach((row) => {
      const y = doc.y;
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#374151")
        .text(row.label, 40, y);
      doc
        .font("Helvetica-Bold")
        .text(row.value, 450, y, { width: 110, align: "right" });
      doc.moveDown(0.9);
    });

    doc.moveDown(0.6);
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#111827")
      .text("Transações", { underline: true });
    doc.moveDown(0.6);

    const tableTop = doc.y;
    const columnPositions = {
      date: 40,
      title: 120,
      type: 310,
      category: 390,
      value: 490,
    };

    doc.save();
    doc
      .fillColor("#f8fafc")
      .rect(40, tableTop - 4, 510, 22)
      .fill();
    doc.restore();

    doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827");
    doc.text("Data", columnPositions.date, tableTop, { width: 80 });
    doc.text("Título", columnPositions.title, tableTop, { width: 180 });
    doc.text("Tipo", columnPositions.type, tableTop, { width: 80 });
    doc.text("Categoria", columnPositions.category, tableTop, { width: 90 });
    doc.text("Valor", columnPositions.value, tableTop, {
      width: 90,
      align: "right",
    });
    doc.moveDown(1.1);

    doc
      .strokeColor("#e5e7eb")
      .lineWidth(0.5)
      .moveTo(40, doc.y)
      .lineTo(550, doc.y)
      .stroke();
    doc.moveDown(0.5);

    doc.font("Helvetica").fontSize(10).fillColor("#1f2937");
    if (transactions.length === 0) {
      doc.text("Nenhuma transação encontrada.", 40, doc.y);
    } else {
      transactions.forEach((t) => {
        const y = doc.y;
        doc.text(
          new Date(t.date).toLocaleDateString("pt-BR"),
          columnPositions.date,
          y,
          { width: 80 },
        );
        doc.text(t.title || "-", columnPositions.title, y, { width: 180 });
        doc.text(t.type, columnPositions.type, y, { width: 80 });
        doc.text(t.category || "-", columnPositions.category, y, { width: 90 });
        doc.text(`R$ ${t.amount.toFixed(2)}`, columnPositions.value, y, {
          width: 90,
          align: "right",
        });
        doc.moveDown(0.8);
        if (doc.y > 720) {
          doc.addPage();
        }
      });
    }

    doc.end();
  },
);

router.get(
  "/api/export/excel",
  authenticate,
  requireFeature("hasExcel"),
  async (req, res) => {
    const user = req.user;
    const transactions = await prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
    });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Transações");
    sheet.columns = [
      { header: "Data", key: "date", width: 15 },
      { header: "Título", key: "title", width: 35 },
      { header: "Tipo", key: "type", width: 12 },
      { header: "Categoria", key: "category", width: 18 },
      { header: "Valor", key: "amount", width: 14 },
    ];
    sheet.addRows(
      transactions.map((t) => ({
        date: new Date(t.date).toLocaleDateString("pt-BR"),
        title: t.title,
        type: t.type,
        category: t.category,
        amount: t.amount,
      })),
    );
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="finix-transacoes.xlsx"',
    );
    res.send(Buffer.from(buffer));
  },
);

export default router;
