import type { OrderChannel } from "@/lib/orders/constants";

import {
  parseBrlAmount,
  parseFlexibleNumber,
} from "./field-extract";
import type { ParsedOrderLine, QuantityMode } from "./types";

interface RawLine {
  externalSku: string;
  flavorName: string | null;
  netWeightG: number | null;
  unitsPerBox: number | null;
  quantityInput: number;
  quantityMode: QuantityMode;
  unitPriceCents: number;
  boxPriceCents: number;
  lineTotalCents: number;
  discountPercent: number;
}

function parseRetailFormLines(text: string): RawLine[] {
  const lines: RawLine[] = [];
  const rowRe =
    /^\s*(\d+)\s*[\|;,]\s*(BD-[A-Z0-9-]+)\s*[\|;,]\s*([^|;\n]+?)\s*[\|;,]\s*(\d+)\s*g?\s*[\|;,]\s*(\d+)\s*[\|;,]\s*([\d.,]+)\s*[\|;,]\s*([\d.,]+)\s*[\|;,]\s*([\d.,]+)\s*[\|;,]\s*([\d.,]+)/gim;

  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(text)) !== null) {
    const quantityBoxes = parseInt(m[1], 10);
    const externalSku = m[2].toUpperCase();
    const flavorName = m[3].trim();
    const netWeightG = parseInt(m[4], 10);
    const unitsPerBox = parseInt(m[5], 10);
    const boxPriceCents = parseBrlAmount(m[6]);
    const unitPriceCents = parseBrlAmount(m[7]);
    const discountPercent = parseFlexibleNumber(m[8]);
    const lineTotalCents = parseBrlAmount(m[9]);

    lines.push({
      externalSku,
      flavorName,
      netWeightG,
      unitsPerBox,
      quantityInput: quantityBoxes,
      quantityMode: "box",
      unitPriceCents,
      boxPriceCents,
      lineTotalCents,
      discountPercent,
    });
  }

  if (lines.length === 0) {
    const altRe =
      /(\d+)\s*[\|;,]\s*(BD-[A-Z0-9-]+)[^\n]*?([\d.,]+)\s*[\|;,]\s*([\d.,]+)\s*[\|;,]\s*([\d.,]+)/gi;
    while ((m = altRe.exec(text)) !== null) {
      const quantityBoxes = parseInt(m[1], 10);
      const externalSku = m[2].toUpperCase();
      const boxPriceCents = parseBrlAmount(m[3]);
      const unitPriceCents = parseBrlAmount(m[4]);
      const lineTotalCents = parseBrlAmount(m[5]);
      lines.push({
        externalSku,
        flavorName: null,
        netWeightG: null,
        unitsPerBox: null,
        quantityInput: quantityBoxes,
        quantityMode: "box",
        unitPriceCents,
        boxPriceCents,
        lineTotalCents,
        discountPercent: 0,
      });
    }
  }

  return lines;
}

function parseUnitBasedLines(text: string, skuPattern: RegExp): RawLine[] {
  const lines: RawLine[] = [];
  const rows = text.split("\n");

  for (const row of rows) {
    if (!skuPattern.test(row)) continue;
    skuPattern.lastIndex = 0;

    const skuMatch = row.match(/\b(BD-[A-Z0-9-]+|LQ-[A-Z]+-\d+)\b/i);
    if (!skuMatch) continue;

    const externalSku = skuMatch[1].toUpperCase();
    const numbers = row.match(/[\d.,]+/g) ?? [];
    if (numbers.length < 3) continue;

    // SKU sonrası ilk sayı genelde miktar
    const afterSku = row.slice(row.indexOf(skuMatch[1]) + skuMatch[1].length);
    const qtyMatch = afterSku.match(/[\d.,]+/);
    const quantityUnits = qtyMatch
      ? Math.round(parseFlexibleNumber(qtyMatch[0]))
      : Math.round(parseFlexibleNumber(numbers[0] ?? "0"));

    const unitPriceCents = parseBrlAmount(
      numbers.length >= 2
        ? (numbers[numbers.length - 2] ?? "0")
        : (numbers[1] ?? "0"),
    );
    const lineTotalCents = parseBrlAmount(numbers[numbers.length - 1] ?? "0");

    const productNameMatch = row.match(
      new RegExp(`${skuMatch[1]}\\s*[|;,]\\s*([^|;,\\d]+)`, "i"),
    );

    lines.push({
      externalSku,
      flavorName: productNameMatch?.[1]?.trim() ?? null,
      netWeightG: null,
      unitsPerBox: null,
      quantityInput: quantityUnits,
      quantityMode: "unit",
      unitPriceCents,
      boxPriceCents: 0,
      lineTotalCents,
      discountPercent: 0,
    });
  }

  return lines;
}

function parseProposalLines(text: string): RawLine[] {
  const lines = parseUnitBasedLines(text, /\bBD-[A-Z0-9-]+\b/i);
  if (lines.length > 0) return lines;

  const rowRe =
    /([^|\n]+)\s*[\|;,]\s*(BD-[A-Z0-9-]+)\s*[\|;,]\s*(\d+)\s*[\|;,]\s*([\d.,]+)\s*[\|;,]\s*([\d.,]+)/gi;
  let m: RegExpExecArray | null;
  const result: RawLine[] = [];
  while ((m = rowRe.exec(text)) !== null) {
    result.push({
      externalSku: m[2].toUpperCase(),
      flavorName: m[1].trim(),
      netWeightG: null,
      unitsPerBox: null,
      quantityInput: parseInt(m[3], 10),
      quantityMode: "unit",
      unitPriceCents: parseBrlAmount(m[4]),
      boxPriceCents: 0,
      lineTotalCents: parseBrlAmount(m[5]),
      discountPercent: 0,
    });
  }
  return result;
}

function parsePortalLines(text: string): RawLine[] {
  const lines = parseUnitBasedLines(text, /\bLQ-[A-Z]+-\d+\b/i);
  if (lines.length > 0) return lines;

  const rowRe =
    /(LQ-[A-Z]+-\d+)\s*[\|;,]\s*(\d+)\s*[\|;,]\s*([\d.,]+)\s*[\|;,]\s*([\d.,]+)/gi;
  let m: RegExpExecArray | null;
  const result: RawLine[] = [];
  while ((m = rowRe.exec(text)) !== null) {
    result.push({
      externalSku: m[1].toUpperCase(),
      flavorName: null,
      netWeightG: null,
      unitsPerBox: null,
      quantityInput: parseInt(m[2], 10),
      quantityMode: "unit",
      unitPriceCents: parseBrlAmount(m[3]),
      boxPriceCents: 0,
      lineTotalCents: parseBrlAmount(m[4]),
      discountPercent: 0,
    });
  }
  return result;
}

export function parseLinesForChannel(
  text: string,
  channel: OrderChannel,
): RawLine[] {
  switch (channel) {
    case "retail_form":
      return parseRetailFormLines(text);
    case "proposal":
      return parseProposalLines(text);
    case "portal":
      return parsePortalLines(text);
    default:
      return [];
  }
}

export function toParsedOrderLines(rawLines: RawLine[]): ParsedOrderLine[] {
  return rawLines.map((raw, index) => {
    const quantityBoxes =
      raw.quantityMode === "box" ? raw.quantityInput : 0;
    const quantityUnits =
      raw.quantityMode === "unit" ? raw.quantityInput : 0;

    return {
      lineIndex: index,
      externalSku: raw.externalSku,
      flavorName: raw.flavorName,
      netWeightG: raw.netWeightG,
      unitsPerBox: raw.unitsPerBox,
      quantityInput: raw.quantityInput,
      quantityMode: raw.quantityMode,
      quantityBoxes,
      quantityUnits,
      unitPriceCents: raw.unitPriceCents,
      boxPriceCents: raw.boxPriceCents,
      lineTotalCents: raw.lineTotalCents,
      discountPercent: raw.discountPercent,
      productId: null,
      internalSku: null,
      productName: null,
      skuMatchType: null,
      skuResolved: false,
      warnings: [],
    };
  });
}
