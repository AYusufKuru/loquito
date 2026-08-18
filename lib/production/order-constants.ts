export const PRODUCTION_STATUSES = [
  "planned",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type ProductionOrderStatus = (typeof PRODUCTION_STATUSES)[number];

export const PRODUCTION_STATUS_LABELS: Record<ProductionOrderStatus, string> = {
  planned: "Planlandı",
  in_progress: "Devam ediyor",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

export const KANBAN_PRODUCTION_STATUSES: ProductionOrderStatus[] = [
  "planned",
  "in_progress",
  "completed",
];
