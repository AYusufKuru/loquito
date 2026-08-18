import { readFile } from "fs/promises";
import path from "path";

import type { PrismaClient } from "@prisma/client";

import {
  boxesToUnits,
  syncLineQuantities,
  unitsToBoxes,
} from "@/lib/orders/compute";
import type { OrderChannel } from "@/lib/orders/constants";
import { resolveProductByExternalSku } from "@/lib/pricing/sku-map";

import { CHANNEL_LABELS, DEMO_SAMPLE_FILES } from "./constants";
import {
  detectChannel,
  extractCnpj,
  extractCustomerName,
  extractDateField,
  extractFreightType,
  extractNotes,
  extractPaymentTerms,
  extractReferenceNo,
  extractTotalCents,
  quantityModeForChannel,
} from "./field-extract";
import { parseLinesForChannel, toParsedOrderLines } from "./line-parser";
import { extractTextFromBuffer, normalizeOcrText } from "./text-extract";
import type { ParsedOrderDraft, ParsedOrderLine } from "./types";

type Db = PrismaClient;

function resolveSkuChannel(channel: OrderChannel): string | null {
  if (channel === "portal") return "corporate";
  return null;
}

async function matchCustomer(
  db: Db,
  customerName: string | null,
  cnpj: string | null,
): Promise<string | null> {
  if (cnpj) {
    const byCnpj = await db.customer.findFirst({
      where: { cnpj },
      select: { id: true },
    });
    if (byCnpj) return byCnpj.id;
  }

  if (customerName) {
    const normalized = customerName.toLowerCase();
    const customers = await db.customer.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      take: 200,
    });

    const exact = customers.find(
      (c) => c.name.toLowerCase() === normalized,
    );
    if (exact) return exact.id;

    const partial = customers.find((c) => {
      const name = c.name.toLowerCase();
      return name.includes(normalized) || normalized.includes(name);
    });
    if (partial) return partial.id;

    if (normalized.includes("carrefour")) {
      const cf = customers.find((c) =>
        c.name.toLowerCase().includes("carrefour"),
      );
      if (cf) return cf.id;
    }
    if (normalized.includes("avolta")) {
      const av = customers.find((c) =>
        c.name.toLowerCase().includes("avolta"),
      );
      if (av) return av.id;
    }
    if (normalized.includes("pastorinho")) {
      const ps = customers.find((c) =>
        c.name.toLowerCase().includes("pastorinho"),
      );
      if (ps) return ps.id;
    }
  }

  return null;
}

async function enrichLine(
  db: Db,
  line: ParsedOrderLine,
  channel: OrderChannel,
  customerId: string | null,
): Promise<ParsedOrderLine> {
  const warnings = [...line.warnings];
  const skuChannel = resolveSkuChannel(channel);

  const resolution = await resolveProductByExternalSku(
    db,
    line.externalSku,
    {
      customerId,
      channel: skuChannel,
    },
  );

  if (!resolution) {
    warnings.push(`SKU eşlemesi bulunamadı: ${line.externalSku}`);
    return {
      ...line,
      warnings,
      skuResolved: false,
    };
  }

  const product = await db.product.findUnique({
    where: { id: resolution.productId },
    include: { packaging: true },
  });

  const unitsPerBox = product?.packaging?.unitsPerBox ?? line.unitsPerBox ?? 0;
  const inputMode = line.quantityMode === "box" ? "box" : "unit";

  let quantityBoxes = line.quantityBoxes;
  let quantityUnits = line.quantityUnits;

  if (inputMode === "box") {
    const synced = syncLineQuantities(
      "box",
      line.quantityInput,
      0,
      unitsPerBox,
    );
    quantityBoxes = synced.quantityBoxes;
    quantityUnits = synced.quantityUnits;
  } else {
    const synced = syncLineQuantities(
      "unit",
      0,
      line.quantityInput,
      unitsPerBox,
    );
    quantityBoxes = synced.quantityBoxes;
    quantityUnits = synced.quantityUnits;
  }

  if (unitsPerBox > 0 && inputMode === "unit") {
    quantityBoxes = unitsToBoxes(quantityUnits, unitsPerBox);
  } else if (unitsPerBox > 0 && inputMode === "box") {
    quantityUnits = boxesToUnits(quantityBoxes, unitsPerBox);
  }

  let boxPriceCents = line.boxPriceCents;
  let unitPriceCents = line.unitPriceCents;

  if (inputMode === "unit" && unitPriceCents > 0 && unitsPerBox > 0) {
    boxPriceCents = Math.round(unitPriceCents * unitsPerBox);
  } else if (inputMode === "box" && boxPriceCents > 0 && unitsPerBox > 0) {
    unitPriceCents = Math.round(boxPriceCents / unitsPerBox);
  }

  return {
    ...line,
    productId: resolution.productId,
    internalSku: resolution.internalSku,
    productName: resolution.productName,
    skuMatchType: resolution.matchType,
    skuResolved: true,
    unitsPerBox: unitsPerBox || line.unitsPerBox,
    quantityBoxes,
    quantityUnits,
    boxPriceCents,
    unitPriceCents,
    warnings,
  };
}

export async function parseOrderDocumentText(
  db: Db,
  rawText: string,
  options?: { channel?: OrderChannel; customerId?: string },
): Promise<ParsedOrderDraft> {
  const text = normalizeOcrText(rawText);
  const channel = options?.channel ?? detectChannel(text);
  const quantityMode = quantityModeForChannel(channel);
  const parseWarnings: string[] = [];

  const customerName = extractCustomerName(text, channel);
  const customerCnpj = extractCnpj(text);
  let customerId = options?.customerId ?? null;

  if (!customerId) {
    customerId = await matchCustomer(db, customerName, customerCnpj);
    if (!customerId && (customerName || customerCnpj)) {
      parseWarnings.push("Müşteri otomatik eşleşmedi; doğrulama ekranında seçin.");
    }
  }

  const rawLines = parseLinesForChannel(text, channel);
  if (rawLines.length === 0) {
    parseWarnings.push("Kalem satırları çıkarılamadı.");
  }

  let lines = toParsedOrderLines(rawLines);
  lines = await Promise.all(
    lines.map((line) => enrichLine(db, line, channel, customerId)),
  );

  const subtotalCents = lines.reduce((s, l) => s + l.lineTotalCents, 0);
  const extractedTotal = extractTotalCents(text);
  const totalCents = extractedTotal > 0 ? extractedTotal : subtotalCents;
  const freightCents =
    totalCents > subtotalCents ? totalCents - subtotalCents : 0;

  return {
    channel,
    channelLabel: CHANNEL_LABELS[channel],
    quantityMode,
    referenceNo: extractReferenceNo(text, channel),
    customerName,
    customerCnpj,
    customerId,
    orderDate: extractDateField(text, "Data do Pedido"),
    deliveryDate: extractDateField(text, "Data de Entrega"),
    paymentTerms: extractPaymentTerms(text),
    freightType: extractFreightType(text),
    notes: extractNotes(text),
    subtotalCents,
    totalCents,
    freightCents,
    lines,
    parseWarnings,
    rawTextPreview: text.slice(0, 4000),
  };
}

export async function parseOrderDocumentBuffer(
  db: Db,
  buffer: Buffer,
  fileName: string,
  options?: { channel?: OrderChannel; customerId?: string },
): Promise<ParsedOrderDraft> {
  const text = extractTextFromBuffer(buffer, fileName);
  return parseOrderDocumentText(db, text, options);
}

export async function loadDemoSampleText(sampleId: string): Promise<{
  fileName: string;
  channel: OrderChannel;
  text: string;
} | null> {
  const sample = DEMO_SAMPLE_FILES.find((s) => s.id === sampleId);
  if (!sample) return null;

  const fullPath = path.join(process.cwd(), "Dokuman", sample.fileName);
  const text = await readFile(fullPath, "utf8");
  return {
    fileName: sample.fileName,
    channel: sample.channel,
    text,
  };
}

export function listDemoSamples() {
  return DEMO_SAMPLE_FILES.map((s) => ({
    id: s.id,
    fileName: s.fileName,
    channel: s.channel,
    label: s.label,
  }));
}
