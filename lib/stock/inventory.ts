import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { USABLE_LOT_STATUSES } from "./lot-constants";

type DbClient = Prisma.TransactionClient | typeof prisma;

export async function getLotCount(db: DbClient, materialId: string): Promise<number> {
  return db.materialLot.count({ where: { materialId } });
}

export async function getAvailableQty(db: DbClient, materialId: string): Promise<number> {
  const lots = await db.materialLot.findMany({
    where: {
      materialId,
      status: { in: USABLE_LOT_STATUSES },
      quantity: { gt: 0 },
    },
  });

  const fromLots = lots.reduce((sum, lot) => sum + lot.quantity, 0);
  const lotCount = await getLotCount(db, materialId);

  if (lotCount === 0) {
    const material = await db.material.findUnique({ where: { id: materialId } });
    return material?.currentQty ?? 0;
  }

  return fromLots;
}

export async function deductFromReleasedLots(
  db: DbClient,
  materialId: string,
  quantity: number,
): Promise<void> {
  const lots = await db.materialLot.findMany({
    where: {
      materialId,
      status: { in: USABLE_LOT_STATUSES },
      quantity: { gt: 0 },
    },
    orderBy: { receivedAt: "asc" },
  });

  let remaining = quantity;
  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.quantity, remaining);
    await db.materialLot.update({
      where: { id: lot.id },
      data: { quantity: { decrement: take } },
    });
    remaining -= take;
  }

  if (remaining > 0) {
    throw new Error("Serbest lotlardan yeterli miktar yok.");
  }
}

export interface StockValuation {
  totalValueCents: number;
  availableValueCents: number;
  materialCount: number;
}

export async function computeStockValuation(): Promise<StockValuation> {
  const materials = await prisma.material.findMany({
    where: { isActive: true },
    select: { id: true, currentQty: true, unitPriceCents: true },
  });

  let totalValueCents = 0;
  let availableValueCents = 0;

  for (const material of materials) {
    totalValueCents += Math.round(material.currentQty * material.unitPriceCents);
    const available = await getAvailableQty(prisma, material.id);
    availableValueCents += Math.round(available * material.unitPriceCents);
  }

  return {
    totalValueCents,
    availableValueCents,
    materialCount: materials.length,
  };
}

export interface StockAlert {
  type: "low_stock" | "quarantine" | "expiring";
  materialId?: string;
  materialCode?: string;
  materialName?: string;
  lotId?: string;
  internalLotNo?: string;
  message: string;
  severity: "warning" | "info";
}

export async function computeStockAlerts(): Promise<StockAlert[]> {
  const alerts: StockAlert[] = [];

  const allMaterials = await prisma.material.findMany({
    where: { isActive: true, criticalLevel: { gt: 0 } },
  });

  for (const m of allMaterials) {
    if (m.currentQty <= m.criticalLevel) {
      alerts.push({
        type: "low_stock",
        materialId: m.id,
        materialCode: m.code,
        materialName: m.name,
        message: `${m.name}: ${m.currentQty} ${m.unit} (kritik: ${m.criticalLevel})`,
        severity: "warning",
      });
    }
  }

  const quarantineLots = await prisma.materialLot.findMany({
    where: { status: "quarantine", quantity: { gt: 0 } },
    include: { material: { select: { code: true, name: true, unit: true } } },
  });

  for (const lot of quarantineLots) {
    alerts.push({
      type: "quarantine",
      materialId: lot.materialId,
      materialCode: lot.material.code,
      materialName: lot.material.name,
      lotId: lot.id,
      internalLotNo: lot.internalLotNo,
      message: `${lot.internalLotNo}: ${lot.quantity} ${lot.material.unit} karantinada`,
      severity: "info",
    });
  }

  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);

  const expiringLots = await prisma.materialLot.findMany({
    where: {
      expiryDate: { lte: thirtyDays, not: null },
      status: { notIn: ["destroyed"] },
      quantity: { gt: 0 },
    },
    include: { material: { select: { code: true, name: true, unit: true } } },
  });

  for (const lot of expiringLots) {
    if (!lot.expiryDate) continue;
    alerts.push({
      type: "expiring",
      materialId: lot.materialId,
      materialCode: lot.material.code,
      materialName: lot.material.name,
      lotId: lot.id,
      internalLotNo: lot.internalLotNo,
      message: `${lot.internalLotNo}: SKT ${lot.expiryDate.toLocaleDateString("tr-TR")}`,
      severity: "warning",
    });
  }

  return alerts;
}
