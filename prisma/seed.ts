import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { upsertBrazilStateTaxes } from "../lib/finance/tax-locations";

import { buildPackagingTemplate } from "../lib/recipes/packaging";
import {
  buildPlannedConsumptions,
  boxesPerBatchForRecipe,
} from "../lib/production/consumption-plan";
import { reserveStockForOrder } from "../lib/finished-stock/service";
import { createShipment, dispatchShipment } from "../lib/shipments/service";
import { formatBrlFromCents } from "../lib/stock/constants";

import {
  ASSETS,
  CUSTOMERS,
  EMPLOYEES,
  FACTORY_SETTINGS,
  FINISHED_STOCK,
  FLAVORS,
  FIXED_EXPENSES,
  FIXED_EXPENSE_PERIOD_MONTH,
  MODULES,
  PACKAGINGS,
  SALES_REPS,
  SUPPLIERS,
} from "./seed-data";

const prisma = new PrismaClient();

const FRUIT_FLAVOR_CODES = ["ACA", "LIM", "MRQ", "GRV", "GOI", "CPC", "ABX", "MNG"] as const;

async function clearDatabase() {
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
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.taxLocation.deleteMany();
  await prisma.finishedGoodsReservation.deleteMany();
  await prisma.finishedGoodsStock.deleteMany();
  await prisma.priceTier.deleteMany();
  await prisma.customerPrice.deleteMany();
  await prisma.priceListItem.deleteMany();
  await prisma.priceList.deleteMany();
  await prisma.productChannelCode.deleteMany();
  await prisma.product.deleteMany();
  await prisma.recipeItem.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.materialLot.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.purchaseRequest.deleteMany();
  await prisma.material.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.salesRep.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.line.deleteMany();
  await prisma.factorySetting.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
  await prisma.packaging.deleteMany();
  await prisma.flavor.deleteMany();
}

async function seedRolesAndAdmin() {
  const adminRole = await prisma.role.create({
    data: {
      name: "Yönetici",
      description: "Tam yetki — fabrika yöneticisi",
      isSystem: true,
    },
  });

  await prisma.permission.createMany({
    data: MODULES.map((module) => ({
      roleId: adminRole.id,
      module,
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canApprove: true,
    })),
  });

  const salesRole = await prisma.role.create({
    data: {
      name: "Satış / Sipariş",
      description: "Sipariş girişi ve müşteri yönetimi",
      isSystem: true,
    },
  });

  await prisma.permission.createMany({
    data: ["dashboard", "orders", "stock"].map((module) => ({
      roleId: salesRole.id,
      module,
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: false,
      canApprove: false,
    })),
  });

  const passwordHash = await bcrypt.hash("admin123", 10);

  await prisma.user.create({
    data: {
      email: "admin@loquito.com",
      name: "Sistem Yöneticisi",
      passwordHash,
      roleId: adminRole.id,
      canSetPrice: true,
      canApproveOrder: true,
      canApproveFinance: true,
    },
  });

  await prisma.user.create({
    data: {
      email: "ibrahim@loquito.com",
      name: "İbrahim Bakırhan",
      passwordHash,
      roleId: adminRole.id,
      canSetPrice: true,
      canApproveOrder: true,
      canApproveFinance: false,
    },
  });

  await prisma.user.create({
    data: {
      email: "satis@loquito.com",
      name: "Satış Kullanıcısı",
      passwordHash,
      roleId: salesRole.id,
    },
  });
}

async function seedFactoryAndLines() {
  await prisma.factorySetting.createMany({
    data: FACTORY_SETTINGS.map((s) => ({
      key: s.key,
      value: s.value,
      label: s.label,
      category: s.category,
    })),
  });

  await prisma.line.createMany({
    data: [
      { code: "KAZAN-1", name: "Kazan 1", type: "cooker", status: "idle" },
      { code: "KAZAN-2", name: "Kazan 2", type: "cooker", status: "idle" },
      { code: "KAZAN-3", name: "Kazan 3", type: "cooker", status: "idle" },
      { code: "HAT-KESIM", name: "Kesim Hattı", type: "cutting", status: "idle" },
      { code: "HAT-PAKET", name: "Paketleme Hattı", type: "packaging", status: "idle" },
    ],
  });
}

async function seedFlavorsAndPackagings() {
  await prisma.flavor.createMany({
    skipDuplicates: true,
    data: FLAVORS.map((f) => ({
      code: f.code,
      namePt: f.namePt,
      nameTr: f.nameTr,
      collection: f.collection,
      sortOrder: f.sortOrder,
    })),
  });

  await prisma.packaging.createMany({
    skipDuplicates: true,
    data: PACKAGINGS.map((p) => ({
      code: p.code,
      label: p.label,
      netWeightG: p.netWeightG,
      unitsPerBox: p.unitsPerBox,
      isActive: p.isActive,
      sortOrder: p.sortOrder,
    })),
  });
}

async function seedSuppliersAndMaterials() {
  const supplierMap: Record<string, string> = {};

  for (const s of SUPPLIERS) {
    const created = await prisma.supplier.create({ data: { name: s.name, notes: s.notes } });
    supplierMap[s.name] = created.id;
  }

  const flavors = await prisma.flavor.findMany();
  const packagings = await prisma.packaging.findMany();
  const packagingByCode = Object.fromEntries(packagings.map((p) => [p.code, p]));

  // Hammaddeler
  await prisma.material.createMany({
    data: [
      {
        code: "SEKER",
        name: "Şeker",
        category: "raw",
        subcategory: "sugar",
        unit: "kg",
        unitPriceCents: 255,
        currentQty: 50000,
        criticalLevel: 500,
        supplierId: supplierMap["PBB Comercio De Açucar"],
      },
      {
        code: "NISASTA",
        name: "Nişasta",
        category: "raw",
        subcategory: "starch",
        unit: "kg",
        unitPriceCents: 285,
        currentQty: 50000,
        criticalLevel: 500,
        supplierId: supplierMap["Amido Nevadas"],
      },
      {
        code: "SU",
        name: "Su",
        category: "raw",
        subcategory: "water",
        unit: "L",
        unitPriceCents: 0,
        currentQty: 50000,
        criticalLevel: 0,
        notes: "Genel gider — maliyete hammadde olarak yansımaz",
      },
      {
        code: "LIMON_TUZU",
        name: "Sitrik Asit (Limon Tuzu)",
        category: "raw",
        subcategory: "acid",
        unit: "kg",
        unitPriceCents: 2080,
        currentQty: 2000,
        criticalLevel: 5,
        supplierId: supplierMap["Bella Quimicos"],
      },
      {
        code: "KAHVE",
        name: "Kahve",
        category: "raw",
        subcategory: "coffee",
        unit: "kg",
        unitPriceCents: 0,
        currentQty: 5000,
        criticalLevel: 10,
      },
      {
        code: "FISTIK",
        name: "Fıstık / Kaju",
        category: "raw",
        subcategory: "peanut",
        unit: "kg",
        unitPriceCents: 0,
        currentQty: 20000,
        criticalLevel: 50,
        supplierId: supplierMap["Pinho Nuts"],
      },
      {
        code: "JELATIN_IC",
        name: "Jelatin İç Kaplama",
        category: "packaging",
        subcategory: "gelatin",
        unit: "m",
        unitPriceCents: 0,
        currentQty: 20000,
        criticalLevel: 100,
        supplierId: supplierMap["Miura Grafica Industria"],
      },
      {
        code: "JELATIN_DIS",
        name: "Jelatin Dış Kaplama",
        category: "packaging",
        subcategory: "gelatin",
        unit: "m",
        unitPriceCents: 0,
        currentQty: 20000,
        criticalLevel: 100,
        supplierId: supplierMap["Miura Grafica Industria"],
      },
    ],
  });

  // Meyve hammaddeleri (günlük tedarik)
  for (const flavor of flavors) {
    if (flavor.code === "CAF" || flavor.code === "MIX") continue;
    await prisma.material.create({
      data: {
        code: `MEYVE_${flavor.code}`,
        name: `Meyve — ${flavor.namePt}`,
        category: "raw",
        subcategory: "fruit",
        unit: "kg",
        unitPriceCents: 0,
        currentQty: 20000,
        criticalLevel: 0,
        isDailySupply: true,
        supplierId: supplierMap["De Marchi"],
      },
    });
  }

  // Ambalaj: kutu (lezzet × gramaj), beşik, koli
  for (const flavor of flavors) {
    if (flavor.code === "MIX") continue;
    for (const pkgCode of ["85G", "250G"] as const) {
      const pkg = packagingByCode[pkgCode];
      const boxPrice = pkgCode === "85G" ? 175 : 200;
      const boxQty = 100000;

      await prisma.material.create({
        data: {
          code: `KUTU_${flavor.code}_${pkgCode}`,
          name: `Kutu ${flavor.namePt} ${pkg.label}`,
          category: "packaging",
          subcategory: "box",
          unit: "adet",
          unitPriceCents: boxPrice,
          currentQty: boxQty,
          criticalLevel: 100,
          flavorId: flavor.id,
          packagingId: pkg.id,
          supplierId: supplierMap["Pitney Embalagens"],
        },
      });
    }
  }

  for (const pkgCode of ["85G", "250G"] as const) {
    const pkg = packagingByCode[pkgCode];
    const cradlePrice = pkgCode === "85G" ? 35 : 37;
    const cradleQty = 100000;
    const shipQty = 50000;
    const shipPrice = 1200;

    await prisma.material.create({
      data: {
        code: `BESIK_${pkgCode}`,
        name: `Beşik ${pkg.label}`,
        category: "packaging",
        subcategory: "cradle",
        unit: "adet",
        unitPriceCents: cradlePrice,
        currentQty: cradleQty,
        criticalLevel: 100,
        packagingId: pkg.id,
        supplierId: supplierMap["Artevac Vacuum Forming"],
      },
    });

    await prisma.material.create({
      data: {
        code: `KOLI_${pkgCode}`,
        name: `Nakliye Kolisi ${pkg.label}`,
        category: "packaging",
        subcategory: "ship_box",
        unit: "adet",
        unitPriceCents: shipPrice,
        currentQty: shipQty,
        criticalLevel: 20,
        packagingId: pkg.id,
        supplierId: supplierMap["Pitney Embalagens"],
      },
    });
  }
}

async function seedRecipes() {
  const materials = await prisma.material.findMany();
  const flavors = await prisma.flavor.findMany();
  const materialByCode = Object.fromEntries(materials.map((m) => [m.code, m]));
  const flavorByCode = Object.fromEntries(flavors.map((f) => [f.code, f]));

  async function createFruitRecipe(flavorCode: string) {
    const flavor = flavorByCode[flavorCode];
    if (!flavor) return;

    const recipe = await prisma.recipe.create({
      data: {
        code: `REC-${flavorCode}`,
        name: `${flavor.namePt} — Baz Reçete`,
        flavorId: flavor.id,
        yieldKg: 70,
        version: 1,
      },
    });

    const items = [
      { code: "SEKER", qty: 50, unit: "kg" },
      { code: "NISASTA", qty: 7, unit: "kg" },
      { code: "SU", qty: 50, unit: "L" },
      { code: `MEYVE_${flavorCode}`, qty: 25, unit: "kg" },
      { code: "LIMON_TUZU", qty: 0.07, unit: "kg" },
    ];

    for (const item of items) {
      const mat = materialByCode[item.code];
      if (!mat) continue;
      await prisma.recipeItem.create({
        data: {
          recipeId: recipe.id,
          materialId: mat.id,
          itemType: "raw",
          quantity: item.qty,
          unit: item.unit,
        },
      });
    }
  }

  for (const code of FRUIT_FLAVOR_CODES) {
    await createFruitRecipe(code);
  }

  // Kahve reçetesi
  const cafFlavor = flavorByCode["CAF"];
  if (cafFlavor) {
    const coffeeRecipe = await prisma.recipe.create({
      data: {
        code: "REC-CAF",
        name: "Café Amendoim — Özel Reçete",
        flavorId: cafFlavor.id,
        yieldKg: 70,
        version: 1,
      },
    });

    const coffeeItems = [
      { code: "SEKER", qty: 50, unit: "kg" },
      { code: "NISASTA", qty: 7, unit: "kg" },
      { code: "SU", qty: 50, unit: "L" },
      { code: "KAHVE", qty: 0.7, unit: "kg" },
      { code: "FISTIK", qty: 17, unit: "kg" },
      { code: "LIMON_TUZU", qty: 0.07, unit: "kg" },
    ];

    for (const item of coffeeItems) {
      const mat = materialByCode[item.code];
      if (!mat) continue;
      await prisma.recipeItem.create({
        data: {
          recipeId: coffeeRecipe.id,
          materialId: mat.id,
          itemType: "raw",
          quantity: item.qty,
          unit: item.unit,
        },
      });
    }
  }

  const packagings = await prisma.packaging.findMany();
  const packagingMaterials = await prisma.material.findMany({
    where: { category: "packaging" },
    select: {
      id: true,
      code: true,
      name: true,
      unit: true,
      subcategory: true,
      unitPriceCents: true,
    },
  });
  const allRecipes = await prisma.recipe.findMany({
    include: { flavor: { select: { code: true } } },
  });

  for (const recipe of allRecipes) {
    const flavorCode = recipe.flavor?.code;
    if (!flavorCode) continue;

    for (const pkg of packagings) {
      if (pkg.code !== "85G" && pkg.code !== "250G") continue;

      const template = buildPackagingTemplate(
        flavorCode,
        pkg.code,
        pkg.unitsPerBox,
        packagingMaterials,
      );

      for (const item of template) {
        await prisma.recipeItem.create({
          data: {
            recipeId: recipe.id,
            materialId: item.materialId,
            itemType: "packaging",
            packagingId: pkg.id,
            quantity: item.quantity,
            unit: item.unit,
            notes: item.notes,
          },
        });
      }
    }
  }
}

async function seedProductsAndPricing() {
  const flavors = await prisma.flavor.findMany();
  const packagings = await prisma.packaging.findMany();
  const recipes = await prisma.recipe.findMany();
  const flavorByCode = Object.fromEntries(flavors.map((f) => [f.code, f]));
  const packagingByCode = Object.fromEntries(packagings.map((p) => [p.code, p]));
  const recipeByFlavor = Object.fromEntries(
    recipes.filter((r) => r.flavorId).map((r) => {
      const flavor = flavors.find((f) => f.id === r.flavorId);
      return [flavor?.code ?? "", r];
    }),
  );

  const activePairs: Array<{ flavorCode: string; pkgCode: string; skuPrefix: string }> = [];

  for (const flavor of flavors) {
    if (flavor.code === "MIX") continue;
    for (const pkgCode of ["85G", "250G"]) {
      const gramaj = pkgCode === "85G" ? "85" : "250";
      activePairs.push({
        flavorCode: flavor.code,
        pkgCode,
        skuPrefix: pkgCode === "85G" ? `BD-${gramaj}-` : `BD-${gramaj}-`,
      });
    }
  }

  const priceList = await prisma.priceList.create({
    data: {
      code: "VAREJO-NORTE",
      name: "VAREJO — Região Norte/Nordeste",
      channel: "retail",
      region: "Norte/Nordeste",
      isActive: true,
    },
  });

  const premiumFlavors = new Set(["MRQ", "ABX", "CPC", "GOI", "GRV"]);

  for (const pair of activePairs) {
    const flavor = flavorByCode[pair.flavorCode];
    const packaging = packagingByCode[pair.pkgCode];
    if (!flavor || !packaging) continue;

    const sku = `BD-${packaging.netWeightG === 85 ? "85" : "250"}-${flavor.code}`;
    const recipe = recipeByFlavor[flavor.code];

    const product = await prisma.product.create({
      data: {
        sku,
        name: `${flavor.namePt} ${packaging.label}`,
        flavorId: flavor.id,
        packagingId: packaging.id,
        productType: "normal",
        recipeId: recipe?.id,
      },
    });

    // Kurumsal kanal kodu
    const corpSku = `LQ-${flavor.code}-${packaging.netWeightG}`;
    await prisma.productChannelCode.create({
      data: {
        productId: product.id,
        channel: "corporate",
        externalSku: corpSku,
      },
    });

    // Fiyat listesi
    let boxPriceCents = 0;
    let unitPriceCents = 0;

    if (packaging.code === "250G") {
      if (premiumFlavors.has(flavor.code)) {
        boxPriceCents = 123560;
        unitPriceCents = 3089;
      } else {
        boxPriceCents = 63600;
        unitPriceCents = 1590;
      }
    } else if (packaging.code === "85G") {
      boxPriceCents = 51450;
      unitPriceCents = 1029;
    }

    if (boxPriceCents > 0) {
      await prisma.priceListItem.create({
        data: {
          priceListId: priceList.id,
          productId: product.id,
          boxPriceCents,
          unitPriceCents,
        },
      });
    }
  }

  const corporateList = await prisma.priceList.create({
    data: {
      code: "KURUMSAL",
      name: "Kurumsal / Toptan Kanal",
      channel: "corporate",
      region: "National",
      isActive: true,
    },
  });

  const products250 = await prisma.product.findMany({
    where: { packaging: { code: "250G" } },
    include: { packaging: true },
  });

  for (const product of products250) {
    const unitsPerBox = product.packaging?.unitsPerBox ?? 40;
    await prisma.priceListItem.create({
      data: {
        priceListId: corporateList.id,
        productId: product.id,
        unitPriceCents: 2500,
        boxPriceCents: 2500 * unitsPerBox,
      },
    });
  }
}

async function seedDemoAudit() {
  const admin = await prisma.user.findFirst({ where: { email: "admin@loquito.com" } });
  const priceList = await prisma.priceList.findFirst({ where: { code: "VAREJO-NORTE" } });
  const product = await prisma.product.findFirst({ where: { sku: "BD-85-CAF" } });
  if (!admin || !priceList || !product) return;

  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      entityType: "price_list",
      entityId: priceList.id,
      field: `${priceList.code}.${product.sku}.unitPriceCents`,
      oldValue: formatBrlFromCents(950),
      newValue: formatBrlFromCents(1029),
      action: "update",
    },
  });
}

async function seedSalesAndCustomers() {
  const salesRepIds: string[] = [];
  for (const rep of SALES_REPS) {
    const created = await prisma.salesRep.create({
      data: {
        name: rep.name,
        company: rep.company,
        region: rep.region,
        cep: "cep" in rep ? rep.cep : null,
      },
    });
    salesRepIds.push(created.id);
  }

  const retailList = await prisma.priceList.findFirst({ where: { code: "VAREJO-NORTE" } });
  const corporateList = await prisma.priceList.findFirst({ where: { code: "KURUMSAL" } });
  const aca250 = await prisma.product.findFirst({ where: { sku: "BD-250-ACA" } });

  for (let i = 0; i < CUSTOMERS.length; i++) {
    const name = CUSTOMERS[i];
    const isCorporate =
      name.includes("Carrefour") || name.includes("Avolta") || name.includes("Assai");

    const customer = await prisma.customer.create({
      data: {
        name,
        cnpj: name.includes("Carrefour") ? "45.997.418/0001-53" : null,
        region: name.includes("Carrefour") ? "SP" : null,
        salesRepId: salesRepIds[i % salesRepIds.length],
        priceListId: isCorporate ? corporateList?.id : retailList?.id,
        paymentTerms: isCorporate ? "45 gün" : "30 gün",
        freightType: "Fabrikadan Teslim",
        isActive: true,
      },
    });

    if (name.includes("Carrefour") && aca250) {
      await prisma.priceTier.create({
        data: {
          customerId: customer.id,
          productId: aca250.id,
          thresholdQty: 500,
          thresholdUnit: "unit",
          unitPriceCents: 2400,
          notes: "500+ adet anlaşma fiyatı",
        },
      });
    }
  }
}

async function seedExampleOrder() {
  const customer = await prisma.customer.findFirst({
    where: { name: { contains: "Pastorinho" } },
  });
  const caf85 = await prisma.product.findFirst({ where: { sku: "BD-85-CAF" } });
  const aca250 = await prisma.product.findFirst({ where: { sku: "BD-250-ACA" } });
  if (!customer || !caf85 || !aca250) return;

  const box85 = 51450;
  const box250 = 63600;
  const line1Total = 5 * box85;
  const line2Total = 4 * box250;
  const freightCents = 540925 - line1Total - line2Total;

  await prisma.order.create({
    data: {
      orderNo: "PED-EXEMPLO-001",
      customerId: customer.id,
      status: "approved",
      channel: "retail_form",
      orderDate: new Date(`${FIXED_EXPENSE_PERIOD_MONTH}-15T12:00:00`),
      paymentTerms: "30 gün",
      freightType: "Fabrikadan Teslim",
      freightCents,
      totalCents: 540925,
      approvedAt: new Date(),
      items: {
        create: [
          {
            productId: caf85.id,
            quantityBoxes: 5,
            quantityUnits: 250,
            unitPriceCents: 1029,
            boxPriceCents: box85,
            totalCents: line1Total,
          },
          {
            productId: aca250.id,
            quantityBoxes: 4,
            quantityUnits: 160,
            unitPriceCents: 1590,
            boxPriceCents: box250,
            totalCents: line2Total,
          },
        ],
      },
    },
  });
}

async function seedDemoShipment() {
  const order = await prisma.order.findFirst({
    where: { orderNo: "PED-EXEMPLO-001" },
    include: { items: true },
  });
  if (!order || order.items.length < 2) return;

  await prisma.order.update({
    where: { id: order.id },
    data: { status: "ready_ship" },
  });

  try {
    await reserveStockForOrder(prisma, order.id);
  } catch {
    // Kısmi rezervasyon yeterli
  }

  const [item1, item2] = order.items;
  const shipment = await createShipment(prisma, {
    orderId: order.id,
    plannedShipDate: new Date().toISOString().slice(0, 10),
    items: [
      { orderItemId: item1.id, boxCount: 3, unitCount: 150 },
      { orderItemId: item2.id, boxCount: 2, unitCount: 80 },
    ],
  });

  await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      checkStockReserved: true,
      checkLotExpiry: true,
      checkLabels: true,
      checkQuantities: true,
      checkBoxCount: true,
      checkDocuments: true,
      checkDamage: true,
      carrierName: "TransBrazil Logística",
      driverName: "Carlos Silva",
      vehiclePlate: "ABC-1D23",
      trackingNo: "TB-2026-0042",
      palletCount: 2,
      sealNo: "MHR-8842",
    },
  });

  await dispatchShipment(prisma, shipment.id);
}

async function seedDemoLabor() {
  const productionOrder = await prisma.productionOrder.findFirst({
    where: { productionNo: "OP-2026-DEMO" },
  });
  if (!productionOrder) return;

  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    take: 5,
  });

  const today = new Date();
  for (let i = 0; i < 3; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    for (const emp of employees.slice(0, 4)) {
      await prisma.attendance.upsert({
        where: {
          employeeId_date: { employeeId: emp.id, date: d },
        },
        create: {
          employeeId: emp.id,
          date: d,
          clockIn: "08:00",
          clockOut: "17:00",
          workedHours: 8,
          overtimeHours: i === 0 ? 1 : 0,
          status: "present",
        },
        update: {},
      });
    }
  }

  const assignees = employees.slice(0, 3);
  for (const emp of assignees) {
    await prisma.workAssignment.create({
      data: {
        employeeId: emp.id,
        productionOrderId: productionOrder.id,
        hours: 4,
        date: today,
      },
    });
  }
}

async function seedDemoScrap() {
  const productionOrder = await prisma.productionOrder.findFirst({
    where: { productionNo: "OP-2026-DEMO" },
  });
  if (!productionOrder) return;

  await prisma.scrapRecord.create({
    data: {
      productionOrderId: productionOrder.id,
      quantityKg: 2.5,
      reason: "Pişirme sırasında kenar fire",
      createdAt: new Date(`${FIXED_EXPENSE_PERIOD_MONTH}-18T10:00:00`),
    },
  });
}

async function seedDemoPayments() {
  const order = await prisma.order.findFirst({
    where: { orderNo: "PED-EXEMPLO-001" },
    include: { customer: true },
  });
  if (!order) return;

  const dueDate = new Date(order.orderDate);
  dueDate.setDate(dueDate.getDate() + 30);

  const payment = await prisma.payment.create({
    data: {
      orderId: order.id,
      customerId: order.customerId,
      amountCents: order.totalCents,
      direction: "in",
      status: "pending",
      dueDate,
      method: "transfer",
      notes: "30 gün vadeli",
    },
  });

  const { writeFile, mkdir } = await import("fs/promises");
  const path = await import("path");
  const dir = path.join(process.cwd(), "storage", "receipts");
  await mkdir(dir, { recursive: true });
  const demoFile = "demo-bradesco-dekont.txt";
  const relPath = `receipts/${demoFile}`;
  await writeFile(
    path.join(dir, demoFile),
    `Confirmação de Operação — Demo\nTutar: R$ 2.000,00\nSipariş: ${order.orderNo}\n`,
  );

  await prisma.receipt.create({
    data: {
      paymentId: payment.id,
      fileName: "bradesco-dekont-demo.txt",
      filePath: relPath,
      transactionDate: new Date(`${FIXED_EXPENSE_PERIOD_MONTH}-20T14:00:00`),
      amountCents: 200000,
      controlNo: "CTRL-2026-0042",
      counterparty: order.customer.name,
      direction: "in",
      isMatched: true,
    },
  });

  await prisma.customer.update({
    where: { id: order.customerId },
    data: { balanceCents: order.totalCents },
  });
}

async function seedHRAndFinance() {
  for (const emp of EMPLOYEES) {
    await prisma.employee.create({
      data: {
        name: emp.name,
        role: emp.role,
        monthlySalaryCents: emp.salary,
        hourlyRateCents: Math.round(emp.salary / 220),
        isActive: true,
      },
    });
  }

  for (const expense of FIXED_EXPENSES) {
    await prisma.fixedExpense.create({
      data: {
        periodMonth: FIXED_EXPENSE_PERIOD_MONTH,
        name: expense.name,
        amountCents: expense.amount,
        category: expense.category,
      },
    });
  }

  await upsertBrazilStateTaxes(prisma);

  // Önceki ay karşılaştırma demo (birkaç kalem hafif farklı)
  const prevMonth = "2026-01";
  for (const expense of FIXED_EXPENSES.slice(0, 5)) {
    await prisma.fixedExpense.create({
      data: {
        periodMonth: prevMonth,
        name: expense.name,
        amountCents: Math.round(expense.amount * 0.97),
        category: expense.category,
      },
    });
  }
}

async function seedAssetsAndFinishedStock() {
  for (const asset of ASSETS) {
    await prisma.asset.create({
      data: {
        name: asset.name,
        category: asset.category,
        quantity: asset.quantity,
      },
    });
  }

  const flavors = await prisma.flavor.findMany();
  const packagings = await prisma.packaging.findMany();
  const flavorByCode = Object.fromEntries(flavors.map((f) => [f.code, f]));
  const packagingByCode = Object.fromEntries(packagings.map((p) => [p.code, p]));

  for (const [flavorCode, stock] of Object.entries(FINISHED_STOCK)) {
    const flavor = flavorByCode[flavorCode];
    if (!flavor) continue;

    for (const [pkgCode, qty] of Object.entries(stock)) {
      if (!qty) continue;
      const packaging = packagingByCode[pkgCode];
      if (!packaging) continue;

      await prisma.finishedGoodsStock.create({
        data: {
          flavorId: flavor.id,
          packagingId: packaging.id,
          quantity: qty,
          status: "available",
        },
      });
    }
  }
}

async function seedPurchaseRequests() {
  const callebaut = await prisma.supplier.findFirst({ where: { name: "Callebaut Brazil" } });

  const requests = [
    { itemName: "Vakum Forming Makinesi", total: 25000000, priority: "Yüksek" },
    { itemName: "Temperleme Makinesi", total: 18000000, priority: "Kritik" },
    { itemName: "Soğutma Makinesi", total: 25000000, priority: "Kritik" },
    { itemName: "Çikolata Kaplama Tezgahı", total: 8500000, priority: "Kritik" },
    { itemName: "Çikolata Eritme Kazanı 90 Lt", total: 4500000, priority: "Kritik" },
    { itemName: "Callebaut %54.6 Çikolata (1000 kg)", total: 9500000, priority: "Kritik", supplierId: callebaut?.id },
  ];

  for (const req of requests) {
    await prisma.purchaseRequest.create({
      data: {
        requestType: "Makine",
        itemName: req.itemName,
        usageArea: "İmalat",
        quantity: 1,
        priority: req.priority,
        supplierId: req.supplierId,
        totalCents: req.total,
        status: "pending_approval",
      },
    });
  }
}

async function seedDemoLiveProduction() {
  const salesOrder = await prisma.order.findFirst({
    where: { orderNo: "PED-EXEMPLO-001" },
  });
  const product = await prisma.product.findFirst({
    where: { sku: "BD-250-ACA" },
  });
  const line = await prisma.line.findFirst({ where: { code: "KAZAN-1" } });
  if (!salesOrder || !product?.recipeId || !product.packagingId || !line) return;

  const recipe = await prisma.recipe.findUnique({
    where: { id: product.recipeId },
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
  if (!recipe) return;

  const bpp = boxesPerBatchForRecipe(recipe.yieldKg, 250);
  const planned = buildPlannedConsumptions(recipe, product.packagingId, bpp);

  await prisma.line.update({
    where: { id: line.id },
    data: { status: "running", dailyTargetUnits: 2500, teamSize: 10 },
  });

  await prisma.productionOrder.create({
    data: {
      productionNo: "OP-2026-DEMO",
      lotNo: "LOT-2026-DEMO-B1",
      orderId: salesOrder.id,
      productId: product.id,
      recipeId: recipe.id,
      lineId: line.id,
      status: "in_progress",
      plannedKg: recipe.yieldKg,
      currentStage: "cooking",
      currentKg: 42,
      stageProgressPercent: 60,
      shift: "morning",
      operatorName: "Muhammed Ali Kalender",
      actualStart: new Date(),
      consumptions: {
        create: planned.map((c) => ({
          materialId: c.materialId,
          plannedQty: c.plannedQty,
          unit: c.unit,
        })),
      },
    },
  });
}

async function main() {
  console.log("🌱 Seed başlıyor...");
  await clearDatabase();

  await seedRolesAndAdmin();
  console.log("✓ Roller ve admin kullanıcı");

  await seedFactoryAndLines();
  console.log("✓ Fabrika ayarları ve hatlar");

  await seedFlavorsAndPackagings();
  console.log("✓ Lezzetler ve ambalajlar");

  await seedSuppliersAndMaterials();
  console.log("✓ Tedarikçiler ve malzemeler");

  await seedRecipes();
  console.log("✓ Reçeteler");

  await seedProductsAndPricing();
  console.log("✓ Ürünler ve fiyat listesi");

  await seedDemoAudit();
  console.log("✓ Demo fiyat değişiklik logu");

  await seedSalesAndCustomers();
  console.log("✓ Satış temsilcileri ve müşteriler");

  await seedExampleOrder();
  console.log("✓ Örnek sipariş (R$ 5.409,25)");

  await seedDemoLiveProduction();
  console.log("✓ Demo canlı üretim emri (Kazan 1)");

  await seedHRAndFinance();
  console.log("✓ Personel, sabit giderler ve eyalet vergileri");

  await seedDemoLabor();
  console.log("✓ Demo puantaj ve iş atamaları (işçilik maliyeti)");

  await seedDemoScrap();
  console.log("✓ Demo fire kaydı (2,5 kg)");

  await seedDemoPayments();
  console.log("✓ Demo ödeme planı ve dekont");

  await seedAssetsAndFinishedStock();
  console.log("✓ Demirbaş ve mamul stok");

  await seedDemoShipment();
  console.log("✓ Demo kısmi sevkiyat (150+80 adet, kalan takip)");

  await seedPurchaseRequests();
  console.log("✓ Yatırım talepleri");

  const counts = {
    flavors: await prisma.flavor.count(),
    products: await prisma.product.count(),
    materials: await prisma.material.count(),
    recipes: await prisma.recipe.count(),
    customers: await prisma.customer.count(),
    employees: await prisma.employee.count(),
    finishedStock: await prisma.finishedGoodsStock.count(),
  };

  console.log("\n📊 Seed özeti:", counts);
  console.log("✅ Seed tamamlandı!");
  console.log("   Giriş: admin@loquito.com / admin123");
  console.log("   Satış (sınırlı): satis@loquito.com / admin123");
}

main()
  .catch((e) => {
    console.error("Seed hatası:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
