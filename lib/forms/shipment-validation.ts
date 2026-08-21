import { CHECKLIST_FIELDS, type ChecklistField } from "@/lib/shipments/constants";

import {
  buildErrors,
  parseNonNegativeInt,
  required,
  type FieldErrors,
} from "./validation";

export interface ShipmentLineDraft {
  orderItemId: string;
  boxCount: string;
  unitCount: string;
  lotNo: string;
  heldUnitCount: string;
  heldLotNo: string;
}

export interface ShipmentProgressLine {
  orderItemId: string;
  sku: string;
  remainingUnits: number;
}

export function validateCreateShipment(params: {
  orderId: string;
  orderLabel: string;
  lineDrafts: ShipmentLineDraft[];
  progressLines: ShipmentProgressLine[];
}): FieldErrors | null {
  const entries: Array<[string, string | null | undefined]> = [
    ["orderId", required(params.orderId, params.orderLabel)],
  ];

  const activeLines = params.lineDrafts.filter((l) => {
    const warehouse = Number(l.unitCount);
    const held = Number(l.heldUnitCount);
    return (
      (l.unitCount.trim() && Number.isFinite(warehouse) && warehouse > 0) ||
      (l.heldUnitCount.trim() && Number.isFinite(held) && held > 0)
    );
  });

  if (activeLines.length === 0) {
    entries.push(["lines", "En az bir sevk kalemi ve adet gerekli."]);
  }

  params.lineDrafts.forEach((draft, index) => {
    const unitTrimmed = draft.unitCount.trim();
    const boxTrimmed = draft.boxCount.trim();
    const heldTrimmed = draft.heldUnitCount.trim();
    if (!unitTrimmed && !boxTrimmed && !heldTrimmed) return;

    const line = params.progressLines.find((l) => l.orderItemId === draft.orderItemId);
    const sku = line?.sku ?? `Kalem ${index + 1}`;

    let warehouseUnits = 0;
    let heldUnits = 0;

    if (unitTrimmed) {
      const units = parseNonNegativeInt(draft.unitCount, `${sku} depo adedi`, false);
      if (units.error) {
        entries.push([`line-${index}-units`, units.error]);
      } else {
        warehouseUnits = units.value ?? 0;
      }
    }

    if (heldTrimmed) {
      const held = parseNonNegativeInt(draft.heldUnitCount, `${sku} ayrılan stok adedi`, false);
      if (held.error) {
        entries.push([`line-${index}-held`, held.error]);
      } else {
        heldUnits = held.value ?? 0;
      }
    }

    const total = warehouseUnits + heldUnits;
    if (total <= 0 && (unitTrimmed || heldTrimmed)) {
      entries.push([`line-${index}-units`, `${sku}: toplam sevk adedi sıfırdan büyük olmalı.`]);
    } else if (line && total > line.remainingUnits) {
      entries.push([
        `line-${index}-units`,
        `${sku}: toplam sevk (${total}) kalan miktarı (${line.remainingUnits}) aşıyor.`,
      ]);
    }

    if (heldUnits > 0 && !draft.heldLotNo.trim()) {
      entries.push([`line-${index}-held-lot`, `${sku}: ayrılan stok için lot no girin.`]);
    }

    if (boxTrimmed) {
      const boxes = parseNonNegativeInt(draft.boxCount, `${sku} koli sayısı`, false);
      if (boxes.error) entries.push([`line-${index}-boxes`, boxes.error]);
    }
  });

  return buildErrors(entries);
}

export function validateCarrierInfo(carrierName: string): FieldErrors | null {
  return buildErrors([["carrierName", required(carrierName, "Taşıyıcı firma")]]);
}

export function validateDispatchShipment(params: {
  carrierName: string;
  checklist: Partial<Record<ChecklistField, boolean>>;
}): FieldErrors | null {
  const entries: Array<[string, string | null | undefined]> = [];

  if (!params.carrierName.trim()) {
    entries.push(["carrierName", "Taşıyıcı firma bilgisi zorunludur."]);
  }

  const incomplete = CHECKLIST_FIELDS.filter((field) => !params.checklist[field]);
  if (incomplete.length > 0) {
    entries.push(["checklist", "Sevk öncesi kontrol listesi tamamlanmalı."]);
  }

  return buildErrors(entries);
}

export function validateIssueUnits(params: {
  shortage: string;
  damage: string;
  returnUnits: string;
}): FieldErrors | null {
  const entries: Array<[string, string | null | undefined]> = [];

  if (params.shortage.trim()) {
    const s = parseNonNegativeInt(params.shortage, "Eksik adet", false);
    if (s.error) entries.push(["issueShortage", s.error]);
  }
  if (params.damage.trim()) {
    const d = parseNonNegativeInt(params.damage, "Hasarlı adet", false);
    if (d.error) entries.push(["issueDamage", d.error]);
  }
  if (params.returnUnits.trim()) {
    const r = parseNonNegativeInt(params.returnUnits, "İade adet", false);
    if (r.error) entries.push(["issueReturn", r.error]);
  }

  return buildErrors(entries);
}

export function validatePalletCount(value: string): FieldErrors | null {
  if (!value.trim()) return null;
  const pallets = parseNonNegativeInt(value, "Palet sayısı", false);
  return buildErrors([["palletCount", pallets.error]]);
}
