import { AiManager } from "@/components/ai/ai-manager";
import {
  hasPermission,
  requireModuleAccess,
} from "@/lib/auth/permissions";
import { t } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AiPage() {
  const { permissions } = await requireModuleAccess("ai");

  const canCreate = hasPermission(permissions, "ai", "create");
  const canEdit = hasPermission(permissions, "ai", "edit");

  const customers = await prisma.customer.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 200,
  });

  const ocrLabels: Record<string, string> = {
    uploadTitle: t("ai.uploadTitle"),
    uploadDesc: t("ai.uploadDesc"),
    channel: t("ai.channel"),
    customer: t("ai.customer"),
    selectCustomer: t("ai.selectCustomer"),
    fileUpload: t("ai.fileUpload"),
    pasteText: t("ai.pasteText"),
    pastePlaceholder: t("ai.pastePlaceholder"),
    parseText: t("ai.parseText"),
    previewTitle: t("ai.previewTitle"),
    textPreview: t("ai.textPreview"),
    validationTitle: t("ai.validationTitle"),
    validationDesc: t("ai.validationDesc"),
    quantityModeBox: t("ai.quantityModeBox"),
    quantityModeUnit: t("ai.quantityModeUnit"),
    reference: t("ai.reference"),
    detectedCustomer: t("ai.detectedCustomer"),
    paymentTerms: t("ai.paymentTerms"),
    total: t("ai.total"),
    sku: t("ai.sku"),
    internalSku: t("ai.internalSku"),
    boxes: t("ai.boxes"),
    units: t("ai.units"),
    unitsShort: t("ai.unitsShort"),
    unitPrice: t("ai.unitPrice"),
    lineTotal: t("ai.lineTotal"),
    confirmOrder: t("ai.confirmOrder"),
    sampleLoaded: t("ai.sampleLoaded"),
    parsed: t("ai.parsed"),
    parseError: t("ai.parseError"),
    loadError: t("ai.loadError"),
    connectionError: t("ai.connectionError"),
    customerRequired: t("ai.customerRequired"),
    skuUnresolved: t("ai.skuUnresolved"),
    confirmError: t("ai.confirmError"),
    orderCreated: t("ai.orderCreated"),
    channel_retail_form: t("orders.channelRetail"),
    channel_proposal: t("orders.channelCorporate"),
    channel_portal: t("orders.channelPortal"),
  };

  const gmailLabels: Record<string, string> = {
    tabGmail: t("ai.gmailTab"),
    tabOcr: t("ai.ocrTab"),
    connectionStatus: t("ai.gmailConnectionStatus"),
    connected: t("ai.gmailConnected"),
    notConnected: t("ai.gmailNotConnected"),
    demoMode: t("ai.gmailDemoMode"),
    demoHint: t("ai.gmailDemoHint"),
    pendingCount: t("ai.gmailPending"),
    processedCount: t("ai.gmailProcessed"),
    connectGmail: t("ai.gmailConnect"),
    syncInbox: t("ai.gmailSync"),
    syncDone: t("ai.gmailSyncDone"),
    ordersCreated: t("ai.gmailOrdersCreated"),
    failed: t("ai.gmailFailed"),
    inboxTitle: t("ai.gmailInboxTitle"),
    inboxDesc: t("ai.gmailInboxDesc"),
    noMessages: t("ai.gmailNoMessages"),
    linkedOrder: t("ai.gmailLinkedOrder"),
    draftOrder: t("ai.gmailDraftOrder"),
    unknownSender: t("ai.gmailUnknownSender"),
    demoBadge: t("ai.gmailDemoBadge"),
    refresh: t("ai.refresh"),
    loading: t("ai.loading"),
    loadError: t("ai.loadError"),
    connectionError: t("ai.connectionError"),
    connectError: t("ai.gmailConnectError"),
    syncError: t("ai.gmailSyncError"),
    status_pending: t("ai.gmailStatusPending"),
    status_processed: t("ai.gmailStatusProcessed"),
    status_failed: t("ai.gmailStatusFailed"),
    status_skipped: t("ai.gmailStatusSkipped"),
  };

  const recommendationLabels: Record<string, string> = {
    tabRecommendations: t("ai.recommendationsTab"),
    title: t("ai.recommendationsTitle"),
    desc: t("ai.recommendationsDesc"),
    period: t("ai.recommendationsPeriod"),
    totalCount: t("ai.recommendationsTotal"),
    anchor: t("ai.recommendationsAnchor"),
    filterAll: t("ai.recommendationsFilterAll"),
    reasoning: t("ai.recommendationsReasoning"),
    suggestedAction: t("ai.recommendationsAction"),
    viewModule: t("ai.recommendationsViewModule"),
    disclaimer: t("ai.recommendationsDisclaimer"),
    noItems: t("ai.recommendationsNoItems"),
    refresh: t("ai.refresh"),
    loading: t("ai.loading"),
    loadError: t("ai.loadError"),
    severity_high: t("ai.recommendationsSeverityHigh"),
    severity_medium: t("ai.recommendationsSeverityMedium"),
    severity_low: t("ai.recommendationsSeverityLow"),
    category_profitability: t("ai.recommendationsCategoryProfitability"),
    category_stock_level: t("ai.recommendationsCategoryStock"),
    category_purchase: t("ai.recommendationsCategoryPurchase"),
    category_demand_forecast: t("ai.recommendationsCategoryDemand"),
    category_anomaly: t("ai.recommendationsCategoryAnomaly"),
  };

  const qaLabels: Record<string, string> = {
    tabQa: t("ai.qaTab"),
    title: t("ai.qaTitle"),
    desc: t("ai.qaDesc"),
    placeholder: t("ai.qaPlaceholder"),
    ask: t("ai.qaAsk"),
    loading: t("ai.loading"),
    askError: t("ai.qaAskError"),
    sampleQuestions: t("ai.qaSamples"),
    answerTitle: t("ai.qaAnswerTitle"),
    intent: t("ai.qaIntent"),
    confidence: t("ai.qaConfidence"),
    primaryValue: t("ai.qaPrimaryValue"),
    sourcesTitle: t("ai.qaSourcesTitle"),
    viewModule: t("ai.recommendationsViewModule"),
    trySamples: t("ai.qaTrySamples"),
    historyTitle: t("ai.qaHistoryTitle"),
    disclaimer: t("ai.qaDisclaimer"),
  };

  return (
    <div className="mx-auto max-w-7xl">
      <AiManager
        customers={customers}
        canCreate={canCreate}
        canEdit={canEdit}
        ocrLabels={ocrLabels}
        gmailLabels={gmailLabels}
        recommendationLabels={recommendationLabels}
        qaLabels={qaLabels}
      />
    </div>
  );
}
