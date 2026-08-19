import { parseBrlToCents } from "@/lib/stock/constants";

import {
  buildErrors,
  email,
  optionalEmail,
  parseDecimal,
  parsePercent,
  parsePositiveInt,
  required,
  type FieldErrors,
} from "./validation";

export function parseMoneyBrl(
  value: string,
  label: string,
  requiredField = false,
): { error: string | null; value: number | null } {
  const trimmed = value.trim();
  if (!trimmed) {
    return requiredField
      ? { error: `${label} zorunludur.`, value: null }
      : { error: null, value: null };
  }
  if (!/^[\d.,]+$/.test(trimmed)) {
    return { error: `${label} geçerli bir tutar olmalıdır (ör. 10,50).`, value: null };
  }
  const cents = parseBrlToCents(trimmed);
  if (cents === null) {
    return { error: `${label} geçerli bir tutar olmalıdır.`, value: null };
  }
  return { error: null, value: cents };
}

export function validateProductForm(form: {
  recipeId: string;
  packagingId: string;
}): FieldErrors | null {
  return buildErrors([
    ["recipeId", required(form.recipeId, "Reçete")],
    ["packagingId", required(form.packagingId, "Gramaj")],
  ]);
}

export function validateSalesRepForm(form: {
  name: string;
  email: string;
}): FieldErrors | null {
  return buildErrors([
    ["name", required(form.name, "Ad")],
    ["email", optionalEmail(form.email, "E-posta")],
  ]);
}

export function validatePriceListHeader(form: {
  code: string;
  name: string;
}): FieldErrors | null {
  return buildErrors([
    ["code", required(form.code, "Kod")],
    ["name", required(form.name, "Ad")],
  ]);
}

export function validatePriceListItems(
  lines: Array<{ productId: string; boxPrice: string; unitPrice: string }>,
  productSkus: Map<string, string>,
): FieldErrors | null {
  const entries: Array<[string, string | null | undefined]> = [];

  for (const line of lines) {
    if (!line.boxPrice.trim() && !line.unitPrice.trim()) continue;
    const sku = productSkus.get(line.productId) ?? "Ürün";
    if (line.boxPrice.trim()) {
      const box = parseMoneyBrl(line.boxPrice, `${sku} koli fiyatı`);
      if (box.error) entries.push([`item-${line.productId}-box`, box.error]);
    }
    if (line.unitPrice.trim()) {
      const unit = parseMoneyBrl(line.unitPrice, `${sku} birim fiyatı`);
      if (unit.error) entries.push([`item-${line.productId}-unit`, unit.error]);
    }
  }

  return buildErrors(entries);
}

export function validateCustomerInfo(form: {
  name: string;
  email: string;
}): FieldErrors | null {
  return buildErrors([
    ["name", required(form.name, "Müşteri adı")],
    ["email", optionalEmail(form.email, "E-posta")],
  ]);
}

export function validateCustomerPrices(
  lines: Array<{ productId: string; boxPrice: string; unitPrice: string }>,
  productSkus: Map<string, string>,
): FieldErrors | null {
  const entries: Array<[string, string | null | undefined]> = [];

  lines.forEach((line, index) => {
    if (!line.productId) {
      entries.push([`price-${index}-product`, `Fiyat satırı ${index + 1}: Ürün seçin.`]);
    }
    if (!line.boxPrice.trim() && !line.unitPrice.trim()) {
      entries.push([
        `price-${index}-amount`,
        `Fiyat satırı ${index + 1}: Koli veya birim fiyat girin.`,
      ]);
      return;
    }
    const sku = productSkus.get(line.productId) ?? `Satır ${index + 1}`;
    if (line.boxPrice.trim()) {
      const box = parseMoneyBrl(line.boxPrice, `${sku} koli fiyatı`);
      if (box.error) entries.push([`price-${index}-box`, box.error]);
    }
    if (line.unitPrice.trim()) {
      const unit = parseMoneyBrl(line.unitPrice, `${sku} birim fiyatı`);
      if (unit.error) entries.push([`price-${index}-unit`, unit.error]);
    }
  });

  return buildErrors(entries);
}

export function validateCustomerTiers(
  lines: Array<{
    thresholdQty: string;
    discountPercent: string;
    boxPrice: string;
    unitPrice: string;
  }>,
): FieldErrors | null {
  const entries: Array<[string, string | null | undefined]> = [];

  lines.forEach((line, index) => {
    const qty = parsePositiveInt(line.thresholdQty, `Kademe ${index + 1} eşik miktarı`, {
      min: 1,
    });
    if (qty.error) entries.push([`tier-${index}-qty`, qty.error]);

    if (line.discountPercent.trim()) {
      const disc = parsePercent(line.discountPercent, `Kademe ${index + 1} iskonto`);
      if (disc.error) entries.push([`tier-${index}-disc`, disc.error]);
    }

    if (line.boxPrice.trim()) {
      const box = parseMoneyBrl(line.boxPrice, `Kademe ${index + 1} koli fiyatı`);
      if (box.error) entries.push([`tier-${index}-box`, box.error]);
    }
    if (line.unitPrice.trim()) {
      const unit = parseMoneyBrl(line.unitPrice, `Kademe ${index + 1} birim fiyatı`);
      if (unit.error) entries.push([`tier-${index}-unit`, unit.error]);
    }
  });

  return buildErrors(entries);
}

export function validateChannelCodes(
  lines: Array<{ productId: string; channel: string; externalSku: string }>,
): FieldErrors | null {
  const entries: Array<[string, string | null | undefined]> = [];

  lines.forEach((line, index) => {
    if (!line.productId) {
      entries.push([`code-${index}-product`, `Kod satırı ${index + 1}: Ürün seçin.`]);
    }
    if (!line.channel.trim()) {
      entries.push([`code-${index}-channel`, `Kod satırı ${index + 1}: Kanal seçin.`]);
    }
    if (!line.externalSku.trim()) {
      entries.push([`code-${index}-sku`, `Kod satırı ${index + 1}: Harici SKU zorunludur.`]);
    }
  });

  return buildErrors(entries);
}

export interface OrderLineInput {
  productId: string;
  quantityBoxes: string;
  quantityUnits: string;
  discountPercent: string;
}

export function validateOrderForm(params: {
  customerId: string;
  customerLabel: string;
  inputMode: "box" | "unit";
  lines: OrderLineInput[];
  discountInput: string;
  freightInput: string;
}): FieldErrors | null {
  const entries: Array<[string, string | null | undefined]> = [
    ["customerId", required(params.customerId, params.customerLabel)],
  ];

  if (params.lines.length === 0) {
    entries.push(["lines", "En az bir sipariş kalemi gerekli."]);
  }

  params.lines.forEach((line, index) => {
    const n = index + 1;
    if (!line.productId) {
      entries.push([`line-${index}-product`, `Kalem ${n}: Ürün seçin.`]);
    }

    if (params.inputMode === "box") {
      const qty = parsePositiveInt(line.quantityBoxes, `Kalem ${n} koli`, { min: 1 });
      if (qty.error) entries.push([`line-${index}-qty`, qty.error]);
    } else {
      const qty = parsePositiveInt(line.quantityUnits, `Kalem ${n} adet`, { min: 1 });
      if (qty.error) entries.push([`line-${index}-qty`, qty.error]);
    }

    if (line.discountPercent.trim()) {
      const disc = parsePercent(line.discountPercent, `Kalem ${n} iskonto`);
      if (disc.error) entries.push([`line-${index}-disc`, disc.error]);
    }
  });

  const discount = parseMoneyBrl(params.discountInput, "Sipariş iskontosu");
  if (discount.error) entries.push(["discount", discount.error]);

  const freight = parseMoneyBrl(params.freightInput, "Navlun tutarı");
  if (freight.error) entries.push(["freight", freight.error]);

  return buildErrors(entries);
}

export { email, optionalEmail };
