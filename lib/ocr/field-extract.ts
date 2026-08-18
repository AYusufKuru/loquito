import type { OrderChannel } from "@/lib/orders/constants";

import type { QuantityMode } from "./types";

const SKU_BD = /\bBD-(?:85|250|CH)-[A-ZÇ]{2,4}\b/gi;
const SKU_LQ = /\bLQ-[A-Z]{2,4}-\d{2,4}\b/gi;
const CNPJ_RE = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/;
const DATE_RE = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/;

export function detectChannel(text: string): OrderChannel {
  const upper = text.toUpperCase();
  if (upper.includes("PROP-LQ") || upper.includes("PROPOSTA COMERCIAL")) {
    return "proposal";
  }
  if (
    upper.includes("CARREFOUR") ||
    upper.includes("Nº DO PEDIDO CARREFOUR") ||
    upper.includes("NO DO PEDIDO CARREFOUR") ||
    SKU_LQ.test(text)
  ) {
    return "portal";
  }
  if (
    upper.includes("QUANTIDADE CAIXA") ||
    upper.includes("PREÇO TABELA CAIXA") ||
    upper.includes("PEDIDO DE VENDA")
  ) {
    return "retail_form";
  }
  if (SKU_BD.test(text)) return "retail_form";
  return "retail_form";
}

export function quantityModeForChannel(channel: OrderChannel): QuantityMode {
  return channel === "retail_form" ? "box" : "unit";
}

export function parseBrlAmount(raw: string): number {
  const cleaned = raw.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return 0;
  const num = parseFlexibleNumber(cleaned);
  return Math.round(num * 100);
}

export function parseFlexibleNumber(raw: string): number {
  const cleaned = raw.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return 0;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    return parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
  }
  if (cleaned.includes(",")) {
    const parts = cleaned.split(",");
    if (parts[1]?.length === 2) {
      return parseFloat(cleaned.replace(",", ".")) || 0;
    }
    return parseFloat(cleaned.replace(",", ".")) || 0;
  }
  return parseFloat(cleaned) || 0;
}

export function extractCnpj(text: string): string | null {
  const m = text.match(CNPJ_RE);
  return m?.[0] ?? null;
}

export function extractCustomerName(text: string, channel: OrderChannel): string | null {
  const patterns: RegExp[] = [];
  if (channel === "retail_form") {
    patterns.push(
      /RAZÃO\s+SOCIAL:\s*([^\n]+)/i,
      /RAZAO\s+SOCIAL:\s*([^\n]+)/i,
    );
  } else if (channel === "proposal") {
    patterns.push(/Destinatário:\s*([^\n]+)/i, /Destinatario:\s*([^\n]+)/i);
  } else {
    patterns.push(/Cliente:\s*([^\n]+)/i);
  }
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

export function extractReferenceNo(text: string, channel: OrderChannel): string | null {
  if (channel === "proposal") {
    const m = text.match(/PROP-LQ-[A-Z0-9-]+/i);
    return m?.[0] ?? null;
  }
  if (channel === "portal") {
    const m = text.match(
      /(?:Nº do Pedido Carrefour|Pedido Carrefour|CF-[\d-]+):\s*([^\n]+)/i,
    );
    if (m?.[1]) return m[1].trim();
    const cf = text.match(/\bCF-\d{4}-\d+\b/i);
    return cf?.[0] ?? null;
  }
  return null;
}

export function extractPaymentTerms(text: string): string | null {
  const patterns = [
    /FORMA DE PAGAMENTO:\s*([^\n]+)/i,
    /Condição de Pagamento:\s*([^\n]+)/i,
    /Condicao de Pagamento:\s*([^\n]+)/i,
    /Pagamento:\s*([^\n]+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

export function extractFreightType(text: string): string | null {
  const m = text.match(/\bFRETE:\s*([A-Z]{2,4})/i);
  const raw = m?.[1]?.toUpperCase();
  if (!raw) return null;
  if (raw === "CIF") return "Fabrikadan Teslim";
  if (raw === "FOB") return "Kara Yollarından Teslim";
  return raw;
}

export function extractDateField(text: string, label: string): string | null {
  const re = new RegExp(`${label}:\\s*([\\d/.\\-]+)`, "i");
  const m = text.match(re);
  if (!m?.[1]) return null;
  const dm = m[1].match(DATE_RE);
  if (!dm) return null;
  const day = dm[1].padStart(2, "0");
  const month = dm[2].padStart(2, "0");
  let year = dm[3];
  if (year.length === 2) year = `20${year}`;
  return `${year}-${month}-${day}`;
}

export function extractTotalCents(text: string): number {
  const patterns = [
    /VALOR TOTAL DO PEDIDO:\s*R?\$?\s*([\d.,]+)/i,
    /VALOR TOTAL:\s*R?\$?\s*([\d.,]+)/i,
    /Total:\s*R?\$?\s*([\d.,]+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return parseBrlAmount(m[1]);
  }
  return 0;
}

export function extractNotes(text: string): string | null {
  const m = text.match(/OBSERVAÇÕES:\s*([^\n]+)/i);
  return m?.[1]?.trim() ?? null;
}
