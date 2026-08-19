import { RecipesManager } from "@/components/recipes/recipes-manager";
import {
  hasPermission,
  requireModuleAccess,
} from "@/lib/auth/permissions";
import { t } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function RecipesPage() {
  const { permissions } = await requireModuleAccess("recipes");

  const capabilities = {
    canCreate: hasPermission(permissions, "recipes", "create"),
    canEdit: hasPermission(permissions, "recipes", "edit"),
    canDelete: hasPermission(permissions, "recipes", "delete"),
  };

  const [recipes, flavors, customers, rawMaterials, packagingMaterials, packagings] =
    await Promise.all([
      prisma.recipe.findMany({
        include: {
          flavor: { select: { namePt: true, code: true } },
          customer: { select: { name: true } },
          items: {
            where: { itemType: { in: ["raw", "packaging"] } },
            select: { id: true, itemType: true, packagingId: true },
          },
        },
        orderBy: { code: "asc" },
      }),
      prisma.flavor.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, code: true, namePt: true },
      }),
      prisma.customer.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
        take: 200,
      }),
      prisma.material.findMany({
        where: { category: "raw", isActive: true },
        orderBy: { code: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
          subcategory: true,
          unitPriceCents: true,
        },
      }),
      prisma.material.findMany({
        where: { category: "packaging", isActive: true },
        orderBy: { code: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
          subcategory: true,
          unitPriceCents: true,
        },
      }),
      prisma.packaging.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          code: true,
          label: true,
          netWeightG: true,
          unitsPerBox: true,
        },
      }),
    ]);

  const labels: Record<string, string> = {
    title: t("modules.recipes.title"),
    description: t("modules.recipes.description"),
    listTitle: t("recipes.listTitle"),
    records: t("recipes.records"),
    searchPlaceholder: t("recipes.searchPlaceholder"),
    customerSpecific: t("recipes.customerSpecific"),
    newRecipe: t("recipes.newRecipe"),
    selectRecipe: t("recipes.selectRecipe"),
    headerDesc: t("recipes.headerDesc"),
    packagingDesc: t("recipes.packagingDesc"),
    tabRaw: t("recipes.tabRaw"),
    tabPackaging: t("recipes.tabPackaging"),
    code: t("recipes.code"),
    name: t("recipes.name"),
    flavor: t("recipes.flavor"),
    noFlavor: t("recipes.noFlavor"),
    customer: t("recipes.customer"),
    noCustomer: t("recipes.noCustomer"),
    yieldKg: t("recipes.yieldKg"),
    yieldHint: t("recipes.yieldHint"),
    scrapPercent: t("recipes.scrapPercent"),
    scrapHint: t("recipes.scrapHint"),
    inputKg: t("recipes.inputKg"),
    rawSection: t("recipes.rawSection"),
    addLine: t("recipes.addLine"),
    material: t("recipes.material"),
    quantity: t("recipes.quantity"),
    unit: t("recipes.unit"),
    notes: t("recipes.notes"),
    save: t("recipes.save"),
    create: t("recipes.create"),
    saving: t("recipes.saving"),
    created: t("recipes.created"),
    saved: t("recipes.saved"),
    saveError: t("recipes.saveError"),
    connectionError: t("recipes.connectionError"),
    copyRecipe: t("recipes.copyRecipe"),
    copyTitle: t("recipes.copyTitle"),
    copyDesc: t("recipes.copyDesc"),
    replaceFruit: t("recipes.replaceFruit"),
    keepFruit: t("recipes.keepFruit"),
    confirmCopy: t("recipes.confirmCopy"),
    copied: t("recipes.copied"),
    copyError: t("recipes.copyError"),
    packagingProfiles: t("recipes.packagingProfiles"),
    packagingSection: t("recipes.packagingSection"),
    packagingGrammage: t("recipes.packagingGrammage"),
    loadTemplate: t("recipes.loadTemplate"),
    templateLoaded: t("recipes.templateLoaded"),
    templateEmpty: t("recipes.templateEmpty"),
    templateError: t("recipes.templateError"),
    noPackagingOptions: t("recipes.noPackagingOptions"),
    packagingSaveFirst: t("recipes.packagingSaveFirst"),
    flavorCode: t("recipes.flavorCode"),
    perBatch: t("recipes.perBatch"),
    perBatchYes: t("recipes.perBatchYes"),
    perBox: t("recipes.perBox"),
    costTitle: t("recipes.costTitle"),
    boxesPerBatch: t("recipes.boxesPerBatch"),
    rawCost: t("recipes.rawCost"),
    packagingCost: t("recipes.packagingCost"),
    batchCost: t("recipes.batchCost"),
    perKgCost: t("recipes.perKgCost"),
    perBoxCost: t("recipes.perBoxCost"),
    perShipBoxCost: t("recipes.perShipBoxCost"),
    savePackaging: t("recipes.savePackaging"),
    historyTab: t("audit.historyTab"),
    historyTitle: t("audit.historyTitle"),
    historyDesc: t("audit.historyDesc"),
    noLogs: t("audit.noLogs"),
    systemUser: t("audit.systemUser"),
  };

  return (
    <div className="mx-auto max-w-7xl">
      <RecipesManager
          initialRecipes={recipes.map((r) => {
            const rawItems = r.items.filter((i) => i.itemType === "raw");
            const packagingIds = new Set(
              r.items
                .filter((i) => i.itemType === "packaging" && i.packagingId)
                .map((i) => i.packagingId),
            );
            return {
              id: r.id,
              code: r.code,
              name: r.name,
              flavorId: r.flavorId,
              flavorName: r.flavor?.namePt ?? null,
              flavorCode: r.flavor?.code ?? null,
              customerId: r.customerId,
              customerName: r.customer?.name ?? null,
              yieldKg: r.yieldKg,
              scrapPercent: r.scrapPercent,
              version: r.version,
              isActive: r.isActive,
              notes: r.notes,
              rawItemCount: rawItems.length,
              packagingProfileCount: packagingIds.size,
              isCustomerSpecific: Boolean(r.customerId),
            };
          })}
          flavors={flavors.map((f) => ({
            id: f.id,
            code: f.code,
            name: f.namePt,
          }))}
          customers={customers}
          rawMaterials={rawMaterials}
          packagingMaterials={packagingMaterials}
          packagings={packagings}
          capabilities={capabilities}
          labels={labels}
        />
    </div>
  );
}
