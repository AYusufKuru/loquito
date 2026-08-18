import type { Prisma } from "@prisma/client";

import { PRODUCTION_STATUS_LABELS, type ProductionOrderStatus } from "./order-constants";

type OrderRow = Prisma.ProductionOrderGetPayload<{
  include: {
    order: { select: { orderNo: true } };
    product: {
      select: {
        sku: true;
        name: true;
        flavorId: true;
        packagingId: true;
        packaging: { select: { netWeightG: true; label: true } };
      };
    };
    recipe: { select: { code: true; name: true; yieldKg: true } };
    line: { select: { code: true; name: true; type: true } };
    consumptions: {
      include: {
        material: { select: { code: true; name: true; unit: true } };
        lot: { select: { internalLotNo: true; status: true } };
      };
    };
    scrapRecords: true;
  };
}>;

export interface SerializedProductionOrder {
  id: string;
  productionNo: string;
  lotNo: string;
  orderId: string | null;
  orderNo: string | null;
  productId: string | null;
  productSku: string | null;
  productName: string | null;
  packagingLabel: string | null;
  recipeCode: string;
  recipeName: string;
  lineId: string | null;
  lineCode: string | null;
  lineName: string | null;
  status: ProductionOrderStatus;
  statusLabel: string;
  plannedKg: number;
  producedKg: number;
  producedUnits: number;
  scrapKg: number;
  yieldPercent: number | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  notes: string | null;
  consumptions: Array<{
    id: string;
    materialId: string;
    materialCode: string;
    materialName: string;
    unit: string;
    plannedQty: number;
    actualQty: number;
    lotId: string | null;
    internalLotNo: string | null;
    lotStatus: string | null;
  }>;
  scrapRecords: Array<{
    id: string;
    quantityKg: number;
    reason: string | null;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export function serializeProductionOrder(row: OrderRow): SerializedProductionOrder {
  const status = row.status as ProductionOrderStatus;

  return {
    id: row.id,
    productionNo: row.productionNo,
    lotNo: row.lotNo,
    orderId: row.orderId,
    orderNo: row.order?.orderNo ?? null,
    productId: row.productId,
    productSku: row.product?.sku ?? null,
    productName: row.product?.name ?? null,
    packagingLabel: row.product?.packaging?.label ?? null,
    recipeCode: row.recipe.code,
    recipeName: row.recipe.name,
    lineId: row.lineId,
    lineCode: row.line?.code ?? null,
    lineName: row.line?.name ?? null,
    status,
    statusLabel: PRODUCTION_STATUS_LABELS[status] ?? row.status,
    plannedKg: row.plannedKg,
    producedKg: row.producedKg,
    producedUnits: row.producedUnits,
    scrapKg: row.scrapKg,
    yieldPercent: row.yieldPercent,
    plannedStart: row.plannedStart?.toISOString() ?? null,
    plannedEnd: row.plannedEnd?.toISOString() ?? null,
    actualStart: row.actualStart?.toISOString() ?? null,
    actualEnd: row.actualEnd?.toISOString() ?? null,
    notes: row.notes,
    consumptions: row.consumptions.map((c) => ({
      id: c.id,
      materialId: c.materialId,
      materialCode: c.material?.code ?? "",
      materialName: c.material?.name ?? "",
      unit: c.unit,
      plannedQty: c.plannedQty,
      actualQty: c.actualQty,
      lotId: c.lotId,
      internalLotNo: c.lot?.internalLotNo ?? null,
      lotStatus: c.lot?.status ?? null,
    })),
    scrapRecords: row.scrapRecords.map((s) => ({
      id: s.id,
      quantityKg: s.quantityKg,
      reason: s.reason,
      createdAt: s.createdAt.toISOString(),
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
