export const SHIPMENT_STATUSES = [
  "planned",
  "preparing",
  "loaded",
  "in_transit",
  "delivered",
  "issue",
  "returned",
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  planned: "Planlandı",
  preparing: "Hazırlanıyor",
  loaded: "Yüklendi",
  in_transit: "Yolda",
  delivered: "Teslim edildi",
  issue: "Sorunlu",
  returned: "İade",
};

export const SHIPMENT_STATUS_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  planned: ["preparing"],
  preparing: ["loaded", "planned"],
  loaded: ["in_transit", "preparing"],
  in_transit: ["delivered", "issue"],
  delivered: ["issue", "returned"],
  issue: ["returned", "delivered"],
  returned: [],
};

export const CHECKLIST_FIELDS = [
  "checkStockReserved",
  "checkLotExpiry",
  "checkLabels",
  "checkQuantities",
  "checkBoxCount",
  "checkDocuments",
  "checkDamage",
] as const;

export type ChecklistField = (typeof CHECKLIST_FIELDS)[number];

export const CHECKLIST_LABELS: Record<ChecklistField, string> = {
  checkStockReserved: "Stok rezervasyonu",
  checkLotExpiry: "Lot / SKT kontrolü",
  checkLabels: "Etiket kontrolü",
  checkQuantities: "Miktar doğrulama",
  checkBoxCount: "Koli / palet sayımı",
  checkDocuments: "Belgeler",
  checkDamage: "Hasar kontrolü",
};

export function canTransitionShipment(from: ShipmentStatus, to: ShipmentStatus): boolean {
  const allowed = SHIPMENT_STATUS_TRANSITIONS[from];
  return allowed?.includes(to) ?? false;
}

export function isChecklistComplete(checklist: Record<ChecklistField, boolean>): boolean {
  return CHECKLIST_FIELDS.every((field) => checklist[field]);
}
