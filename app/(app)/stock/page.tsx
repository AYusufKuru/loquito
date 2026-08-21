import { StockManager } from "@/components/stock/stock-manager";
import {
  hasPermission,
  requireModuleAccess,
} from "@/lib/auth/permissions";
import { getStockPageData } from "@/lib/data/stock-page";
import { t } from "@/lib/i18n";
import { toMaterialRow } from "@/lib/stock/serialize";
import { toIsoString } from "@/lib/utils/datetime";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function StockPage() {
  const { permissions } = await requireModuleAccess("stock");

  const capabilities = {
    canCreate: hasPermission(permissions, "stock", "create"),
    canEdit: hasPermission(permissions, "stock", "edit"),
    canDelete: hasPermission(permissions, "stock", "delete"),
  };

  const {
    materials,
    suppliers,
    flavors,
    packagings,
    lots,
    movements,
    valuation,
    alerts,
    quarantineLotCount,
    finishedRows,
    finishedMatrix,
    finishedSummary,
    finishedReservations,
    separatedRows,
    reserveOrders,
  } = await getStockPageData();

  const flavorMap = Object.fromEntries(flavors.map((f) => [f.id, f.namePt]));
  const packagingMap = Object.fromEntries(packagings.map((p) => [p.id, p.label]));

  const summary = {
    totalValueCents: valuation.totalValueCents,
    availableValueCents: valuation.availableValueCents,
    materialCount: valuation.materialCount,
    alertCount: alerts.length,
    quarantineLotCount,
    alerts: alerts.map((a) => ({
      type: a.type,
      message: a.message,
      severity: a.severity,
    })),
  };

  const labels: Record<string, string> = {
    title: t("modules.stock.title"),
    description: t("modules.stock.description"),
    overviewTab: t("stock.overviewTab"),
    materialsTab: t("stock.materialsTabLabel"),
    lotsTab: t("stock.lotsTab"),
    movementsTab: t("stock.movementsTab"),
    materialsTitle: t("stock.materialsTitle"),
    records: t("stock.records"),
    rawTab: t("stock.rawTab"),
    packagingTab: t("stock.packagingTab"),
    searchPlaceholder: t("stock.searchPlaceholder"),
    colCode: t("stock.colCode"),
    colName: t("stock.colName"),
    colFlavorGram: t("stock.colFlavorGram"),
    colStock: t("stock.colStock"),
    colPrice: t("stock.colPrice"),
    colSupplier: t("stock.colSupplier"),
    dailySupply: t("stock.dailySupply"),
    inactive: t("stock.inactive"),
    lowStock: t("stock.lowStock"),
    noRecords: t("stock.noRecords"),
    newMaterial: t("stock.newMaterial"),
    selectMaterial: t("stock.selectMaterial"),
    formDesc: t("stock.formDesc"),
    subcategory: t("stock.subcategory"),
    unit: t("stock.unit"),
    criticalLevel: t("stock.criticalLevel"),
    noSupplier: t("stock.noSupplier"),
    flavorGramaj: t("stock.flavorGramaj"),
    flavor: t("stock.flavor"),
    gramaj: t("stock.gramaj"),
    selectFlavor: t("stock.selectFlavor"),
    selectGramaj: t("stock.selectGramaj"),
    notes: t("stock.notes"),
    dailySupplyFlag: t("stock.dailySupplyFlag"),
    active: t("stock.active"),
    save: t("stock.save"),
    create: t("stock.create"),
    saving: t("stock.saving"),
    delete: t("stock.delete"),
    created: t("stock.created"),
    saved: t("stock.saved"),
    deleted: t("stock.deleted"),
    deactivated: t("stock.deactivated"),
    saveError: t("stock.saveError"),
    deleteError: t("stock.deleteError"),
    connectionError: t("stock.connectionError"),
    totalValue: t("stock.totalValue"),
    availableValue: t("stock.availableValue"),
    materials: t("stock.materialsCount"),
    availableHint: t("stock.availableHint"),
    quarantineLots: t("stock.quarantineLots"),
    quarantineHint: t("stock.quarantineHint"),
    alerts: t("stock.alerts"),
    alertsHint: t("stock.alertsHint"),
    alertList: t("stock.alertList"),
    quarantine: t("stock.quarantine"),
    expiring: t("stock.expiring"),
    lotsTitle: t("stock.lotsTitle"),
    lotNo: t("stock.lotNo"),
    skt: t("stock.skt"),
    lotStatus: t("stock.lotStatus"),
    actions: t("stock.actions"),
    allStatuses: t("stock.allStatuses"),
    usable: t("stock.usable"),
    releaseLot: t("stock.releaseLot"),
    noLots: t("stock.noLots"),
    lotUpdated: t("stock.lotUpdated"),
    movementsTitle: t("stock.movementsTitle"),
    recentMovements: t("stock.recentMovements"),
    date: t("stock.date"),
    movementType: t("stock.movementType"),
    noMovements: t("stock.noMovements"),
    newMovement: t("stock.newMovement"),
    newMovementDesc: t("stock.newMovementDesc"),
    quantity: t("stock.quantity"),
    delta: t("stock.delta"),
    createLot: t("stock.createLot"),
    lotNoAuto: t("stock.lotNoAuto"),
    supplierLot: t("stock.supplierLot"),
    selectLot: t("stock.selectLot"),
    autoFifo: t("stock.autoFifo"),
    recordMovement: t("stock.recordMovement"),
    movementSaved: t("stock.movementSaved"),
    finishedTab: t("stock.finishedTab"),
    separatedTab: t("stock.separatedTab"),
    separatedTitle: t("stock.separatedTitle"),
    separatedDesc: t("stock.separatedDesc"),
    separatedListTitle: t("stock.separatedListTitle"),
    separatedEmpty: t("stock.separatedEmpty"),
    separateAction: t("stock.separateAction"),
    separating: t("stock.separating"),
    separatedOk: t("stock.separatedOk"),
    separateError: t("stock.separateError"),
    selectFinishedLot: t("stock.selectFinishedLot"),
    separateQty: t("stock.separateQty"),
    separateNotes: t("stock.separateNotes"),
    separateNotesPlaceholder: t("stock.separateNotesPlaceholder"),
    separatedDate: t("stock.separatedDate"),
    matrixTitle: t("stock.matrixTitle"),
    matrixDesc: t("stock.matrixDesc"),
    totalUnits: t("stock.totalUnits"),
    availableUnits: t("stock.availableUnits"),
    reservedUnits: t("stock.reservedUnits"),
    finishedValue: t("stock.finishedValue"),
    reservedShort: t("stock.reservedShort"),
    availableShort: t("stock.availableShort"),
    reserveTitle: t("stock.reserveTitle"),
    reserveDesc: t("stock.reserveDesc"),
    selectOrder: t("stock.selectOrder"),
    reserveForOrder: t("stock.reserveForOrder"),
    releaseReservation: t("stock.releaseReservation"),
    reservedOk: t("stock.reservedOk"),
    releasedOk: t("stock.releasedOk"),
    reserveError: t("stock.reserveError"),
    lotDetailTitle: t("stock.lotDetailTitle"),
    value: t("stock.value"),
    status: t("stock.status"),
    reservationsTitle: t("stock.reservationsTitle"),
    noReservations: t("stock.noReservations"),
    orderNo: t("stock.orderNo"),
    product: t("stock.product"),
    purchaseOrdersTab: t("stock.purchaseOrdersTab"),
    poTitle: t("stock.poTitle"),
    poDesc: t("stock.poDesc"),
    poNew: t("stock.poNew"),
    poNewDesc: t("stock.poNewDesc"),
    poOrderNo: t("stock.poOrderNo"),
    poTotal: t("stock.poTotal"),
    poItems: t("stock.poItems"),
    poNoOrders: t("stock.poNoOrders"),
    poExpectedDate: t("stock.poExpectedDate"),
    poLines: t("stock.poLines"),
    poAddLine: t("stock.poAddLine"),
    poNotesPlaceholder: t("stock.poNotesPlaceholder"),
    poCreate: t("stock.poCreate"),
    poCreated: t("stock.poCreated"),
    poStatusUpdated: t("stock.poStatusUpdated"),
    poReceivedOk: t("stock.poReceivedOk"),
    poReceiveTitle: t("stock.poReceiveTitle"),
    poReceiveDesc: t("stock.poReceiveDesc"),
    poReceive: t("stock.poReceive"),
    poReceived: t("stock.poReceived"),
    loadError: t("stock.loadError"),
    poStatus_pending: t("stock.poStatus_pending"),
    poStatus_ordered: t("stock.poStatus_ordered"),
    poStatus_partial: t("stock.poStatus_partial"),
    poStatus_received: t("stock.poStatus_received"),
    poStatus_cancelled: t("stock.poStatus_cancelled"),
    poAction_ordered: t("stock.poAction_ordered"),
    poAction_cancelled: t("stock.poAction_cancelled"),
  };

  return (
    <StockManager
      materials={materials.map((m) =>
        toMaterialRow(
          m,
          m.flavorId ? flavorMap[m.flavorId] : null,
          m.packagingId ? packagingMap[m.packagingId] : null,
        ),
      )}
      lots={lots.map((lot) => ({
        id: lot.id,
        materialId: lot.materialId,
        materialCode: lot.material.code,
        materialName: lot.material.name,
        materialUnit: lot.material.unit,
        internalLotNo: lot.internalLotNo,
        supplierLotNo: lot.supplierLotNo,
        quantity: lot.quantity,
        expiryDate: toIsoString(lot.expiryDate),
        status: lot.status,
        receivedAt: toIsoString(lot.receivedAt) ?? "",
        notes: lot.notes,
        isUsable: lot.status === "released",
      }))}
      movements={movements.map((m) => ({
        id: m.id,
        materialId: m.materialId,
        materialCode: m.material.code,
        materialName: m.material.name,
        materialUnit: m.material.unit,
        lotId: m.lotId,
        internalLotNo: m.lot?.internalLotNo ?? null,
        type: m.type,
        quantity: m.quantity,
        notes: m.notes,
        createdAt: toIsoString(m.createdAt) ?? "",
      }))}
      summary={summary}
      suppliers={suppliers}
      flavors={flavors.map((f) => ({
        id: f.id,
        code: f.code,
        name: f.namePt,
      }))}
      packagings={packagings}
      capabilities={capabilities}
      finishedRows={finishedRows}
      finishedMatrix={finishedMatrix}
      finishedSummary={finishedSummary}
      finishedReservations={finishedReservations}
      separatedRows={separatedRows}
      reserveOrders={reserveOrders.map((o) => ({
        id: o.id,
        orderNo: o.orderNo,
        customerName: o.customer.name,
        status: o.status,
      }))}
      labels={labels}
    />
  );
}
