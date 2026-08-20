/**
 * Hammadde kartları, kullanıcılar, lezzet/gramaj kataloğu ve fabrika ayarları
 * korunur. Diğer operasyonel veri silinir; ~1 aylık sahte kullanım ve yüksek
 * stok yüklenir ki üretim stok yüzünden takılmasın.
 *
 * Çalıştırma: npx tsx scripts/fake-month.ts
 */
import { PrismaClient } from "@prisma/client";

import { buildPackagingTemplate } from "../lib/recipes/packaging";
import {
  boxesPerBatchForRecipe,
  buildPlannedConsumptions,
  generateProductionLotNo,
  generateProductionNo,
} from "../lib/production/consumption-plan";
import {
  ASSETS,
  CUSTOMERS,
  EMPLOYEES,
  FINISHED_STOCK,
  FIXED_EXPENSES,
  SALES_REPS,
} from "../prisma/seed-data";

const prisma = new PrismaClient();

const FRUIT_FLAVOR_CODES = ["ACA", "LIM", "MRQ", "GRV", "GOI", "CPC", "ABX", "MNG"] as const;
const PKG_CODES = ["85G", "250G"] as const;
const PREMIUM = new Set(["MRQ", "ABX", "CPC", "GOI", "GRV"]);

const TODAY = new Date(Date.UTC(2026, 7, 19, 12, 0, 0));
const MONTH_START = new Date(Date.UTC(2026, 6, 20, 12, 0, 0));

const TARGET_BY_SUBCATEGORY: Record<string, number> = {
  sugar: 200_000,
  starch: 80_000,
  water: 200_000,
  acid: 10_000,
  coffee: 20_000,
  peanut: 50_000,
  fruit: 50_000,
  gelatin: 80_000,
  box: 250_000,
  cradle: 250_000,
  ship_box: 80_000,
};

const CARRIERS = [
  { name: "TransBrazil Logística", driver: "Carlos Silva", plate: "ABC-1D23" },
  { name: "Jamef Transportes", driver: "Paulo Mendes", plate: "RSD-4E18" },
  { name: "Rodonaves", driver: "João Ferreira", plate: "GHP-9K02" },
  { name: "TNT Mercúrio", driver: "Lucas Almeida", plate: "FTR-2M77" },
] as const;

function ymd(date: Date, hour = 12): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, 0, 0),
  );
}

function addDays(date: Date, days: number, hour = 12): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return ymd(d, hour);
}

function isWeekday(date: Date): boolean {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

function weekdaysBetween(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    if (isWeekday(cur)) out.push(ymd(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function targetQty(category: string, subcategory: string | null): number {
  if (subcategory && TARGET_BY_SUBCATEGORY[subcategory] != null) {
    return TARGET_BY_SUBCATEGORY[subcategory];
  }
  return category === "packaging" ? 100_000 : 40_000;
}

function boxPriceCents(flavorCode: string, pkgCode: string): { box: number; unit: number } {
  if (pkgCode === "250G") {
    if (PREMIUM.has(flavorCode)) return { box: 123560, unit: 3089 };
    return { box: 63600, unit: 1590 };
  }
  return { box: 51450, unit: 1029 };
}

async function inChunks<T>(items: T[], size: number, fn: (chunk: T[]) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    await fn(items.slice(i, i + size));
  }
}

async function clearOperationalData() {
  console.log("• Operasyonel veri siliniyor (hammadde kartları korunuyor)...");

  await prisma.gmailInboxMessage.updateMany({
    where: { orderId: { not: null } },
    data: { orderId: null },
  });

  await prisma.pendingApproval.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.bankStatement.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.fixedExpense.deleteMany();
  await prisma.workAssignment.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.shipmentItem.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.scrapRecord.deleteMany();
  await prisma.downtime.deleteMany();
  await prisma.qualityCheck.deleteMany();
  await prisma.productionConsumption.deleteMany();
  await prisma.productionOrder.deleteMany();
  await prisma.orderDocument.deleteMany();
  await prisma.finishedGoodsReservation.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.finishedGoodsStock.deleteMany();
  await prisma.priceTier.deleteMany();
  await prisma.customerPrice.deleteMany();
  await prisma.priceListItem.deleteMany();
  await prisma.productChannelCode.deleteMany();
  await prisma.product.deleteMany();
  await prisma.recipeItem.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.priceList.deleteMany();
  await prisma.salesRep.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.materialLot.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.purchaseRequest.deleteMany();
  await prisma.asset.deleteMany();

  await prisma.line.updateMany({
    data: {
      status: "idle",
      dailyProducedUnits: 0,
      dailyTargetUnits: 0,
      teamSize: 0,
    },
  });
}

async function boostMaterials() {
  console.log("• Hammadde stokları yükseltiliyor...");
  const materials = await prisma.material.findMany({
    select: { id: true, code: true, category: true, subcategory: true, unit: true },
  });
  const expiry = addDays(TODAY, 270);

  await prisma.$transaction(
    materials.flatMap((material) => {
      const qty = targetQty(material.category, material.subcategory);
      return [
        prisma.material.update({
          where: { id: material.id },
          data: { currentQty: qty },
        }),
        prisma.materialLot.create({
          data: {
            materialId: material.id,
            internalLotNo: `L-${material.code}-202607`,
            quantity: qty,
            status: "released",
            receivedAt: MONTH_START,
            expiryDate: expiry,
            notes: "Açılış / takviye lotu — üretim testi",
          },
        }),
        prisma.stockMovement.create({
          data: {
            materialId: material.id,
            type: "in",
            quantity: qty,
            referenceType: "purchase",
            notes: "Ay başı stok takviyesi",
            createdAt: MONTH_START,
          },
        }),
      ];
    }),
  );
  console.log(`  ${materials.length} malzeme lotlandı.`);
}

async function seedRecipes() {
  console.log("• Reçeteler...");
  const materials = await prisma.material.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      unit: true,
      subcategory: true,
      unitPriceCents: true,
    },
  });
  const flavors = await prisma.flavor.findMany();
  const packagings = await prisma.packaging.findMany();
  const materialByCode = Object.fromEntries(materials.map((m) => [m.code, m]));
  const flavorByCode = Object.fromEntries(flavors.map((f) => [f.code, f]));

  const rawByFlavor: Record<string, Array<{ code: string; qty: number; unit: string }>> = {};
  for (const code of FRUIT_FLAVOR_CODES) {
    rawByFlavor[code] = [
      { code: "SEKER", qty: 50, unit: "kg" },
      { code: "NISASTA", qty: 7, unit: "kg" },
      { code: "SU", qty: 50, unit: "L" },
      { code: `MEYVE_${code}`, qty: 25, unit: "kg" },
      { code: "LIMON_TUZU", qty: 0.07, unit: "kg" },
    ];
  }
  rawByFlavor.CAF = [
    { code: "SEKER", qty: 50, unit: "kg" },
    { code: "NISASTA", qty: 7, unit: "kg" },
    { code: "SU", qty: 50, unit: "L" },
    { code: "KAHVE", qty: 0.7, unit: "kg" },
    { code: "FISTIK", qty: 17, unit: "kg" },
    { code: "LIMON_TUZU", qty: 0.07, unit: "kg" },
  ];

  const flavorCodes = [...FRUIT_FLAVOR_CODES, "CAF"] as const;
  for (const flavorCode of flavorCodes) {
    const flavor = flavorByCode[flavorCode];
    if (!flavor) continue;
    const recipe = await prisma.recipe.create({
      data: {
        code: `REC-${flavorCode}`,
        name:
          flavorCode === "CAF"
            ? "Café Amendoim — Özel Reçete"
            : `${flavor.namePt} — Baz Reçete`,
        flavorId: flavor.id,
        yieldKg: 70,
        version: 1,
        createdAt: MONTH_START,
      },
    });
    const rawItems = (rawByFlavor[flavorCode] ?? [])
      .map((item) => {
        const mat = materialByCode[item.code];
        if (!mat) return null;
        return {
          recipeId: recipe.id,
          materialId: mat.id,
          itemType: "raw",
          quantity: item.qty,
          unit: item.unit,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

    const packItems: Array<{
      recipeId: string;
      materialId: string;
      itemType: string;
      packagingId: string;
      quantity: number;
      unit: string;
      notes: string | null;
    }> = [];
    for (const pkg of packagings) {
      if (pkg.code !== "85G" && pkg.code !== "250G") continue;
      const template = buildPackagingTemplate(
        flavorCode,
        pkg.code,
        pkg.unitsPerBox,
        materials,
      );
      for (const item of template) {
        packItems.push({
          recipeId: recipe.id,
          materialId: item.materialId,
          itemType: "packaging",
          packagingId: pkg.id,
          quantity: item.quantity,
          unit: item.unit,
          notes: item.notes ?? null,
        });
      }
    }
    if (rawItems.length + packItems.length > 0) {
      await prisma.recipeItem.createMany({ data: [...rawItems, ...packItems] });
    }
  }
}

async function seedProductsAndPricing() {
  console.log("• Ürünler ve fiyat listeleri...");
  const flavors = await prisma.flavor.findMany();
  const packagings = await prisma.packaging.findMany();
  const recipes = await prisma.recipe.findMany();
  const flavorByCode = Object.fromEntries(flavors.map((f) => [f.code, f]));
  const packagingByCode = Object.fromEntries(packagings.map((p) => [p.code, p]));
  const recipeByFlavor = Object.fromEntries(
    recipes
      .filter((r) => r.flavorId)
      .map((r) => {
        const flavor = flavors.find((f) => f.id === r.flavorId);
        return [flavor?.code ?? "", r];
      }),
  );

  const retailList = await prisma.priceList.create({
    data: {
      code: "VAREJO-NORTE",
      name: "VAREJO — Região Norte/Nordeste",
      channel: "retail",
      region: "Norte/Nordeste",
      isActive: true,
      createdAt: MONTH_START,
    },
  });
  const corporateList = await prisma.priceList.create({
    data: {
      code: "KURUMSAL",
      name: "Kurumsal / Toptan Kanal",
      channel: "corporate",
      region: "National",
      isActive: true,
      createdAt: MONTH_START,
    },
  });

  for (const flavor of flavors) {
    if (flavor.code === "MIX") continue;
    for (const pkgCode of PKG_CODES) {
      const packaging = packagingByCode[pkgCode];
      if (!packaging) continue;
      const recipe = recipeByFlavor[flavor.code];
      const sku = `BD-${packaging.netWeightG}-${flavor.code}`;
      const prices = boxPriceCents(flavor.code, pkgCode);
      const product = await prisma.product.create({
        data: {
          sku,
          name: `${flavor.namePt} ${packaging.label}`,
          flavorId: flavor.id,
          packagingId: packaging.id,
          productType: "normal",
          recipeId: recipe?.id,
          createdAt: MONTH_START,
          channelCodes: {
            create: {
              channel: "corporate",
              externalSku: `LQ-${flavor.code}-${packaging.netWeightG}`,
            },
          },
          priceListItems: {
            create: [
              {
                priceListId: retailList.id,
                boxPriceCents: prices.box,
                unitPriceCents: prices.unit,
              },
              ...(pkgCode === "250G"
                ? [
                    {
                      priceListId: corporateList.id,
                      unitPriceCents: 2500,
                      boxPriceCents: 2500 * (packaging.unitsPerBox || 40),
                    },
                  ]
                : []),
            ],
          },
        },
      });
      void product;
    }
  }

  return { retailList, corporateList };
}

async function seedSalesCustomers(retailListId: string, corporateListId: string) {
  console.log("• Satış temsilcileri ve müşteriler...");
  await prisma.salesRep.createMany({
    data: SALES_REPS.map((rep) => ({
      name: rep.name,
      company: rep.company,
      region: rep.region,
      cep: "cep" in rep ? (rep.cep as string) : null,
      createdAt: MONTH_START,
    })),
  });
  const salesReps = await prisma.salesRep.findMany({ orderBy: { createdAt: "asc" } });
  const aca250 = await prisma.product.findFirst({ where: { sku: "BD-250-ACA" } });

  await prisma.customer.createMany({
    data: CUSTOMERS.map((name, i) => {
      const isCorporate =
        name.includes("Carrefour") || name.includes("Avolta") || name.includes("Assai");
      return {
        name,
        cnpj: name.includes("Carrefour") ? "45.997.418/0001-53" : null,
        region: name.includes("Carrefour") ? "SP" : null,
        salesRepId: salesReps[i % salesReps.length]?.id,
        priceListId: isCorporate ? corporateListId : retailListId,
        paymentTerms: isCorporate ? "45 gün" : i % 5 === 0 ? "15 gün" : "30 gün",
        freightType: "Fabrikadan Teslim",
        isActive: true,
        createdAt: MONTH_START,
      };
    }),
  });

  const carrefour = await prisma.customer.findFirst({
    where: { name: { contains: "Carrefour" } },
  });
  if (carrefour && aca250) {
    await prisma.priceTier.create({
      data: {
        customerId: carrefour.id,
        productId: aca250.id,
        thresholdQty: 500,
        thresholdUnit: "unit",
        unitPriceCents: 2400,
        notes: "500+ adet anlaşma fiyatı",
      },
    });
  }
}

async function seedHrFinanceAssets() {
  console.log("• Personel, sabit gider, demirbaş...");
  await prisma.employee.createMany({
    data: EMPLOYEES.map((emp) => ({
      name: emp.name,
      role: emp.role,
      monthlySalaryCents: emp.salary,
      hourlyRateCents: Math.round(emp.salary / 220),
      isActive: true,
      startDate: new Date(Date.UTC(2025, 10, 1)),
      createdAt: MONTH_START,
    })),
  });

  await prisma.fixedExpense.createMany({
    data: (["2026-07", "2026-08"] as const).flatMap((period) => {
      const factor = period === "2026-07" ? 0.98 : 1;
      return FIXED_EXPENSES.map((expense) => ({
        periodMonth: period,
        name: expense.name,
        amountCents: Math.round(expense.amount * factor),
        category: expense.category,
      }));
    }),
  });

  await prisma.asset.createMany({
    data: ASSETS.map((asset) => ({
      name: asset.name,
      category: asset.category,
      quantity: asset.quantity,
    })),
  });
}

async function seedOpeningFinishedStock() {
  const flavors = await prisma.flavor.findMany();
  const packagings = await prisma.packaging.findMany();
  const products = await prisma.product.findMany({
    select: { id: true, flavorId: true, packagingId: true },
  });
  const flavorByCode = Object.fromEntries(flavors.map((f) => [f.code, f]));
  const packagingByCode = Object.fromEntries(packagings.map((p) => [p.code, p]));

  const rows = [];
  for (const [flavorCode, stock] of Object.entries(FINISHED_STOCK)) {
    const flavor = flavorByCode[flavorCode];
    if (!flavor) continue;
    for (const [pkgCode, qty] of Object.entries(stock)) {
      if (!qty) continue;
      const packaging = packagingByCode[pkgCode];
      if (!packaging) continue;
      const product = products.find(
        (p) => p.flavorId === flavor.id && p.packagingId === packaging.id,
      );
      rows.push({
        flavorId: flavor.id,
        packagingId: packaging.id,
        productId: product?.id ?? null,
        lotNo: `WH-OPEN-${flavorCode}-${pkgCode}`,
        quantity: qty,
        status: "available",
        createdAt: MONTH_START,
      });
    }
  }
  if (rows.length) await prisma.finishedGoodsStock.createMany({ data: rows });
}

type ProductRow = {
  id: string;
  sku: string;
  flavorId: string | null;
  packagingId: string | null;
  recipeId: string | null;
  packaging: { id: string; code: string; netWeightG: number; unitsPerBox: number } | null;
};

type Status =
  | "shipped"
  | "ready_ship"
  | "in_production"
  | "approved"
  | "pending_approval"
  | "draft"
  | "cancelled";

function statusForIndex(i: number, n: number): Status {
  const ratio = i / Math.max(1, n - 1);
  if (ratio < 0.55) return "shipped";
  if (ratio < 0.7) return "ready_ship";
  if (ratio < 0.82) return "in_production";
  if (ratio < 0.9) return "approved";
  if (ratio < 0.95) return "pending_approval";
  if (ratio < 0.98) return "draft";
  return "cancelled";
}

async function seedMonthOperations() {
  console.log("• 1 aylık sipariş / üretim / sevkiyat...");
  const rng = mulberry32(20260819);
  const days = weekdaysBetween(MONTH_START, TODAY);
  const customers = await prisma.customer.findMany({ orderBy: { name: "asc" } });
  const products = (await prisma.product.findMany({
    include: { packaging: true },
  })) as ProductRow[];
  const recipes = await prisma.recipe.findMany({
    include: {
      items: {
        include: {
          material: {
            select: { id: true, code: true, name: true, unit: true, subcategory: true },
          },
        },
      },
    },
  });
  const recipeById = Object.fromEntries(recipes.map((r) => [r.id, r]));
  const lines = await prisma.line.findMany({ orderBy: { code: "asc" } });
  const cookers = lines.filter((l) => l.type === "cooker");
  const employees = await prisma.employee.findMany({ where: { isActive: true } });
  const crew = employees.filter((e) =>
    ["Paketleme", "Kesim", "Genel İmalat", "Pişirme Yardımcısı", "İmalat Yetkilisi"].includes(
      e.role ?? "",
    ),
  );
  const admin = await prisma.user.findFirst({ where: { email: "admin@loquito.com" } });
  const retailItems = await prisma.priceListItem.findMany({
    where: { priceList: { code: "VAREJO-NORTE" } },
  });
  const priceByProduct = Object.fromEntries(retailItems.map((i) => [i.productId, i]));

  const specs: Array<{ day: Date; status: Status; example?: boolean }> = days.map((day, i) => ({
    day,
    status: statusForIndex(i, days.length),
  }));
  specs.push({
    day: new Date(Date.UTC(2026, 7, 4, 12, 0, 0)),
    status: "shipped",
    example: true,
  });

  let prodSeq = 0;
  let shipSeq = 0;
  let liveAssigned = false;
  const customerBalance = new Map<string, number>();
  const workRows: Array<{ employeeId: string; productionOrderId: string; hours: number; date: Date }> =
    [];
  const fgRows: Array<{
    flavorId: string;
    packagingId: string;
    productId: string;
    lotNo: string;
    quantity: number;
    status: string;
    createdAt: Date;
  }> = [];
  const reservationRows: Array<{
    orderId: string;
    orderItemId: string;
    flavorId: string;
    packagingId: string;
    quantity: number;
    status: string;
    createdAt: Date;
  }> = [];

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i]!;
    const customer = spec.example
      ? (customers.find((c) => c.name.includes("Pastorinho")) ?? pick(rng, customers))
      : pick(rng, customers);

    const chosen: ProductRow[] = [];
    if (spec.example) {
      const caf85 = products.find((p) => p.sku === "BD-85-CAF");
      const aca250 = products.find((p) => p.sku === "BD-250-ACA");
      if (caf85) chosen.push(caf85);
      if (aca250) chosen.push(aca250);
    } else {
      const pool = [...products];
      const lineCount = randInt(rng, 1, 2);
      while (chosen.length < lineCount && pool.length > 0) {
        const idx = Math.floor(rng() * pool.length);
        chosen.push(pool.splice(idx, 1)[0]!);
      }
    }

    const items: Array<{
      product: ProductRow;
      boxes: number;
      units: number;
      unitPrice: number;
      boxPrice: number;
      total: number;
    }> = [];

    if (spec.example) {
      const caf85 = chosen.find((p) => p.sku === "BD-85-CAF");
      const aca250 = chosen.find((p) => p.sku === "BD-250-ACA");
      if (caf85) {
        items.push({
          product: caf85,
          boxes: 5,
          units: 250,
          unitPrice: 1029,
          boxPrice: 51450,
          total: 257250,
        });
      }
      if (aca250) {
        items.push({
          product: aca250,
          boxes: 4,
          units: 160,
          unitPrice: 1590,
          boxPrice: 63600,
          total: 254400,
        });
      }
    } else {
      for (const product of chosen) {
        const unitsPerBox = product.packaging?.unitsPerBox || 40;
        const boxes = randInt(rng, 3, 10);
        const units = boxes * unitsPerBox;
        const listed = priceByProduct[product.id];
        const flavorCode = product.sku.split("-").pop() ?? "ACA";
        const pkgCode = product.packaging?.code === "85G" ? "85G" : "250G";
        const fallback = boxPriceCents(flavorCode, pkgCode);
        const boxPrice = listed?.boxPriceCents || fallback.box;
        const unitPrice = listed?.unitPriceCents || fallback.unit;
        items.push({
          product,
          boxes,
          units,
          unitPrice,
          boxPrice,
          total: boxes * boxPrice,
        });
      }
    }

    const goodsTotal = items.reduce((s, it) => s + it.total, 0);
    const freightCents = spec.example ? 540925 - goodsTotal : Math.round(goodsTotal * 0.02);
    const totalCents = spec.example ? 540925 : goodsTotal + freightCents;
    const orderNo = spec.example ? "PED-EXEMPLO-001" : `PED-2026-${String(i + 1).padStart(4, "0")}`;
    const approved =
      spec.status !== "draft" && spec.status !== "pending_approval" && spec.status !== "cancelled";

    const order = await prisma.order.create({
      data: {
        orderNo,
        customerId: customer.id,
        status: spec.status,
        channel: rng() > 0.75 ? "proposal" : "retail_form",
        orderDate: spec.day,
        deliveryDate: addDays(spec.day, randInt(rng, 5, 12)),
        paymentTerms: customer.paymentTerms ?? "30 gün",
        freightType: "Fabrikadan Teslim",
        freightCents,
        totalCents,
        approvedAt: approved ? addDays(spec.day, 0, 15) : null,
        approvedById: approved ? admin?.id ?? null : null,
        createdAt: spec.day,
        items: {
          create: items.map((it) => ({
            productId: it.product.id,
            quantityBoxes: it.boxes,
            quantityUnits: it.units,
            unitPriceCents: it.unitPrice,
            boxPriceCents: it.boxPrice,
            totalCents: it.total,
            shippedBoxes: spec.status === "shipped" ? it.boxes : 0,
            shippedUnits: spec.status === "shipped" ? it.units : 0,
          })),
        },
      },
      include: { items: true },
    });

    const dueDays = (customer.paymentTerms ?? "").includes("15")
      ? 15
      : (customer.paymentTerms ?? "").includes("45")
        ? 45
        : 30;
    const dueDate = addDays(spec.day, dueDays);
    const paid =
      spec.status === "shipped" && addDays(spec.day, dueDays - 5) < TODAY && rng() > 0.28;
    const overdueUnpaid =
      !paid &&
      dueDate < ymd(TODAY, 0) &&
      spec.status !== "draft" &&
      spec.status !== "cancelled";

    if (spec.status !== "draft" && spec.status !== "cancelled") {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          customerId: customer.id,
          amountCents: totalCents,
          direction: "in",
          status: paid ? "paid" : overdueUnpaid ? "overdue" : "pending",
          dueDate,
          paidAt: paid ? addDays(dueDate, -randInt(rng, 1, 4)) : null,
          method: "transfer",
          isApproved: paid,
          notes: customer.paymentTerms ?? "30 gün",
          createdAt: spec.day,
        },
      });
      if (!paid) {
        customerBalance.set(customer.id, (customerBalance.get(customer.id) ?? 0) + totalCents);
      }
    }

    const needsProduction =
      spec.status === "shipped" || spec.status === "ready_ship" || spec.status === "in_production";
    const createdLots: Array<{ productId: string; lotNo: string }> = [];

    if (needsProduction) {
      for (const item of items) {
        const product = item.product;
        if (!product.recipeId || !product.packagingId || !product.packaging) continue;
        const recipe = recipeById[product.recipeId];
        if (!recipe) continue;
        const bpp = boxesPerBatchForRecipe(recipe.yieldKg, product.packaging.netWeightG);
        const planned = buildPlannedConsumptions(recipe, product.packagingId, bpp);
        const cooker = cookers[prodSeq % Math.max(1, cookers.length)]!;
        prodSeq += 1;
        const productionNo = generateProductionNo(prodSeq);
        const lotNo = generateProductionLotNo(productionNo, 1);
        const start = addDays(spec.day, 1, 8);
        const end = addDays(spec.day, 1, 16);
        const isLive = spec.status === "in_production" && !liveAssigned;
        if (isLive) liveAssigned = true;
        const poStatus = spec.status === "in_production" ? "in_progress" : "completed";
        const producedUnits =
          poStatus === "completed" ? bpp : Math.floor(bpp * (isLive ? 0.55 : 0.4));

        const po = await prisma.productionOrder.create({
          data: {
            productionNo,
            lotNo,
            orderId: order.id,
            productId: product.id,
            recipeId: recipe.id,
            lineId: cooker.id,
            status: poStatus,
            plannedKg: recipe.yieldKg,
            producedKg: (producedUnits * product.packaging.netWeightG) / 1000,
            producedUnits,
            scrapKg: poStatus === "completed" && rng() > 0.8 ? 1.8 : 0,
            yieldPercent: poStatus === "completed" ? 97 : null,
            currentStage: poStatus === "completed" ? "packaging" : isLive ? "cooking" : "cutting",
            currentKg: poStatus === "completed" ? recipe.yieldKg : recipe.yieldKg * 0.55,
            stageProgressPercent: poStatus === "completed" ? 100 : isLive ? 58 : 35,
            shift: "morning",
            operatorName: "Muhammed Ali Kalender",
            plannedStart: start,
            plannedEnd: end,
            actualStart: start,
            actualEnd: poStatus === "completed" ? end : null,
            qualityStatus: poStatus === "completed" ? "ok" : null,
            createdAt: spec.day,
            consumptions: {
              create: planned.map((c) => ({
                materialId: c.materialId,
                plannedQty: c.plannedQty,
                actualQty:
                  poStatus === "completed"
                    ? c.plannedQty
                    : Math.round(c.plannedQty * 0.55 * 1000) / 1000,
                unit: c.unit,
              })),
            },
          },
        });

        createdLots.push({ productId: product.id, lotNo });
        for (const emp of crew.slice(0, 3)) {
          workRows.push({
            employeeId: emp.id,
            productionOrderId: po.id,
            hours: 6,
            date: start,
          });
        }

        if (poStatus === "completed" && product.flavorId && product.packagingId) {
          const remaining =
            spec.status === "shipped"
              ? Math.max(8, Math.floor(producedUnits * 0.15))
              : producedUnits;
          fgRows.push({
            flavorId: product.flavorId,
            packagingId: product.packagingId,
            productId: product.id,
            lotNo,
            quantity: remaining,
            status: "available",
            createdAt: addDays(spec.day, 1, 17),
          });
        }
      }
    }

    if (spec.status === "ready_ship") {
      for (const oi of order.items) {
        const product = items.find((it) => it.product.id === oi.productId)?.product;
        if (!product?.flavorId || !product.packagingId) continue;
        reservationRows.push({
          orderId: order.id,
          orderItemId: oi.id,
          flavorId: product.flavorId,
          packagingId: product.packagingId,
          quantity: oi.quantityUnits,
          status: "active",
          createdAt: addDays(spec.day, 2),
        });
      }
    }

    if (spec.status === "shipped" || spec.status === "ready_ship") {
      shipSeq += 1;
      const carrier = pick(rng, CARRIERS);
      const shipped = spec.status === "shipped";
      const shipDate = addDays(spec.day, shipped ? 3 : 4);
      await prisma.shipment.create({
        data: {
          shipmentNo: `SHP-2026-${String(shipSeq).padStart(4, "0")}`,
          orderId: order.id,
          customerId: customer.id,
          status: shipped
            ? addDays(shipDate, 2) < TODAY
              ? "delivered"
              : "in_transit"
            : "planned",
          plannedShipDate: shipDate,
          actualShipDate: shipped ? shipDate : null,
          plannedDelivery: addDays(shipDate, 2),
          actualDelivery: shipped && addDays(shipDate, 2) < TODAY ? addDays(shipDate, 2) : null,
          carrierName: carrier.name,
          driverName: carrier.driver,
          vehiclePlate: carrier.plate,
          trackingNo: shipped ? `TB-2026-${String(shipSeq).padStart(4, "0")}` : null,
          boxCount: items.reduce((s, it) => s + it.boxes, 0),
          palletCount: Math.max(1, Math.ceil(items.reduce((s, it) => s + it.boxes, 0) / 20)),
          sealNo: shipped ? `MHR-${8000 + shipSeq}` : null,
          checkStockReserved: true,
          checkLotExpiry: true,
          checkLabels: true,
          checkQuantities: true,
          checkBoxCount: true,
          checkDocuments: shipped,
          checkDamage: shipped,
          createdAt: addDays(spec.day, 2),
          items: {
            create: order.items.map((oi) => {
              const src = items.find((it) => it.product.id === oi.productId);
              return {
                orderItemId: oi.id,
                productId: oi.productId,
                boxCount: shipped ? src?.boxes ?? Number(oi.quantityBoxes) : 0,
                unitCount: shipped ? src?.units ?? oi.quantityUnits : 0,
                lotNo: createdLots.find((p) => p.productId === oi.productId)?.lotNo ?? null,
              };
            }),
          },
        },
      });
    }

    if (i === 0 || (i + 1) % 5 === 0) {
      console.log(`  sipariş ${i + 1}/${specs.length}`);
    }
  }

  if (workRows.length) await prisma.workAssignment.createMany({ data: workRows });
  if (fgRows.length) await prisma.finishedGoodsStock.createMany({ data: fgRows });
  if (reservationRows.length) {
    await prisma.finishedGoodsReservation.createMany({ data: reservationRows });
  }

  await inChunks([...customerBalance.entries()], 8, async (chunk) => {
    await Promise.all(
      chunk.map(([customerId, balance]) =>
        prisma.customer.update({
          where: { id: customerId },
          data: { balanceCents: balance },
        }),
      ),
    );
  });

  const livePo = await prisma.productionOrder.findFirst({
    where: { status: "in_progress" },
  });
  if (livePo?.lineId) {
    await prisma.line.update({
      where: { id: livePo.lineId },
      data: { status: "running", dailyTargetUnits: 2500, teamSize: 8, dailyProducedUnits: 920 },
    });
  }
  const kesim = lines.find((l) => l.code === "HAT-KESIM");
  const paket = lines.find((l) => l.code === "HAT-PAKET");
  if (kesim) {
    await prisma.line.update({
      where: { id: kesim.id },
      data: { status: "running", dailyTargetUnits: 2000, teamSize: 4, dailyProducedUnits: 640 },
    });
  }
  if (paket) {
    await prisma.line.update({
      where: { id: paket.id },
      data: { status: "idle", dailyTargetUnits: 2000, teamSize: 6 },
    });
  }
  if (cookers[1] && livePo) {
    await prisma.downtime.create({
      data: {
        lineId: cookers[1].id,
        productionOrderId: livePo.id,
        reason: "Buhar vanası bakımı",
        startedAt: addDays(TODAY, -1, 9),
        endedAt: addDays(TODAY, -1, 11),
        notes: "Planlı bakım",
      },
    });
  }

  console.log(`  Sipariş: ${specs.length}, üretim emri: ${prodSeq}, sevkiyat: ${shipSeq}`);
}

async function seedAttendance() {
  console.log("• Puantaj...");
  const employees = await prisma.employee.findMany({ where: { isActive: true } });
  const days = weekdaysBetween(MONTH_START, TODAY);
  const rng = mulberry32(77);
  const rows = [];

  for (const day of days) {
    for (const emp of employees) {
      const roll = rng();
      if (roll > 0.97) {
        rows.push({
          employeeId: emp.id,
          date: day,
          clockIn: null,
          clockOut: null,
          workedHours: 0,
          overtimeHours: 0,
          status: "sick",
        });
        continue;
      }
      if (roll > 0.94) {
        rows.push({
          employeeId: emp.id,
          date: day,
          clockIn: null,
          clockOut: null,
          workedHours: 0,
          overtimeHours: 0,
          status: "leave",
        });
        continue;
      }
      const overtime = roll < 0.12 ? 1 : 0;
      rows.push({
        employeeId: emp.id,
        date: day,
        clockIn: "08:00",
        clockOut: overtime ? "18:00" : "17:00",
        workedHours: 8,
        overtimeHours: overtime,
        status: "present",
      });
    }
  }
  await prisma.attendance.createMany({ data: rows });
}

async function seedPurchases() {
  console.log("• Satın alma...");
  const [sugar, starch, box] = await Promise.all([
    prisma.material.findFirst({
      where: { code: "SEKER" },
      select: { id: true, supplierId: true, unit: true, unitPriceCents: true },
    }),
    prisma.material.findFirst({
      where: { code: "NISASTA" },
      select: { id: true, supplierId: true, unit: true, unitPriceCents: true },
    }),
    prisma.material.findFirst({
      where: { code: "KUTU_ACA_250G" },
      select: { id: true, supplierId: true, unit: true, unitPriceCents: true },
    }),
  ]);

  if (sugar?.supplierId) {
    await prisma.purchaseOrder.create({
      data: {
        orderNo: "PO-2026-0001",
        supplierId: sugar.supplierId,
        orderDate: addDays(MONTH_START, 2),
        deliveryDate: addDays(MONTH_START, 8),
        status: "received",
        totalCents: Math.round(8000 * (sugar.unitPriceCents || 255)),
        notes: "Şeker takviyesi",
        createdAt: addDays(MONTH_START, 2),
        items: {
          create: [
            {
              materialId: sugar.id,
              quantity: 8000,
              unit: sugar.unit,
              unitPriceCents: sugar.unitPriceCents || 255,
              receivedQty: 8000,
            },
          ],
        },
      },
    });
  }
  if (starch?.supplierId) {
    await prisma.purchaseOrder.create({
      data: {
        orderNo: "PO-2026-0002",
        supplierId: starch.supplierId,
        orderDate: addDays(MONTH_START, 12),
        deliveryDate: addDays(MONTH_START, 18),
        status: "received",
        totalCents: Math.round(3000 * (starch.unitPriceCents || 285)),
        notes: "Nişasta takviyesi",
        createdAt: addDays(MONTH_START, 12),
        items: {
          create: [
            {
              materialId: starch.id,
              quantity: 3000,
              unit: starch.unit,
              unitPriceCents: starch.unitPriceCents || 285,
              receivedQty: 3000,
            },
          ],
        },
      },
    });
  }
  if (box?.supplierId) {
    await prisma.purchaseOrder.create({
      data: {
        orderNo: "PO-2026-0003",
        supplierId: box.supplierId,
        orderDate: addDays(TODAY, -4),
        status: "ordered",
        totalCents: Math.round(20000 * (box.unitPriceCents || 200)),
        notes: "Açaí 250g kutu siparişi — yolda",
        items: {
          create: [
            {
              materialId: box.id,
              quantity: 20000,
              unit: box.unit,
              unitPriceCents: box.unitPriceCents || 200,
              receivedQty: 0,
            },
          ],
        },
      },
    });
  }

  const callebaut = await prisma.supplier.findFirst({ where: { name: "Callebaut Brazil" } });
  await prisma.purchaseRequest.createMany({
    data: [
      {
        requestType: "Makine",
        itemName: "Vakum Forming Makinesi",
        usageArea: "İmalat",
        quantity: 1,
        priority: "Yüksek",
        totalCents: 25000000,
        status: "pending_approval",
        createdAt: addDays(MONTH_START, 10),
      },
      {
        requestType: "Makine",
        itemName: "Temperleme Makinesi",
        usageArea: "İmalat",
        quantity: 1,
        priority: "Kritik",
        totalCents: 18000000,
        status: "pending_approval",
        createdAt: addDays(MONTH_START, 10),
      },
      {
        requestType: "Makine",
        itemName: "Soğutma Makinesi",
        usageArea: "İmalat",
        quantity: 1,
        priority: "Kritik",
        totalCents: 25000000,
        status: "approved",
        createdAt: addDays(MONTH_START, 10),
      },
      {
        requestType: "Makine",
        itemName: "Çikolata Kaplama Tezgahı",
        usageArea: "İmalat",
        quantity: 1,
        priority: "Kritik",
        totalCents: 8500000,
        status: "approved",
        createdAt: addDays(MONTH_START, 10),
      },
      {
        requestType: "Makine",
        itemName: "Callebaut %54.6 Çikolata (1000 kg)",
        usageArea: "İmalat",
        quantity: 1,
        priority: "Kritik",
        supplierId: callebaut?.id,
        totalCents: 9500000,
        status: "pending_approval",
        createdAt: addDays(MONTH_START, 10),
      },
    ],
  });
}

async function seedAudit() {
  const admin = await prisma.user.findFirst({ where: { email: "admin@loquito.com" } });
  const priceList = await prisma.priceList.findFirst({ where: { code: "VAREJO-NORTE" } });
  const product = await prisma.product.findFirst({ where: { sku: "BD-85-CAF" } });
  const order = await prisma.order.findFirst({ where: { orderNo: "PED-EXEMPLO-001" } });
  if (!admin) return;
  const rows = [];
  if (priceList && product) {
    rows.push({
      userId: admin.id,
      entityType: "price_list",
      entityId: priceList.id,
      field: `${priceList.code}.${product.sku}.unitPriceCents`,
      oldValue: "R$ 9,50",
      newValue: "R$ 10,29",
      action: "update",
      createdAt: addDays(MONTH_START, 3),
    });
  }
  if (order) {
    rows.push({
      userId: admin.id,
      entityType: "order",
      entityId: order.id,
      field: "status",
      oldValue: "approved",
      newValue: "shipped",
      action: "update",
      createdAt: addDays(order.orderDate, 4),
    });
  }
  if (rows.length) await prisma.auditLog.createMany({ data: rows });
}

async function printSummary() {
  const counts = {
    malzemeler: await prisma.material.count(),
    reçeteler: await prisma.recipe.count(),
    ürünler: await prisma.product.count(),
    müşteriler: await prisma.customer.count(),
    siparişler: await prisma.order.count(),
    üretim: await prisma.productionOrder.count(),
    sevkiyat: await prisma.shipment.count(),
    ödemeler: await prisma.payment.count(),
    personel: await prisma.employee.count(),
    mamulStok: await prisma.finishedGoodsStock.count(),
  };
  console.log("\n📊 Özet:", counts);

  const byStatus = await prisma.order.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  console.log(
    "Sipariş durumları:",
    byStatus.map((s) => `${s.status}:${s._count._all}`).join(", "),
  );

  const sample = await prisma.material.findMany({
    where: { code: { in: ["SEKER", "NISASTA", "BESIK_250G", "KOLI_250G"] } },
    select: { code: true, currentQty: true, unit: true },
  });
  console.log("Stok örnekleri:");
  for (const m of sample) {
    console.log(`  ${m.code}: ${m.currentQty} ${m.unit}`);
  }
}

async function main() {
  console.log("1 aylık sahte veri yükleniyor...\n");
  await clearOperationalData();
  await boostMaterials();
  await seedRecipes();
  const lists = await seedProductsAndPricing();
  await seedSalesCustomers(lists.retailList.id, lists.corporateList.id);
  await seedHrFinanceAssets();
  await seedOpeningFinishedStock();
  await seedMonthOperations();
  await seedAttendance();
  await seedPurchases();
  await seedAudit();
  await printSummary();
  console.log("\nTamam. Giriş: admin@loquito.com / admin123");
}

main()
  .catch((e) => {
    console.error("Hata:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
