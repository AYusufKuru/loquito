export const AUDIT_ENTITY_TYPES = [
  "order",
  "recipe",
  "price_list",
  "customer_price",
  "customer",
  "shipment",
  "user",
  "employee",
] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export const AUDIT_ACTIONS = ["create", "update", "delete", "status_change"] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const ENTITY_TYPE_LABELS: Record<AuditEntityType, string> = {
  order: "Sipariş",
  recipe: "Reçete",
  price_list: "Fiyat listesi",
  customer_price: "Müşteri fiyatı",
  customer: "Müşteri",
  shipment: "Sevkiyat",
  user: "Kullanıcı",
  employee: "Personel",
};

export const ACTION_LABELS: Record<AuditAction, string> = {
  create: "Oluşturma",
  update: "Güncelleme",
  delete: "Silme",
  status_change: "Durum değişimi",
};

export const FIELD_LABELS: Record<string, string> = {
  status: "Durum",
  code: "Kod",
  name: "Ad",
  yieldKg: "Verim (kg)",
  scrapPercent: "Fire %",
  notes: "Notlar",
  isActive: "Aktif",
  totalCents: "Toplam (R$)",
  freightCents: "Navlun (R$)",
  discountCents: "İskonto (R$)",
  unitPriceCents: "Kutu fiyatı",
  boxPriceCents: "Koli fiyatı",
  monthlySalaryCents: "Aylık maaş",
  hourlyRateCents: "Saatlik ücret",
  overtimeMultiplier: "Mesai çarpanı",
};
