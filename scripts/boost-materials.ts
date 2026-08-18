import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Üretim testinde stok bitmesin diye hedef miktarlar */
const TARGET_BY_SUBCATEGORY: Record<string, number> = {
  sugar: 50_000,
  starch: 50_000,
  water: 50_000,
  acid: 2_000,
  coffee: 5_000,
  peanut: 20_000,
  fruit: 20_000,
  gelatin: 20_000,
  box: 100_000,
  cradle: 100_000,
  ship_box: 50_000,
};

const FALLBACK_RAW = 20_000;
const FALLBACK_PACKAGING = 50_000;

function targetQty(category: string, subcategory: string | null): number {
  if (subcategory && TARGET_BY_SUBCATEGORY[subcategory] != null) {
    return TARGET_BY_SUBCATEGORY[subcategory];
  }
  return category === "packaging" ? FALLBACK_PACKAGING : FALLBACK_RAW;
}

async function main() {
  const materials = await prisma.material.findMany({
    include: { lots: { select: { id: true, status: true, quantity: true } } },
    orderBy: [{ category: "asc" }, { code: "asc" }],
  });

  console.log(`Malzeme sayısı: ${materials.length}`);

  for (const material of materials) {
    const target = targetQty(material.category, material.subcategory);
    const delta = target - material.currentQty;
    if (delta <= 0) {
      console.log(
        `  skip ${material.code}  mevcut=${material.currentQty} ${material.unit} (hedef ${target})`,
      );
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.material.update({
        where: { id: material.id },
        data: { currentQty: target },
      });

      if (material.lots.length > 0) {
        const suffix = Date.now().toString(36).toUpperCase().slice(-6);
        await tx.materialLot.create({
          data: {
            materialId: material.id,
            internalLotNo: `L-${material.code}-TEST-${suffix}`,
            quantity: delta,
            status: "released",
            notes: "Üretim testi için stok takviyesi",
          },
        });
      }

      await tx.stockMovement.create({
        data: {
          materialId: material.id,
          type: "in",
          quantity: delta,
          referenceType: "manual",
          notes: "Üretim testi için stok takviyesi",
        },
      });
    });

    console.log(
      `  + ${material.code.padEnd(22)} ${material.currentQty} → ${target} ${material.unit}`,
    );
  }

  const after = await prisma.material.findMany({
    select: { code: true, name: true, category: true, currentQty: true, unit: true },
    orderBy: [{ category: "asc" }, { code: "asc" }],
  });
  console.log("\nGüncel stok:");
  for (const m of after) {
    console.log(`  ${m.category.padEnd(10)} ${m.code.padEnd(22)} ${String(m.currentQty).padStart(8)} ${m.unit}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
