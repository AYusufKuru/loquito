import type { Prisma } from "@prisma/client";

import { deductFromReleasedLots, getAvailableQty } from "@/lib/stock/inventory";

type Tx = Prisma.TransactionClient;

export interface ProductionOutboundInput {
  materialId: string;
  quantity: number;
  lotId?: string | null;
  productionOrderId: string;
  notes?: string | null;
}

export async function applyProductionOutbound(
  tx: Tx,
  input: ProductionOutboundInput,
): Promise<void> {
  const material = await tx.material.findUnique({ where: { id: input.materialId } });
  if (!material) throw new Error("Malzeme bulunamadı.");

  const quantity = input.quantity;
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Geçersiz tüketim miktarı.");
  }

  const available = await getAvailableQty(tx, input.materialId);
  if (quantity > available) {
    throw new Error(
      `${material.name}: kullanılabilir stok yetersiz (${available} ${material.unit}).`,
    );
  }

  const lotId: string | null = input.lotId ?? null;

  if (lotId) {
    const lot = await tx.materialLot.findUnique({ where: { id: lotId } });
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
      where: { id: lotId },
      data: { quantity: { decrement: quantity } },
    });
  } else {
    const lotCount = await tx.materialLot.count({ where: { materialId: input.materialId } });
    if (lotCount > 0) {
      await deductFromReleasedLots(tx, input.materialId, quantity);
    }
  }

  await tx.material.update({
    where: { id: input.materialId },
    data: { currentQty: { decrement: quantity } },
  });

  await tx.stockMovement.create({
    data: {
      materialId: input.materialId,
      lotId,
      type: "out",
      quantity,
      referenceType: "production",
      referenceId: input.productionOrderId,
      notes: input.notes ?? "Üretim tüketimi",
    },
  });
}
