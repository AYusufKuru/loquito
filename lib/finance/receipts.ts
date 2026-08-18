import type { PrismaClient } from "@prisma/client";

import { saveUploadedFile } from "@/lib/files/storage";

type Db = PrismaClient;

export interface ReceiptRow {
  id: string;
  paymentId: string | null;
  fileName: string;
  filePath: string;
  transactionDate: string | null;
  amountCents: number | null;
  controlNo: string | null;
  counterparty: string | null;
  direction: string | null;
  isMatched: boolean;
  isApproved: boolean;
  createdAt: string;
}

export async function listReceipts(db: Db, limit = 100): Promise<ReceiptRow[]> {
  const rows = await db.receipt.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(serializeReceipt);
}

export async function createReceiptFromUpload(
  db: Db,
  file: { buffer: Buffer; name: string },
  meta?: {
    paymentId?: string | null;
    transactionDate?: string | null;
    amountCents?: number | null;
    controlNo?: string | null;
    counterparty?: string | null;
    direction?: string | null;
    notes?: string | null;
  },
) {
  const saved = await saveUploadedFile("receipts", file.buffer, file.name);

  const receipt = await db.receipt.create({
    data: {
      paymentId: meta?.paymentId ?? null,
      fileName: saved.fileName,
      filePath: saved.filePath,
      transactionDate: meta?.transactionDate
        ? new Date(meta.transactionDate)
        : new Date(),
      amountCents: meta?.amountCents ?? null,
      controlNo: meta?.controlNo ?? null,
      counterparty: meta?.counterparty ?? null,
      direction: meta?.direction ?? "in",
      isMatched: meta?.paymentId != null,
      rawData: meta?.notes ?? null,
    },
  });

  return serializeReceipt(receipt);
}

export async function linkReceiptToPayment(
  db: Db,
  receiptId: string,
  paymentId: string,
) {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error("Ödeme bulunamadı.");

  const existing = await db.receipt.findUnique({ where: { id: receiptId } });
  if (!existing) throw new Error("Dekont bulunamadı.");

  const receipt = await db.receipt.update({
    where: { id: receiptId },
    data: {
      paymentId,
      isMatched: true,
      amountCents: existing.amountCents ?? payment.amountCents,
      direction: payment.direction,
    },
  });

  return serializeReceipt(receipt);
}

export function serializeReceipt(row: {
  id: string;
  paymentId: string | null;
  fileName: string;
  filePath: string;
  transactionDate: Date | null;
  amountCents: number | null;
  controlNo: string | null;
  counterparty: string | null;
  direction: string | null;
  isMatched: boolean;
  isApproved: boolean;
  createdAt: Date;
}): ReceiptRow {
  return {
    id: row.id,
    paymentId: row.paymentId,
    fileName: row.fileName,
    filePath: row.filePath,
    transactionDate: row.transactionDate?.toISOString() ?? null,
    amountCents: row.amountCents,
    controlNo: row.controlNo,
    counterparty: row.counterparty,
    direction: row.direction,
    isMatched: row.isMatched,
    isApproved: row.isApproved,
    createdAt: row.createdAt.toISOString(),
  };
}
