/** PDF ve metin dosyalarından okunabilir metin çıkarır */
export function extractTextFromBuffer(buffer: Buffer, fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".csv")) {
    return buffer.toString("utf8");
  }

  if (lower.endsWith(".pdf")) {
    return extractTextFromPdfBuffer(buffer);
  }

  // Bilinmeyen format — latin1 ile deneme
  const asText = buffer.toString("utf8");
  if (asText.includes("BD-") || asText.includes("LQ-") || asText.includes("PROP-LQ")) {
    return asText;
  }
  return extractTextFromPdfBuffer(buffer);
}

function extractTextFromPdfBuffer(buffer: Buffer): string {
  const latin = buffer.toString("latin1");
  const parts: string[] = [];

  // PDF literal strings: (text)
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

  // BT ... ET bloklarındaki metin
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

  // Son çare: yazdırılabilir ASCII dizileri
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
