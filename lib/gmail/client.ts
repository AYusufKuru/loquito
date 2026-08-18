import { GMAIL_QUERY } from "./config";

interface GmailListResponse {
  messages?: Array<{ id: string; threadId?: string }>;
}

interface GmailMessagePart {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailMessagePart[];
}

interface GmailMessageResponse {
  id: string;
  threadId?: string;
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePart & {
    headers?: Array<{ name?: string; value?: string }>;
  };
}

function decodeBase64Url(data: string): Buffer {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64");
}

function headerValue(
  headers: Array<{ name?: string; value?: string }> | undefined,
  name: string,
): string | null {
  if (!headers) return null;
  const found = headers.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase(),
  );
  return found?.value ?? null;
}

function collectParts(part: GmailMessagePart | undefined): GmailMessagePart[] {
  if (!part) return [];
  const parts = [part];
  if (part.parts) {
    for (const child of part.parts) {
      parts.push(...collectParts(child));
    }
  }
  return parts;
}

export async function listGmailMessageIds(
  accessToken: string,
  maxResults = 20,
): Promise<Array<{ id: string; threadId?: string }>> {
  const params = new URLSearchParams({
    q: GMAIL_QUERY,
    maxResults: String(maxResults),
  });
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const data = (await res.json()) as GmailListResponse;
  if (!res.ok) {
    throw new Error("Gmail mesaj listesi alınamadı.");
  }
  return data.messages ?? [];
}

export async function getGmailMessage(
  accessToken: string,
  messageId: string,
): Promise<{
  id: string;
  threadId: string | null;
  subject: string | null;
  fromEmail: string | null;
  receivedAt: Date | null;
  attachments: Array<{ filename: string; buffer: Buffer; mimeType: string }>;
}> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const data = (await res.json()) as GmailMessageResponse;
  if (!res.ok) {
    throw new Error("Gmail mesaj detayı alınamadı.");
  }

  const headers = data.payload?.headers;
  const subject = headerValue(headers, "Subject");
  const fromRaw = headerValue(headers, "From") ?? "";
  const emailMatch = fromRaw.match(/<([^>]+)>/);
  const fromEmail = emailMatch?.[1] ?? (fromRaw.trim() || null);
  const receivedAt = data.internalDate
    ? new Date(Number(data.internalDate))
    : null;

  const attachments: Array<{
    filename: string;
    buffer: Buffer;
    mimeType: string;
  }> = [];

  const parts = collectParts(data.payload);
  for (const part of parts) {
    const filename = part.filename?.trim();
    const mimeType = part.mimeType ?? "application/octet-stream";
    const isAttachment =
      filename &&
      (mimeType.includes("pdf") ||
        mimeType.includes("text") ||
        filename.endsWith(".pdf") ||
        filename.endsWith(".txt"));

    if (!isAttachment) continue;

    if (part.body?.data) {
      attachments.push({
        filename,
        buffer: decodeBase64Url(part.body.data),
        mimeType,
      });
      continue;
    }

    if (part.body?.attachmentId) {
      const attRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${part.body.attachmentId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      const attData = (await attRes.json()) as { data?: string };
      if (attRes.ok && attData.data) {
        attachments.push({
          filename,
          buffer: decodeBase64Url(attData.data),
          mimeType,
        });
      }
    }
  }

  return {
    id: data.id,
    threadId: data.threadId ?? null,
    subject,
    fromEmail,
    receivedAt,
    attachments,
  };
}
