import type { MaterialCategory } from "@/lib/stock/constants";

import { parseMoneyBrl } from "./orders-validation";
import {
  buildErrors,
  parseDecimal,
  parseNonNegativeInt,
  parsePositiveInt,
  required,
  type FieldErrors,
} from "./validation";

function parseAdjustmentDelta(
  value: string,
  label: string,
): { error: string | null; value: number | null } {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) {
    return { error: `${label} zorunludur.`, value: null };
  }
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return { error: `${label} geçerli bir sayı olmalıdır.`, value: null };
  }
  const n = Number.parseFloat(trimmed);
  if (n === 0) {
    return { error: "Düzeltme miktarı sıfır olamaz.", value: null };
  }
  return { error: null, value: n };
}

export function validateMaterialForm(form: {
  code: string;
  name: string;
  category: MaterialCategory;
  subcategory: string;
  unit: string;
  unitPrice: string;
  currentQty: string;
  criticalLevel: string;
  flavorId: string;
  packagingId: string;
}): FieldErrors | null {
  const entries: Array<[string, string | null | undefined]> = [
    ["code", required(form.code, "Kod")],
    ["name", required(form.name, "Ad")],
    ["unit", required(form.unit, "Birim")],
  ];

  const price = parseMoneyBrl(form.unitPrice, "Birim fiyat");
  if (price.error) entries.push(["unitPrice", price.error]);

  const qty = parseDecimal(form.currentQty, "Stok miktarı", { required: true, min: 0 });
  if (qty.error) entries.push(["currentQty", qty.error]);

  const critical = parseNonNegativeInt(form.criticalLevel, "Kritik seviye", false);
  if (critical.error) entries.push(["criticalLevel", critical.error]);

  if (form.category === "packaging" && form.subcategory === "box") {
    if (!form.flavorId) {
      entries.push(["flavorId", "Kutu ambalajları için lezzet seçimi zorunludur."]);
    }
    if (!form.packagingId) {
      entries.push(["packagingId", "Kutu ambalajları için gramaj seçimi zorunludur."]);
    }
  }

  return buildErrors(entries);
}

export function validateMovementForm(params: {
  materialId: string;
  type: string;
  quantity: string;
  delta: string;
}): FieldErrors | null {
  const entries: Array<[string, string | null | undefined]> = [
    ["materialId", required(params.materialId, "Malzeme")],
  ];

  if (params.type === "adjustment") {
    const adj = parseAdjustmentDelta(params.delta, "Düzeltme miktarı");
    if (adj.error) entries.push(["delta", adj.error]);
  } else {
    const qty = parseDecimal(params.quantity, "Miktar", { required: true, min: 0.001 });
    if (qty.error) entries.push(["quantity", qty.error]);
  }

  return buildErrors(entries);
}

export function validateReserveOrder(orderId: string): FieldErrors | null {
  return buildErrors([["orderId", required(orderId, "Sipariş")]]);
}

export interface PurchaseOrderLineDraft {
  materialId: string;
  quantity: string;
  unitPrice: string;
}

export function validatePurchaseOrderForm(params: {
  supplierId: string;
  lines: PurchaseOrderLineDraft[];
}): FieldErrors | null {
  const entries: Array<[string, string | null | undefined]> = [
    ["supplierId", required(params.supplierId, "Tedarikçi")],
  ];

  const activeLines = params.lines.filter(
    (l) => l.materialId && l.quantity.trim(),
  );

  if (activeLines.length === 0) {
    entries.push(["lines", "En az bir malzeme satırı gerekli."]);
  }

  params.lines.forEach((line, index) => {
    if (!line.materialId && !line.quantity.trim()) return;

    if (!line.materialId) {
      entries.push([`line-${index}-material`, `Satır ${index + 1}: Malzeme seçin.`]);
    }

    if (line.quantity.trim()) {
      const qty = parseDecimal(line.quantity, `Satır ${index + 1} miktarı`, {
        required: true,
        min: 0.001,
      });
      if (qty.error) entries.push([`line-${index}-qty`, qty.error]);
    } else if (line.materialId) {
      entries.push([`line-${index}-qty`, `Satır ${index + 1}: Miktar girin.`]);
    }

    if (line.unitPrice.trim()) {
      const price = parseMoneyBrl(line.unitPrice, `Satır ${index + 1} birim fiyat`);
      if (price.error) entries.push([`line-${index}-price`, price.error]);
    }
  });

  return buildErrors(entries);
}

export function validatePurchaseReceiveForm(
  lines: Array<{ itemId: string; quantity: string; maxQty: number }>,
): FieldErrors | null {
  const entries: Array<[string, string | null | undefined]> = [];
  let hasReceive = false;

  lines.forEach((line, index) => {
    const trimmed = line.quantity.trim();
    if (!trimmed) return;

    hasReceive = true;
    const qty = parseDecimal(line.quantity, `Teslim miktarı`, {
      required: true,
      min: 0.001,
    });
    if (qty.error) {
      entries.push([`recv-${index}`, qty.error]);
      return;
    }
    if (qty.value !== null && qty.value > line.maxQty + 0.0001) {
      entries.push([
        `recv-${index}`,
        `Teslim miktarı kalan miktardan fazla (max ${line.maxQty}).`,
      ]);
    }
  });

  if (!hasReceive) {
    entries.push(["receive", "En az bir satır için teslim miktarı girin."]);
  }

  return buildErrors(entries);
}

export function validateSeparateStock(params: {
  stockId: string;
  quantity: string;
  notes: string;
  availableQty?: number;
}): FieldErrors | null {
  const entries: Array<[string, string | null | undefined]> = [
    ["stockId", required(params.stockId, "Mamul lotu")],
    ["notes", required(params.notes, "Not")],
  ];

  const qty = parsePositiveInt(params.quantity, "Ayırılacak adet", { min: 1 });
  if (qty.error) {
    entries.push(["quantity", qty.error]);
  } else if (
    qty.value != null &&
    params.availableQty != null &&
    qty.value > params.availableQty
  ) {
    entries.push(["quantity", `Kullanılabilir adet yetersiz (${params.availableQty}).`]);
  }

  return buildErrors(entries);
}

