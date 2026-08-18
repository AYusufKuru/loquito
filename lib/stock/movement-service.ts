import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  deductFromReleasedLots,
  getAvailableQty,
  getLotCount,
} from "./inventory";
import {
  generateInternalLotNo,
  MOVEMENT_TYPES,
  type MovementType,
} from "./lot-constants";

export interface CreateMovementInput {
  materialId: string;
  type: MovementType;
  quantity: number;
  lotId?: string | null;
  createLot?: boolean;
  internalLotNo?: string | null;
  supplierLotNo?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
}

export function parseMovementInput(body: unknown): { data?: CreateMovementInput; error?: string } {
  if (!body || typeof body !== "object") return { error: "Geçersiz veri." };

  const b = body as Record<string, unknown>;
  const materialId = typeof b.materialId === "string" ? b.materialId : "";
  const type = typeof b.type === "string" ? b.type : "";

  if (!materialId) return { error: "Malzeme seçimi zorunludur." };
  if (!MOVEMENT_TYPES.includes(type as MovementType)) {
    return { error: "Geçersiz hareket tipi." };
  }

  const movementType = type as MovementType;

  if (movementType === "adjustment") {
    const delta = typeof b.delta === "number" ? b.delta : Number(b.delta);
    if (!Number.isFinite(delta) || delta === 0) {
      return { error: "Düzeltme miktarı sıfır olamaz." };
    }
    return {
      data: {
        materialId,
        type: movementType,
        quantity: delta,
        lotId: null,
        notes:
          typeof b.notes === "string" && b.notes.trim() ? b.notes.trim() : null,
      },
    };
  }

  const quantity = typeof b.quantity === "number" ? b.quantity : Number(b.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { error: "Miktar sıfırdan büyük olmalıdır." };
  }

  return {
    data: {
      materialId,
      type: movementType,
      quantity,
      lotId: typeof b.lotId === "string" && b.lotId ? b.lotId : null,
      createLot: Boolean(b.createLot),
      internalLotNo:
        typeof b.internalLotNo === "string" && b.internalLotNo.trim()
          ? b.internalLotNo.trim()
          : null,
      supplierLotNo:
        typeof b.supplierLotNo === "string" && b.supplierLotNo.trim()
          ? b.supplierLotNo.trim()
          : null,
      expiryDate:
        typeof b.expiryDate === "string" && b.expiryDate ? b.expiryDate : null,
      notes:
        typeof b.notes === "string" && b.notes.trim() ? b.notes.trim() : null,
    },
  };
}

export async function applyStockMovementInTx(
  tx: Prisma.TransactionClient,
  input: CreateMovementInput,
) {
  const material = await tx.material.findUnique({ where: { id: input.materialId } });
  if (!material) throw new Error("Malzeme bulunamadı.");

  let lotId: string | null = input.lotId ?? null;
  let movementQty = input.quantity;

  if (input.type === "in") {
    if (input.createLot) {
      const lot = await tx.materialLot.create({
        data: {
          materialId: input.materialId,
          internalLotNo:
            input.internalLotNo ?? generateInternalLotNo(material.code),
          supplierLotNo: input.supplierLotNo,
          quantity: input.quantity,
          expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
          status: "quarantine",
        },
      });
      lotId = lot.id;
    } else if (input.lotId) {
      const lot = await tx.materialLot.findUnique({ where: { id: input.lotId } });
      if (!lot || lot.materialId !== input.materialId) {
        throw new Error("Geçersiz lot.");
      }
      await tx.materialLot.update({
        where: { id: input.lotId },
        data: { quantity: { increment: input.quantity } },
      });
      lotId = input.lotId;
    }

    await tx.material.update({
      where: { id: input.materialId },
      data: { currentQty: { increment: input.quantity } },
    });
  } else if (input.type === "out" || input.type === "scrap") {
    const available = await getAvailableQty(tx, input.materialId);
    if (input.quantity > available) {
      throw new Error(
        `Kullanılabilir stok yetersiz (${available} ${material.unit}). Serbest lotlar sayılır.`,
      );
    }

    if (input.lotId) {
      const lot = await tx.materialLot.findUnique({ where: { id: input.lotId } });
      if (!lot || lot.materialId !== input.materialId) {
        throw new Error("Geçersiz lot.");
      }
      if (lot.status !== "released") {
        throw new Error("Lot serbest bırakılmamış — çıkış yapılamaz.");
      }
      if (lot.quantity < input.quantity) {
        throw new Error("Lot miktarı yetersiz.");
      }
      await tx.materialLot.update({
        where: { id: input.lotId },
        data: { quantity: { decrement: input.quantity } },
      });
    } else {
      const lotCount = await getLotCount(tx, input.materialId);
      if (lotCount > 0) {
        await deductFromReleasedLots(tx, input.materialId, input.quantity);
      }
    }

    await tx.material.update({
      where: { id: input.materialId },
      data: { currentQty: { decrement: input.quantity } },
    });
  } else if (input.type === "adjustment") {
    const delta = input.quantity;
    const newQty = material.currentQty + delta;
    if (newQty < 0) throw new Error("Stok negatif olamaz.");

    movementQty = delta;

    await tx.material.update({
      where: { id: input.materialId },
      data: { currentQty: newQty },
    });
  }

  const movement = await tx.stockMovement.create({
    data: {
      materialId: input.materialId,
      lotId,
      type: input.type,
      quantity: movementQty,
      referenceType: input.referenceType ?? "manual",
      referenceId: input.referenceId ?? null,
      notes: input.notes,
    },
  });

  const updatedMaterial = await tx.material.findUnique({
    where: { id: input.materialId },
  });

  return { movement, material: updatedMaterial };
}

export async function applyStockMovement(input: CreateMovementInput) {
  return prisma.$transaction((tx) => applyStockMovementInTx(tx, input));
}
