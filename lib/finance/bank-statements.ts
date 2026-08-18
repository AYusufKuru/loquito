import type { PrismaClient } from "@prisma/client";

import { recordAudit } from "@/lib/audit/service";
import { saveUploadedFile } from "@/lib/files/storage";
import { extractTextFromBuffer } from "@/lib/ocr/text-extract";

import {
  parseBradescoConfirmation,
  parseFinanceDocument,
  parseWeeklyStatement,
  type BradescoParsed,
} from "./bradesco-parser";
import { proposePaymentMatch } from "./matching";
import { serializeReceipt } from "./receipts";
import { recordPayment, updatePayment } from "./payments";
import type { BankStatementRow, StatementReceiptRow } from "./types";

type Db = PrismaClient;

function matchMetaJson(
  proposal: Awaited<ReturnType<typeof proposePaymentMatch>>,
  extra?: Record<string, unknown>,
) {
  return JSON.stringify({
    proposedOrderId: proposal?.orderId ?? null,
    proposedPaymentId: proposal?.paymentId ?? null,
    proposedOrderNo: proposal?.orderNo ?? null,
    matchScore: proposal?.matchScore ?? 0,
    matchReason: proposal?.matchReason ?? null,
    ...extra,
  });
}

async function createReceiptFromParsed(
  db: Db,
  parsed: BradescoParsed,
  opts: {
    fileName: string;
    filePath: string;
    bankStatementId?: string | null;
  },
) {
  const proposal = await proposePaymentMatch(db, {
    amountCents: parsed.amountCents,
    direction: parsed.direction,
    orderReference: parsed.orderReference,
    counterparty: parsed.counterparty,
    counterpartyCnpj: parsed.counterpartyCnpj,
    controlNo: parsed.controlNo,
  });

  const receipt = await db.receipt.create({
    data: {
      bankStatementId: opts.bankStatementId ?? null,
      fileName: opts.fileName,
      filePath: opts.filePath,
      transactionDate: parsed.transactionDate
        ? new Date(parsed.transactionDate)
        : new Date(),
      amountCents: parsed.amountCents,
      controlNo: parsed.controlNo,
      counterparty: parsed.counterparty,
      direction: parsed.direction,
      paymentId: proposal?.paymentId ?? null,
      isMatched: proposal != null && proposal.matchScore >= 70,
      isApproved: false,
      rawData: matchMetaJson(proposal, {
        e2eId: parsed.e2eId,
        description: parsed.description,
      }),
    },
  });

  return receipt;
}

export async function processBradescoUpload(
  db: Db,
  buffer: Buffer,
  fileName: string,
) {
  const text = extractTextFromBuffer(buffer, fileName);
  const parsed =
    parseFinanceDocument(text, fileName) ?? parseBradescoConfirmation(text);

  const saved = await saveUploadedFile("receipts", buffer, fileName);
  const receipt = await createReceiptFromParsed(db, parsed, {
    fileName: saved.fileName,
    filePath: saved.filePath,
  });

  return serializeReceiptWithMeta(db, receipt.id);
}

export async function uploadWeeklyStatement(
  db: Db,
  buffer: Buffer,
  fileName: string,
) {
  const text = extractTextFromBuffer(buffer, fileName);
  const saved = await saveUploadedFile("statements", buffer, fileName);

  const periodMatch = text.match(
    /Per[ií]odo:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*a\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  );

  const statement = await db.bankStatement.create({
    data: {
      fileName: saved.fileName,
      filePath: saved.filePath,
      periodFrom: periodMatch ? parseDateBr(periodMatch[1]) : null,
      periodTo: periodMatch ? parseDateBr(periodMatch[2]) : null,
      status: "processed",
    },
  });

  const lineTexts = parseWeeklyStatement(text);
  const receipts: string[] = [];

  for (const line of lineTexts) {
    const parsed: BradescoParsed = {
      transactionDate: line.transactionDate,
      controlNo: line.controlNo,
      e2eId: null,
      amountCents: line.amountCents,
      direction: line.direction,
      counterparty: line.description,
      counterpartyCnpj: null,
      orderReference: line.reference?.match(/PED-/) ? line.reference : null,
      description: line.description,
      rawText: JSON.stringify(line),
    };

    const receipt = await createReceiptFromParsed(db, parsed, {
      fileName: `${fileName}#${line.lineIndex + 1}`,
      filePath: saved.filePath,
      bankStatementId: statement.id,
    });
    receipts.push(receipt.id);
  }

  const rows = await listStatementReceipts(db, statement.id);
  return {
    statement: await serializeStatement(db, statement.id),
    receipts: rows,
  };
}

function parseDateBr(raw: string): Date | null {
  const m = raw.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (!m) return null;
  let year = m[3];
  if (year.length === 2) year = `20${year}`;
  return new Date(`${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}T12:00:00`);
}

export async function serializeStatement(
  db: Db,
  id: string,
): Promise<BankStatementRow | null> {
  const row = await db.bankStatement.findUnique({ where: { id } });
  if (!row) return null;

  const receipts = await db.receipt.findMany({
    where: { bankStatementId: id },
  });

  return {
    id: row.id,
    fileName: row.fileName,
    periodFrom: row.periodFrom?.toISOString() ?? null,
    periodTo: row.periodTo?.toISOString() ?? null,
    uploadedAt: row.uploadedAt.toISOString(),
    status: row.status,
    lineCount: receipts.length,
    matchedCount: receipts.filter((r) => r.isMatched).length,
    approvedCount: receipts.filter((r) => r.isApproved).length,
  };
}

export async function listBankStatements(db: Db): Promise<BankStatementRow[]> {
  const rows = await db.bankStatement.findMany({
    orderBy: { uploadedAt: "desc" },
    take: 50,
  });

  const result: BankStatementRow[] = [];
  for (const row of rows) {
    const serialized = await serializeStatement(db, row.id);
    if (serialized) result.push(serialized);
  }
  return result;
}

async function serializeReceiptWithMeta(
  db: Db,
  receiptId: string,
): Promise<StatementReceiptRow> {
  const receipt = await db.receipt.findUnique({
    where: { id: receiptId },
    include: {
      payment: {
        include: { order: { select: { orderNo: true } } },
      },
    },
  });
  if (!receipt) throw new Error("Dekont bulunamadı.");

  let meta: Record<string, unknown> = {};
  if (receipt.rawData) {
    try {
      meta = JSON.parse(receipt.rawData);
    } catch {
      meta = {};
    }
  }

  return {
    ...serializeReceipt(receipt),
    bankStatementId: receipt.bankStatementId,
    orderNo:
      receipt.payment?.order?.orderNo ??
      (typeof meta.proposedOrderNo === "string" ? meta.proposedOrderNo : null),
    matchScore:
      typeof meta.matchScore === "number" ? meta.matchScore : null,
    matchReason:
      typeof meta.matchReason === "string" ? meta.matchReason : null,
    proposedOrderId:
      typeof meta.proposedOrderId === "string" ? meta.proposedOrderId : null,
  };
}

export async function listStatementReceipts(
  db: Db,
  bankStatementId?: string | null,
): Promise<StatementReceiptRow[]> {
  const receipts = await db.receipt.findMany({
    where: bankStatementId ? { bankStatementId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      payment: {
        include: { order: { select: { orderNo: true } } },
      },
    },
  });

  return receipts.map((r) => {
    let meta: Record<string, unknown> = {};
    if (r.rawData) {
      try {
        meta = JSON.parse(r.rawData);
      } catch {
        meta = {};
      }
    }
    return {
      ...serializeReceipt(r),
      bankStatementId: r.bankStatementId,
      orderNo:
        r.payment?.order?.orderNo ??
        (typeof meta.proposedOrderNo === "string"
          ? meta.proposedOrderNo
          : null),
      matchScore:
        typeof meta.matchScore === "number" ? meta.matchScore : null,
      matchReason:
        typeof meta.matchReason === "string" ? meta.matchReason : null,
      proposedOrderId:
        typeof meta.proposedOrderId === "string"
          ? meta.proposedOrderId
          : null,
    };
  });
}

export async function listUnmatchedReceipts(db: Db): Promise<StatementReceiptRow[]> {
  const receipts = await db.receipt.findMany({
    where: { isMatched: false, isApproved: false },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      payment: {
        include: { order: { select: { orderNo: true } } },
      },
    },
  });

  return receipts.map((r) => ({
    ...serializeReceipt(r),
    bankStatementId: r.bankStatementId,
    orderNo: r.payment?.order?.orderNo ?? null,
    matchScore: null,
    matchReason: null,
    proposedOrderId: null,
  }));
}

export async function approveReceipt(
  db: Db,
  receiptId: string,
  actorId?: string,
  options?: { paymentId?: string | null },
) {
  const receipt = await db.receipt.findUnique({ where: { id: receiptId } });
  if (!receipt) throw new Error("Dekont bulunamadı.");
  if (receipt.isApproved) throw new Error("Dekont zaten onaylandı.");

  let paymentId = options?.paymentId ?? receipt.paymentId;

  if (!paymentId && receipt.rawData) {
    try {
      const meta = JSON.parse(receipt.rawData);
      if (typeof meta.proposedPaymentId === "string") {
        paymentId = meta.proposedPaymentId;
      }
    } catch {
      /* ignore */
    }
  }

  if (
    receipt.direction === "in" &&
    receipt.amountCents &&
    receipt.amountCents > 0
  ) {
    if (paymentId) {
      await updatePayment(
        db,
        paymentId,
        {
          status: "paid",
          paidAt: receipt.transactionDate?.toISOString() ?? new Date().toISOString(),
          isApproved: true,
          amountCents: receipt.amountCents,
        },
        actorId,
      );
    } else {
      let customerId: string | null = null;
      let orderId: string | null = null;
      if (receipt.rawData) {
        try {
          const meta = JSON.parse(receipt.rawData);
          if (typeof meta.proposedOrderId === "string") {
            orderId = meta.proposedOrderId;
            const order = await db.order.findUnique({
              where: { id: meta.proposedOrderId },
              select: { customerId: true },
            });
            customerId = order?.customerId ?? null;
          }
        } catch {
          /* ignore */
        }
      }

      const payment = await recordPayment(
        db,
        {
          orderId,
          customerId,
          amountCents: receipt.amountCents,
          direction: "in",
          method: "pix",
          reference: receipt.controlNo,
          paidAt: receipt.transactionDate?.toISOString(),
          markPaid: true,
          notes: `Dekont onayı: ${receipt.fileName}`,
        },
        actorId,
      );
      paymentId = payment.id;
    }
  }

  const updated = await db.receipt.update({
    where: { id: receiptId },
    data: {
      isApproved: true,
      isMatched: true,
      approvedById: actorId ?? null,
      paymentId,
    },
  });

  if (actorId) {
    await recordAudit(db, {
      userId: actorId,
      entityType: "receipt",
      entityId: receiptId,
      action: "approve",
      changes: [
        { field: "isApproved", oldValue: "false", newValue: "true" },
      ],
    });
  }

  return serializeReceiptWithMeta(db, updated.id);
}

export async function loadDemoStatement(db: Db) {
  const { readFile } = await import("fs/promises");
  const { join } = await import("path");
  const buffer = await readFile(
    join(process.cwd(), "Dokuman", "ekstre-haftalik-demo.txt"),
  );
  return uploadWeeklyStatement(db, buffer, "ekstre-haftalik-demo.txt");
}
