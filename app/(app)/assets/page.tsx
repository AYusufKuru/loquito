import { AssetsManager } from "@/components/assets/assets-manager";
import {
  hasPermission,
  requireModuleAccess,
} from "@/lib/auth/permissions";
import {
  getPurchaseSummary,
  listAssets,
  listPurchaseRequests,
  serializeAsset,
  serializePurchaseRequest,
} from "@/lib/assets/service";
import { t } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function AssetsPage() {
  const { permissions } = await requireModuleAccess("assets");

  const canCreate = hasPermission(permissions, "assets", "create");
  const canEdit = hasPermission(permissions, "assets", "edit");
  const canDelete = hasPermission(permissions, "assets", "delete");

  const [assets, requests, summary, suppliers] = await Promise.all([
    listAssets(prisma),
    listPurchaseRequests(prisma),
    getPurchaseSummary(prisma),
    prisma.supplier.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalValueCents = assets.reduce(
    (sum, a) => sum + a.valueCents * a.quantity,
    0,
  );

  const labels: Record<string, string> = {
    requestsTab: t("assets.requestsTab"),
    inventoryTab: t("assets.inventoryTab"),
    inventoryTitle: t("assets.inventoryTitle"),
    inventoryDesc: t("assets.inventoryDesc"),
    requestsTitle: t("assets.requestsTitle"),
    requestsDesc: t("assets.requestsDesc"),
    pendingApproval: t("assets.pendingApproval"),
    approvedTotal: t("assets.approvedTotal"),
    orderedTotal: t("assets.orderedTotal"),
    chocolateLineHint: t("assets.chocolateLineHint"),
    requestCount: t("assets.requestCount"),
    name: t("assets.name"),
    category: t("assets.category"),
    quantity: t("assets.quantity"),
    value: t("assets.value"),
    totalValue: t("assets.totalValue"),
    location: t("assets.location"),
    notes: t("assets.notes"),
    status: t("assets.status"),
    active: t("assets.active"),
    inactive: t("assets.inactive"),
    activeCount: t("assets.activeCount"),
    itemCount: t("assets.itemCount"),
    addAsset: t("assets.addAsset"),
    newAsset: t("assets.newAsset"),
    newRequest: t("assets.newRequest"),
    requestType: t("assets.requestType"),
    itemName: t("assets.itemName"),
    usageArea: t("assets.usageArea"),
    priority: t("assets.priority"),
    supplier: t("assets.supplier"),
    noSupplier: t("assets.noSupplier"),
    total: t("assets.total"),
    deliveryDays: t("assets.deliveryDays"),
    description: t("assets.description"),
    orderNo: t("assets.orderNo"),
    orderNoPlaceholder: t("assets.orderNoPlaceholder"),
    orderNoRequired: t("assets.orderNoRequired"),
    allStatuses: t("assets.allStatuses"),
    noAssets: t("assets.noAssets"),
    noRequests: t("assets.noRequests"),
    noCategory: t("assets.noCategory"),
    noUsageArea: t("assets.noUsageArea"),
    save: t("assets.save"),
    create: t("assets.create"),
    delete: t("assets.delete"),
    saving: t("assets.saving"),
    saved: t("assets.saved"),
    created: t("assets.created"),
    deleted: t("assets.deleted"),
    saveError: t("assets.saveError"),
    deleteError: t("assets.deleteError"),
    connectionError: t("assets.connectionError"),
    refresh: t("assets.refresh"),
    loading: t("assets.loading"),
    loadError: t("assets.loadError"),
    cancel: t("assets.cancel"),
    actions: t("assets.actions"),
    activate: t("assets.activate"),
    deactivate: t("assets.deactivate"),
    statusUpdated: t("assets.statusUpdated"),
    status_pending_approval: t("assets.statusPendingApproval"),
    status_approved: t("assets.statusApproved"),
    status_ordered: t("assets.statusOrdered"),
    status_delivered: t("assets.statusDelivered"),
    action_approved: t("assets.actionApprove"),
    action_ordered: t("assets.actionOrder"),
    action_delivered: t("assets.actionDeliver"),
  };

  return (
    <div className="mx-auto max-w-7xl">
      <AssetsManager
        initialAssets={assets.map(serializeAsset)}
        initialTotalValueCents={totalValueCents}
        initialRequests={requests.map(serializePurchaseRequest)}
        initialSummary={summary}
        suppliers={suppliers}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        labels={labels}
      />
    </div>
  );
}
