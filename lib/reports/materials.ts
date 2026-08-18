import type { PrismaClient } from "@prisma/client";

import type { DateRange } from "./constants";
import type { MaterialConsumptionReport, MaterialConsumptionRow } from "./types";

type Db = PrismaClient;

export async function buildMaterialConsumptionReport(
  db: Db,
  range: DateRange,
): Promise<MaterialConsumptionReport> {
  const movements = await db.stockMovement.findMany({
    where: {
      type: { in: ["out", "scrap"] },
      createdAt: { gte: range.start, lte: range.end },
    },
    include: {
      material: {
        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
          category: true,
          unitPriceCents: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const map = new Map<string, MaterialConsumptionRow>();

  for (const mv of movements) {
    const mat = mv.material;
    const existing = map.get(mat.id) ?? {
      materialId: mat.id,
      materialCode: mat.code,
      materialName: mat.name,
      unit: mat.unit,
      category: mat.category,
      quantity: 0,
      costCents: 0,
    };
    existing.quantity += mv.quantity;
    existing.costCents += Math.round(mv.quantity * mat.unitPriceCents);
    map.set(mat.id, existing);
  }

  const consumptions = await db.productionConsumption.findMany({
    where: {
      productionOrder: {
        actualEnd: { gte: range.start, lte: range.end },
      },
      actualQty: { gt: 0 },
    },
    include: {
      material: {
        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
          category: true,
          unitPriceCents: true,
        },
      },
    },
  });

  for (const row of consumptions) {
    const mat = row.material;
    const existing = map.get(mat.id) ?? {
      materialId: mat.id,
      materialCode: mat.code,
      materialName: mat.name,
      unit: mat.unit,
      category: mat.category,
      quantity: 0,
      costCents: 0,
    };
    if (row.actualQty > existing.quantity) {
      existing.quantity = row.actualQty;
      existing.costCents = Math.round(row.actualQty * mat.unitPriceCents);
    }
    map.set(mat.id, existing);
  }

  const rows = Array.from(map.values()).sort((a, b) => b.costCents - a.costCents);
  const totalCostCents = rows.reduce((s, r) => s + r.costCents, 0);

  return {
    rangeLabel: range.label,
    rows,
    totalCostCents,
  };
}
