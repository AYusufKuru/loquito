import type { Prisma } from "@prisma/client";

import { getAvailableQtyMap } from "@/lib/stock/inventory";
import { USABLE_LOT_STATUSES, type LotStatus } from "@/lib/stock/lot-constants";

type Tx = Prisma.TransactionClient;

export interface ProductionOutboundInput {
  materialId: string;
  quantity: number;
  lotId?: string | null;
  productionOrderId: string;
  notes?: string | null;
}

type LotRow = {
  id: string;
  materialId: string;
  internalLotNo: string;
  status: string;
  quantity: number;
};

/** Birden fazla malzeme çıkışını tek transaction turunda toplu işler (çok daha hızlı). */
export async function applyProductionOutboundBatch(
  tx: Tx,
  items: ProductionOutboundInput[],
): Promise<void> {
  const activeItems = items.filter(
    (item) => Number.isFinite(item.quantity) && item.quantity > 0,
  );
  if (activeItems.length === 0) return;

  const materialIds = [...new Set(activeItems.map((item) => item.materialId))];

  const materials = await tx.material.findMany({
    where: { id: { in: materialIds } },
  });
  const materialMap = new Map(materials.map((m) => [m.id, m]));

  const availability = await getAvailableQtyMap(tx, materialIds);

  const allLots = await tx.materialLot.findMany({
    where: { materialId: { in: materialIds } },
    orderBy: { receivedAt: "asc" },
    select: {
      id: true,
      materialId: true,
      internalLotNo: true,
      status: true,
      quantity: true,
    },
  });

  const lotById = new Map(allLots.map((lot) => [lot.id, { ...lot }]));
  const releasedLotsByMaterial = new Map<string, LotRow[]>();
  const lotCountByMaterial = new Map<string, number>();

  for (const lot of allLots) {
    lotCountByMaterial.set(
      lot.materialId,
      (lotCountByMaterial.get(lot.materialId) ?? 0) + 1,
    );
    if (!USABLE_LOT_STATUSES.includes(lot.status as LotStatus) || lot.quantity <= 0) continue;
    const list = releasedLotsByMaterial.get(lot.materialId) ?? [];
    list.push({ ...lot });
    releasedLotsByMaterial.set(lot.materialId, list);
  }

  const totalQtyByMaterial = new Map<string, number>();
  for (const item of activeItems) {
    totalQtyByMaterial.set(
      item.materialId,
      (totalQtyByMaterial.get(item.materialId) ?? 0) + item.quantity,
    );
  }

  for (const [materialId, totalQty] of totalQtyByMaterial) {
    const material = materialMap.get(materialId);
    const available = availability.get(materialId) ?? 0;
    if (totalQty > available) {
      throw new Error(
        `${material?.name ?? materialId}: kullanılabilir stok yetersiz (${available} ${material?.unit ?? ""}).`,
      );
    }
  }

  const movements: Prisma.StockMovementCreateManyInput[] = [];

  for (const input of activeItems) {
    const material = materialMap.get(input.materialId);
    if (!material) throw new Error("Malzeme bulunamadı.");

    const quantity = input.quantity;
    let movementLotId: string | null = input.lotId ?? null;

    if (movementLotId) {
      const lot = lotById.get(movementLotId);
      if (!lot || lot.materialId !== input.materialId) {
        throw new Error("Geçersiz lot.");
      }
      if (lot.status !== "released") {
        throw new Error(`${lot.internalLotNo}: lot serbest değil — çıkış yapılamaz.`);
      }
      if (lot.quantity < quantity) {
        throw new Error(`${lot.internalLotNo}: lot miktarı yetersiz.`);
      }
      await tx.materialLot.update({
        where: { id: movementLotId },
        data: { quantity: { decrement: quantity } },
      });
      lot.quantity -= quantity;
    } else if ((lotCountByMaterial.get(input.materialId) ?? 0) > 0) {
      const lots = releasedLotsByMaterial.get(input.materialId) ?? [];
      let remaining = quantity;
      for (const lot of lots) {
        if (remaining <= 0) break;
        const take = Math.min(lot.quantity, remaining);
        if (take <= 0) continue;
        await tx.materialLot.update({
          where: { id: lot.id },
          data: { quantity: { decrement: take } },
        });
        lot.quantity -= take;
        remaining -= take;
      }
      if (remaining > 0) {
        throw new Error("Serbest lotlardan yeterli miktar yok.");
      }
      movementLotId = null;
    }

    movements.push({
      materialId: input.materialId,
      lotId: movementLotId,
      type: "out",
      quantity,
      referenceType: "production",
      referenceId: input.productionOrderId,
      notes: input.notes ?? "Üretim tüketimi",
    });
  }

  for (const [materialId, totalQty] of totalQtyByMaterial) {
    await tx.material.update({
      where: { id: materialId },
      data: { currentQty: { decrement: totalQty } },
    });
  }

  if (movements.length > 0) {
    await tx.stockMovement.createMany({ data: movements });
  }
}

export async function applyProductionOutbound(
  tx: Tx,
  input: ProductionOutboundInput,
): Promise<void> {
  await applyProductionOutboundBatch(tx, [input]);
}
