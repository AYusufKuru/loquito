import { ProductionManager } from "@/components/production/production-manager";
import {
  hasPermission,
  requireModuleAccess,
} from "@/lib/auth/permissions";
import { getProductionPageData } from "@/lib/data/production-page";
import { t } from "@/lib/i18n";
import { serializeProductionOrder } from "@/lib/production/serialize";
import { toDateOnlyString } from "@/lib/utils/datetime";

export const revalidate = 20;

export default async function ProductionPage() {
  const { permissions } = await requireModuleAccess("production");

  const canEdit = hasPermission(permissions, "production", "edit");

  const { planOrders, productionOrders, lines } = await getProductionPageData();

  const labels: Record<string, string> = {
    title: t("modules.production.title"),
    description: t("production.pageDesc"),
    pageIntro: t("production.pageIntro"),
    workflowOrder: t("production.workflowOrder"),
    workflowOrderDesc: t("production.workflowOrderDesc"),
    workflowCreate: t("production.workflowCreate"),
    workflowCreateDesc: t("production.workflowCreateDesc"),
    workflowRun: t("production.workflowRun"),
    workflowRunDesc: t("production.workflowRunDesc"),
    workflowClose: t("production.workflowClose"),
    workflowCloseDesc: t("production.workflowCloseDesc"),
    ordersTabDesc: t("production.ordersTabDesc"),
    liveTabDesc: t("production.liveTabDesc"),
    planningTabDesc: t("production.planningTabDesc"),
    kanbanEmpty: t("production.kanbanEmpty"),
    selectOrderHint: t("production.selectOrderHint"),
    stepPlanned: t("production.stepPlanned"),
    stepInProgress: t("production.stepInProgress"),
    stepCompleted: t("production.stepCompleted"),
    actionStart: t("production.actionStart"),
    actionStartDesc: t("production.actionStartDesc"),
    actionTrack: t("production.actionTrack"),
    actionTrackDesc: t("production.actionTrackDesc"),
    actionClose: t("production.actionClose"),
    actionCloseDesc: t("production.actionCloseDesc"),
    ordersTab: t("production.ordersTab"),
    planningTab: t("production.planningTab"),
    planParams: t("production.planParams"),
    planParamsDesc: t("production.planParamsDesc"),
    selectOrder: t("production.selectOrder"),
    noOrders: t("production.noOrders"),
    planStartDate: t("production.planStartDate"),
    scenarioBoxes: t("production.scenarioBoxes"),
    scenarioGrammage: t("production.scenarioGrammage"),
    refreshPlan: t("production.refreshPlan"),
    runScenario: t("production.runScenario"),
    loadingPlan: t("production.loadingPlan"),
    planError: t("production.planError"),
    connectionError: t("production.connectionError"),
    estimatedCompletion: t("production.estimatedCompletion"),
    totalWorkDays: t("production.totalWorkDays"),
    totalBatches: t("production.totalBatches"),
    totalBoxes: t("production.totalBoxes"),
    requestedDelivery: t("production.requestedDelivery"),
    meetsDelivery: t("production.meetsDelivery"),
    missesDelivery: t("production.missesDelivery"),
    timelineTitle: t("production.timelineTitle"),
    cookingDays: t("production.cookingDays"),
    cuttingDays: t("production.cuttingDays"),
    potCount: t("production.potCount"),
    date: t("production.date"),
    workDay: t("production.workDay"),
    cookingBatches: t("production.cookingBatches"),
    cuttingBoxes: t("production.cuttingBoxes"),
    cumulativeCut: t("production.cumulativeCut"),
    lineCapacity: t("production.lineCapacity"),
    product: t("production.product"),
    grammage: t("production.grammage"),
    toProduce: t("production.toProduce"),
    batches: t("production.batches"),
    dailyCapacity: t("production.dailyCapacity"),
    orderDetail: t("production.orderDetail"),
    orderDetailDesc: t("production.orderDetailDesc"),
    loading: t("production.loading"),
    loadError: t("production.loadError"),
    salesOrder: t("production.salesOrder"),
    plannedKg: t("production.plannedKg"),
    line: t("production.line"),
    unassigned: t("production.unassigned"),
    assignCooker: t("production.assignCooker"),
    startProduction: t("production.startProduction"),
    started: t("production.started"),
    startError: t("production.startError"),
    completeSection: t("production.completeSection"),
    producedUnits: t("production.producedUnits"),
    producedKg: t("production.producedKg"),
    scrapKg: t("production.scrapKg"),
    yieldPercent: t("production.yieldPercent"),
    material: t("production.material"),
    availableQty: t("orders.availableQty"),
    plannedQty: t("production.plannedQty"),
    actualQty: t("production.actualQty"),
    lot: t("production.lot"),
    autoLot: t("production.autoLot"),
    closeBatch: t("production.closeBatch"),
    completed: t("production.completed"),
    completeError: t("production.completeError"),
    createFromOrder: t("production.createFromOrder"),
    creatingOrders: t("production.creatingOrders"),
    ordersCreated: t("production.ordersCreated"),
    createOrdersError: t("production.createOrdersError"),
    liveTab: t("production.liveTab"),
    liveDesc: t("production.liveDesc"),
    liveError: t("production.liveError"),
    loadingLive: t("production.loadingLive"),
    refreshLive: t("production.refreshLive"),
    cookerCards: t("production.cookerCards"),
    noActiveOrder: t("production.noActiveOrder"),
    downtimeActive: t("production.downtimeActive"),
    downtimeStart: t("production.downtimeStart"),
    downtimeEnd: t("production.downtimeEnd"),
    downtimeReason: t("production.downtimeReason"),
    downtimeReasonPlaceholder: t("production.downtimeReasonPlaceholder"),
    downtimeError: t("production.downtimeError"),
    dailyOutput: t("production.dailyOutput"),
    teamMembers: t("production.teamMembers"),
    ofTarget: t("production.ofTarget"),
    unitPieceShort: t("orders.unitPieceShort"),
    controlPanel: t("production.controlPanel"),
    currentKg: t("production.currentKg"),
    progressPercent: t("production.progressPercent"),
    producedUnitsToday: t("production.producedUnitsToday"),
    operator: t("production.operator"),
    advanceStage: t("production.advanceStage"),
    advanceTo: t("production.advanceTo"),
    currentStage: t("production.currentStage"),
    nextStageLabel: t("production.nextStageLabel"),
    stageCount: t("production.stageCount"),
    finishBatchHint: t("production.finishBatchHint"),
    scrapEntry: t("production.scrapEntry"),
    recordScrap: t("production.recordScrap"),
    qualityCheck: t("production.qualityCheck"),
    qualityParam: t("production.qualityParam"),
    qualityActual: t("production.qualityActual"),
    saveQuality: t("production.saveQuality"),
    updateError: t("production.updateError"),
  };

  return (
    <div className="mx-auto max-w-7xl">
      <ProductionManager
        planOrders={planOrders.map((o) => ({
          id: o.id,
          orderNo: o.orderNo,
          customerName: o.customer.name,
          status: o.status,
          deliveryDate: toDateOnlyString(o.deliveryDate),
        }))}
        productionOrders={productionOrders.map(serializeProductionOrder)}
        lines={lines}
        canEdit={canEdit}
        labels={labels}
      />
    </div>
  );
}
