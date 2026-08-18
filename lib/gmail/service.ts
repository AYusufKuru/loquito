import type { PrismaClient } from "@prisma/client";

import type { GmailInboxMessage, Order } from "@prisma/client";

import { saveUploadedFile } from "@/lib/files/storage";
import { parseOrderDocumentBuffer } from "@/lib/ocr/service";
import { createOrderFromParsedDraft } from "@/lib/orders/create-from-parsed";

import type { GmailInboxRow, GmailStatus, GmailSyncResult } from "./types";

type Db = PrismaClient;

export function serializeInboxMessage(
  row: GmailInboxMessage & { order?: Pick<Order, "orderNo"> | null },
): GmailInboxRow {
  return {
    id: row.id,
    gmailMessageId: row.gmailMessageId,
    subject: row.subject,
    fromEmail: row.fromEmail,
    receivedAt: row.receivedAt?.toISOString() ?? null,
    status: row.status,
    orderId: row.orderId,
    orderNo: row.order?.orderNo ?? null,
    attachmentName: row.attachmentName,
    errorMessage: row.errorMessage,
    isDemo: row.isDemo,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getGmailStatus(db: Db): Promise<GmailStatus> {
  const { isGmailConfigured } = await import("./config");
  const configured = isGmailConfigured();

  const connection = await db.gmailConnection.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  const pendingCount = await db.gmailInboxMessage.count({
    where: { status: "pending" },
  });
  const processedCount = await db.gmailInboxMessage.count({
    where: { status: "processed" },
  });

  return {
    configured,
    connected: Boolean(connection),
    email: connection?.email ?? null,
    lastSyncAt: connection?.lastSyncAt?.toISOString() ?? null,
    demoMode: !configured,
    pendingCount,
    processedCount,
  };
}

export async function listInboxMessages(db: Db, limit = 50): Promise<GmailInboxRow[]> {
  const rows = await db.gmailInboxMessage.findMany({
    include: { order: { select: { orderNo: true } } },
    orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map(serializeInboxMessage);
}

async function processInboxRecord(
  db: Db,
  record: GmailInboxMessage,
  buffer: Buffer,
  fileName: string,
): Promise<"created" | "failed" | "skipped"> {
  try {
    const draft = await parseOrderDocumentBuffer(db, buffer, fileName);

    if (!draft.customerId) {
      await db.gmailInboxMessage.update({
        where: { id: record.id },
        data: {
          status: "failed",
          errorMessage: "Müşteri eşleşmedi.",
        },
      });
      return "failed";
    }

    const unresolved = draft.lines.some((l) => !l.skuResolved);
    if (unresolved) {
      await db.gmailInboxMessage.update({
        where: { id: record.id },
        data: {
          status: "failed",
          errorMessage: "SKU eşlemesi tamamlanamadı.",
        },
      });
      return "failed";
    }

    const order = await createOrderFromParsedDraft(db, {
      customerId: draft.customerId,
      draft,
      status: "draft",
      notes: `Gmail: ${record.subject ?? record.gmailMessageId}`,
      storedPath: record.attachmentPath ?? undefined,
      fileName: record.attachmentName ?? undefined,
    });

    await db.gmailInboxMessage.update({
      where: { id: record.id },
      data: {
        status: "processed",
        orderId: order.id,
        errorMessage: null,
      },
    });

    return "created";
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "İşleme hatası.";
    await db.gmailInboxMessage.update({
      where: { id: record.id },
      data: { status: "failed", errorMessage: message },
    });
    return "failed";
  }
}

export async function syncGmailInbox(db: Db): Promise<GmailSyncResult> {
  const { isGmailConfigured } = await import("./config");
  if (!isGmailConfigured()) {
    return syncDemoInbox(db);
  }

  const connection = await db.gmailConnection.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!connection) {
    throw new Error("Gmail bağlantısı yok. Önce bağlanın.");
  }

  const { refreshAccessToken } = await import("./oauth");
  const { listGmailMessageIds, getGmailMessage } = await import("./client");

  let accessToken = connection.accessToken;
  if (
    connection.expiresAt &&
    connection.expiresAt.getTime() < Date.now() + 60_000 &&
    connection.refreshToken
  ) {
    const refreshed = await refreshAccessToken(connection.refreshToken);
    accessToken = refreshed.accessToken;
    await db.gmailConnection.update({
      where: { id: connection.id },
      data: {
        accessToken,
        expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
      },
    });
  }

  const remoteIds = await listGmailMessageIds(accessToken, 15);
  let synced = 0;
  let created = 0;
  let failed = 0;
  let skipped = 0;

  for (const remote of remoteIds) {
    const exists = await db.gmailInboxMessage.findUnique({
      where: { gmailMessageId: remote.id },
    });
    if (exists) {
      skipped += 1;
      continue;
    }

    const message = await getGmailMessage(accessToken, remote.id);
    if (message.attachments.length === 0) {
      skipped += 1;
      continue;
    }

    const attachment = message.attachments[0];
    const saved = await saveUploadedFile(
      `gmail/${remote.id}`,
      attachment.buffer,
      attachment.filename,
    );

    const record = await db.gmailInboxMessage.create({
      data: {
        gmailMessageId: remote.id,
        connectionId: connection.id,
        threadId: message.threadId,
        subject: message.subject,
        fromEmail: message.fromEmail,
        receivedAt: message.receivedAt,
        status: "pending",
        attachmentName: attachment.filename,
        attachmentPath: saved.filePath,
        isDemo: false,
      },
    });

    synced += 1;
    const result = await processInboxRecord(
      db,
      record,
      attachment.buffer,
      attachment.filename,
    );
    if (result === "created") created += 1;
    else if (result === "failed") failed += 1;
    else skipped += 1;
  }

  await db.gmailConnection.update({
    where: { id: connection.id },
    data: { lastSyncAt: new Date() },
  });

  const messages = await listInboxMessages(db, 30);
  return { synced, created, failed, skipped, messages };
}

export async function syncDemoInbox(db: Db): Promise<GmailSyncResult> {
  const { readFile } = await import("fs/promises");
  const { join } = await import("path");
  const { DEMO_GMAIL_MESSAGES } = await import("./demo");

  let synced = 0;
  let created = 0;
  let failed = 0;
  let skipped = 0;

  for (const demo of DEMO_GMAIL_MESSAGES) {
    const exists = await db.gmailInboxMessage.findUnique({
      where: { gmailMessageId: demo.gmailMessageId },
    });
    if (exists?.status === "processed") {
      skipped += 1;
      continue;
    }

    const buffer = await readFile(
      join(process.cwd(), "Dokuman", demo.dokumanFile),
    );

    let record: GmailInboxMessage;
    if (exists) {
      record = exists;
    } else {
      const saved = await saveUploadedFile(
        `gmail/demo/${demo.gmailMessageId}`,
        buffer,
        demo.attachmentName,
      );
      record = await db.gmailInboxMessage.create({
        data: {
          gmailMessageId: demo.gmailMessageId,
          subject: demo.subject,
          fromEmail: demo.fromEmail,
          receivedAt: new Date(),
          status: "pending",
          attachmentName: demo.attachmentName,
          attachmentPath: saved.filePath,
          isDemo: true,
        },
      });
      synced += 1;
    }

    const result = await processInboxRecord(
      db,
      record,
      buffer,
      demo.attachmentName,
    );
    if (result === "created") created += 1;
    else if (result === "failed") failed += 1;
    else skipped += 1;
  }

  const messages = await listInboxMessages(db, 30);
  return { synced, created, failed, skipped, messages };
}

export async function saveGmailConnection(
  db: Db,
  data: {
    email: string;
    accessToken: string;
    refreshToken: string | null;
    expiresIn: number;
    scope: string | null;
  },
) {
  await db.gmailConnection.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });

  return db.gmailConnection.create({
    data: {
      email: data.email,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: new Date(Date.now() + data.expiresIn * 1000),
      scope: data.scope,
      isActive: true,
    },
  });
}
