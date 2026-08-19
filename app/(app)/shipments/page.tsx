import { ShipmentsSection } from "@/components/shipments/shipments-section";
import {
  hasPermission,
  requireModuleAccess,
} from "@/lib/auth/permissions";
import { t } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { serializeShipment } from "@/lib/shipments/serialize";
import { listShipments, listShippableOrders } from "@/lib/shipments/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function ShipmentsPage() {
  const { permissions } = await requireModuleAccess("shipments");

  const canCreate = hasPermission(permissions, "shipments", "create");
  const canEdit = hasPermission(permissions, "shipments", "edit");
  const canDelete = hasPermission(permissions, "shipments", "delete");

  const [shipments, shippableOrders] = await Promise.all([
    listShipments(prisma),
    listShippableOrders(prisma),
  ]);

  const labels: Record<string, string> = {
    title: t("modules.shipments.title"),
    description: t("shipments.pageDesc"),
    listTitle: t("shipments.listTitle"),
    newShipment: t("shipments.newShipment"),
    selectOrder: t("shipments.selectOrder"),
    noOrders: t("shipments.noOrders"),
    shipmentNo: t("shipments.shipmentNo"),
    status: t("shipments.status"),
    customer: t("shipments.customer"),
    orderNo: t("shipments.orderNo"),
    plannedShipDate: t("shipments.plannedShipDate"),
    plannedDelivery: t("shipments.plannedDelivery"),
    actualShipDate: t("shipments.actualShipDate"),
    actualDelivery: t("shipments.actualDelivery"),
    carrierName: t("shipments.carrierName"),
    driverName: t("shipments.driverName"),
    vehiclePlate: t("shipments.vehiclePlate"),
    trackingNo: t("shipments.trackingNo"),
    palletCount: t("shipments.palletCount"),
    sealNo: t("shipments.sealNo"),
    receivedBy: t("shipments.receivedBy"),
    proofNo: t("shipments.proofNo"),
    checklistTitle: t("shipments.checklistTitle"),
    checklistComplete: t("shipments.checklistComplete"),
    checklistIncomplete: t("shipments.checklistIncomplete"),
    issueTitle: t("shipments.issueTitle"),
    issueShortage: t("shipments.issueShortage"),
    issueDamage: t("shipments.issueDamage"),
    issueReturn: t("shipments.issueReturn"),
    issueNotes: t("shipments.issueNotes"),
    partialShipTitle: t("shipments.partialShipTitle"),
    partialShipDesc: t("shipments.partialShipDesc"),
    orderedUnits: t("shipments.orderedUnits"),
    shippedUnits: t("shipments.shippedUnits"),
    remainingUnits: t("shipments.remainingUnits"),
    shipBoxes: t("shipments.shipBoxes"),
    shipUnits: t("shipments.shipUnits"),
    lotNo: t("shipments.lotNo"),
    createShipment: t("shipments.createShipment"),
    creating: t("shipments.creating"),
    created: t("shipments.created"),
    createError: t("shipments.createError"),
    dispatch: t("shipments.dispatch"),
    dispatching: t("shipments.dispatching"),
    dispatched: t("shipments.dispatched"),
    dispatchError: t("shipments.dispatchError"),
    saveChecklist: t("shipments.saveChecklist"),
    saveCarrier: t("shipments.saveCarrier"),
    markDelivered: t("shipments.markDelivered"),
    markIssue: t("shipments.markIssue"),
    saved: t("shipments.saved"),
    saveError: t("shipments.saveError"),
    loading: t("shipments.loading"),
    loadError: t("shipments.loadError"),
    connectionError: t("shipments.connectionError"),
    noShipments: t("shipments.noShipments"),
    detailTitle: t("shipments.detailTitle"),
    progressTitle: t("shipments.progressTitle"),
    fullyShipped: t("shipments.fullyShipped"),
    partiallyShipped: t("shipments.partiallyShipped"),
    product: t("shipments.product"),
    notes: t("shipments.notes"),
    refresh: t("shipments.refresh"),
    delete: t("shipments.delete"),
    deleteConfirm: t("shipments.deleteConfirm"),
    deleted: t("shipments.deleted"),
    deleteError: t("shipments.deleteError"),
    checkStockReserved: t("shipments.checkStockReserved"),
    checkLotExpiry: t("shipments.checkLotExpiry"),
    checkLabels: t("shipments.checkLabels"),
    checkQuantities: t("shipments.checkQuantities"),
    checkBoxCount: t("shipments.checkBoxCount"),
    checkDocuments: t("shipments.checkDocuments"),
    checkDamage: t("shipments.checkDamage"),
  };

  return (
    <div className="mx-auto max-w-7xl">
      <ShipmentsSection
          initialShipments={shipments.map(serializeShipment)}
          shippableOrders={shippableOrders.map((o) => ({
            id: o.id,
            orderNo: o.orderNo,
            customerName: o.customer.name,
            status: o.status,
            deliveryDate: o.deliveryDate
              ? o.deliveryDate.toISOString().slice(0, 10)
              : null,
          }))}
          canCreate={canCreate}
          canEdit={canEdit}
          canDelete={canDelete}
          labels={labels}
        />
    </div>
  );
}
