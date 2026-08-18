import {
  PURCHASE_ORDER_STATUSES,
  type PurchaseOrderStatus,
} from "./purchase-order-constants";

type OrderWithRelations = {
  id: string;
  orderNo: string;
  supplierId: string;
  orderDate: Date;
  deliveryDate: Date | null;
  status: string;
  totalCents: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  supplier: { id: string; name: string };
  items: Array<{
    id: string;
    purchaseOrderId: string;
    materialId: string;
    quantity: number;
    unit: string;
    unitPriceCents: number;
    receivedQty: number;
    notes: string | null;
    material: { id: string; code: string; name: string; unit: string };
  }>;
};

export interface PurchaseOrderItemRow {
  id: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  quantity: number;
  receivedQty: number;
  unitPriceCents: number;
  notes: string | null;
}

export interface PurchaseOrderRow {
  id: string;
  orderNo: string;
  supplierId: string;
  supplierName: string;
  orderDate: string;
  deliveryDate: string | null;
  status: PurchaseOrderStatus;
  totalCents: number;
  notes: string | null;
  createdAt: string;
  items: PurchaseOrderItemRow[];
}

export function toPurchaseOrderRow(order: OrderWithRelations): PurchaseOrderRow {
  return {
    id: order.id,
    orderNo: order.orderNo,
    supplierId: order.supplierId,
    supplierName: order.supplier.name,
    orderDate: order.orderDate.toISOString(),
    deliveryDate: order.deliveryDate?.toISOString() ?? null,
    status: order.status as PurchaseOrderStatus,
    totalCents: order.totalCents,
    notes: order.notes,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      materialId: item.materialId,
      materialCode: item.material.code,
      materialName: item.material.name,
      unit: item.unit,
      quantity: item.quantity,
      receivedQty: item.receivedQty,
      unitPriceCents: item.unitPriceCents,
      notes: item.notes,
    })),
  };
}

export function isPurchaseOrderStatus(value: string): value is PurchaseOrderStatus {
  return (PURCHASE_ORDER_STATUSES as readonly string[]).includes(value);
}
