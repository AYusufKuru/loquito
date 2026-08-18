import { PDFParse } from "pdf-parse";

/** PDF ve metin dosyalarından okunabilir metin çıkarır */
export async function extractTextFromBuffer(
  buffer: Buffer,
  fileName: string,
): Promise<string> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".csv")) {
    return buffer.toString("utf8");
  }

  if (lower.endsWith(".pdf")) {
    try {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      const text = result.text?.trim() ?? "";
      if (text.replace(/\s/g, "").length > 40) {
        return text;
      }
    } catch {
      // Regex yedek yönteme düş
    }
    return extractTextFromPdfBuffer(buffer);
  }

  const asText = buffer.toString("utf8");
  if (asText.includes("BD-") || asText.includes("LQ-") || asText.includes("PROP-LQ")) {
    return asText;
  }
  return extractTextFromPdfBuffer(buffer);
}

function extractTextFromPdfBuffer(buffer: Buffer): string {
  const latin = buffer.toString("latin1");
  const parts: string[] = [];

  const literalRe = /\(([^()\\]*(?:\\.[^()\\]*)*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = literalRe.exec(latin)) !== null) {
    const decoded = m[1]
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")");
    if (decoded.trim().length > 1) parts.push(decoded);
  }

  const streamRe = /BT([\s\S]*?)ET/g;
  while ((m = streamRe.exec(latin)) !== null) {
    const block = m[1];
    const inner = block.match(/\(([^()\\]+)\)/g);
    if (inner) {
      for (const s of inner) {
        parts.push(s.slice(1, -1));
      }
    }
  }

  const joined = parts.join("\n");
  if (joined.replace(/\s/g, "").length > 40) return joined;

  const ascii = latin.match(/[A-Za-z0-9À-ú.,;:|\-\/\s]{8,}/g) ?? [];
  return ascii.join("\n");
}

export function normalizeOcrText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function isScannedOrUnreadablePdf(text: string): boolean {
  const normalized = normalizeOcrText(text);
  const printable = normalized.replace(/\s/g, "");
  if (printable.length < 60) return true;

  const hasOrderSignals =
    /BD-|LQ-|PROP-LQ|PEDIDO|QUANTIDADE|RAZÃO|RAZAO|CNPJ|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/i.test(
      normalized,
    );

  return !hasOrderSignals;
}
