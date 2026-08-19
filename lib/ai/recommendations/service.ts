import type { PrismaClient } from "@prisma/client";

import { cachedQuery, REVALIDATE } from "@/lib/cache/server";
import {
  FIXED_EXPENSE_DEMO_MONTH,
  parsePeriodMonth,
} from "@/lib/finance/constants";
import {
  ACTIVE_ORDER_STATUSES,
  PIPELINE_ORDER_STATUSES,
} from "@/lib/orders/constants";
import { buildProfitabilityReport } from "@/lib/reports/profitability";
import { buildScrapReport } from "@/lib/reports/scrap";
import { formatBrlFromCents } from "@/lib/stock/constants";
import { getAvailableQtyMap } from "@/lib/stock/inventory";

import type {
  AiRecommendation,
  AiRecommendationsReport,
  RecommendationCategory,
} from "./types";

type Db = PrismaClient;

const LEAD_TIME_DAYS = 7;
const SAFETY_STOCK_FACTOR = 2;
const LOW_MARGIN_THRESHOLD = 18;
const HIGH_MARGIN_THRESHOLD = 35;
const SCRAP_SPIKE_RATIO = 1.4;
const YIELD_WARNING_PERCENT = 88;

function demoAnchorDate(): Date {
  const parsed = parsePeriodMonth(FIXED_EXPENSE_DEMO_MONTH);
  if (parsed) return parsed.end;
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
}

function daysBefore(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

function marginLabel(percent: number): string {
  return `${percent.toFixed(1)}%`;
}

function severityRank(s: AiRecommendation["severity"]): number {
  if (s === "high") return 3;
  if (s === "medium") return 2;
  return 1;
}

function countByCategory(items: AiRecommendation[]): Record<RecommendationCategory, number> {
  const base: Record<RecommendationCategory, number> = {
    profitability: 0,
    stock_level: 0,
    purchase: 0,
    demand_forecast: 0,
    anomaly: 0,
  };
  for (const item of items) {
    base[item.category] += 1;
  }
  return base;
}

async function buildProfitabilityRecommendations(
  db: Db,
): Promise<AiRecommendation[]> {
  const parsed = parsePeriodMonth(FIXED_EXPENSE_DEMO_MONTH);
  if (!parsed) return [];

  const flavorReport = await buildProfitabilityReport(db, {
    start: parsed.start,
    end: parsed.end,
    label: FIXED_EXPENSE_DEMO_MONTH,
  }, "flavor");

  const customerReport = await buildProfitabilityReport(db, {
    start: parsed.start,
    end: parsed.end,
    label: FIXED_EXPENSE_DEMO_MONTH,
  }, "customer");

  const items: AiRecommendation[] = [];

  const lowMarginFlavors = flavorReport.rows
    .filter((r) => r.revenueCents > 0 && r.marginPercent < LOW_MARGIN_THRESHOLD)
    .sort((a, b) => a.marginPercent - b.marginPercent);

  for (const row of lowMarginFlavors.slice(0, 3)) {
    items.push({
      id: `profit-flavor-${row.groupKey}`,
      category: "profitability",
      severity: row.marginPercent < 10 ? "high" : "medium",
      title: `${row.groupLabel}: düşük kâr marjı`,
      summary: `${FIXED_EXPENSE_DEMO_MONTH} döneminde marj ${marginLabel(row.marginPercent)}; gelir ${formatBrlFromCents(row.revenueCents)}.`,
      reasoning: [
        `${row.orderCount} sipariş kalemi bu lezzet grubunda toplandı.`,
        `Üretim maliyeti ${formatBrlFromCents(row.productionCostCents)}; beklenen kâr ${formatBrlFromCents(row.profitCents)}.`,
        `Hedef marj (${LOW_MARGIN_THRESHOLD}%) altında; fiyat, iskonto veya reçete maliyeti gözden geçirilmeli.`,
      ],
      metrics: [
        { label: "Marj", value: marginLabel(row.marginPercent) },
        { label: "Gelir", value: formatBrlFromCents(row.revenueCents) },
        { label: "Kâr", value: formatBrlFromCents(row.profitCents) },
      ],
      suggestedAction: "Raporlarda lezzet kırılımını inceleyin; fiyat kademesi veya malzeme maliyetini güncelleyin.",
      href: "/reports",
    });
  }

  const topFlavor = [...flavorReport.rows]
    .filter((r) => r.revenueCents > 0)
    .sort((a, b) => b.marginPercent - a.marginPercent)[0];

  if (topFlavor && topFlavor.marginPercent >= HIGH_MARGIN_THRESHOLD) {
    items.push({
      id: `profit-top-flavor-${topFlavor.groupKey}`,
      category: "profitability",
      severity: "low",
      title: `${topFlavor.groupLabel}: yüksek kârlılık`,
      summary: `En yüksek marjlı lezzet grubu (${marginLabel(topFlavor.marginPercent)}); kapasite ve stok önceliği değerlendirilebilir.`,
      reasoning: [
        `${FIXED_EXPENSE_DEMO_MONTH} döneminde gelir ${formatBrlFromCents(topFlavor.revenueCents)}.`,
        `Beklenen kâr ${formatBrlFromCents(topFlavor.profitCents)}; üretim maliyeti ${formatBrlFromCents(topFlavor.productionCostCents)}.`,
        "Talep artışı senaryosunda bu lezzete mamul stok ve üretim planı ayrılabilir.",
      ],
      metrics: [
        { label: "Marj", value: marginLabel(topFlavor.marginPercent) },
        { label: "Sipariş", value: String(topFlavor.orderCount) },
      ],
      suggestedAction: "Mamul stok ve üretim planında bu lezzeti önceliklendirin.",
      href: "/reports",
    });
  }

  const weakCustomer = customerReport.rows
    .filter((r) => r.revenueCents > 0 && r.profitCents < 0)
    .sort((a, b) => a.profitCents - b.profitCents)[0];

  if (weakCustomer) {
    items.push({
      id: `profit-customer-${weakCustomer.groupKey}`,
      category: "profitability",
      severity: "high",
      title: `${weakCustomer.groupLabel}: negatif kâr`,
      summary: `Müşteri bazında beklenen kâr ${formatBrlFromCents(weakCustomer.profitCents)}; marj ${marginLabel(weakCustomer.marginPercent)}.`,
      reasoning: [
        `Dönem geliri ${formatBrlFromCents(weakCustomer.revenueCents)}; üretim maliyeti geliri üzerinde.`,
        `${weakCustomer.orderCount} sipariş bu müşteriye bağlı.`,
        "Navlun, iskonto veya özel reçete maliyeti kârlılığı baskılıyor olabilir.",
      ],
      metrics: [
        { label: "Kâr", value: formatBrlFromCents(weakCustomer.profitCents) },
        { label: "Gelir", value: formatBrlFromCents(weakCustomer.revenueCents) },
      ],
      suggestedAction: "Müşteri fiyat kademesi ve navlun koşullarını gözden geçirin.",
      href: "/reports",
    });
  }

  if (flavorReport.summary.marginPercent > 0) {
    items.push({
      id: "profit-summary",
      category: "profitability",
      severity: "low",
      title: "Dönem kârlılık özeti",
      summary: `${FIXED_EXPENSE_DEMO_MONTH}: genel marj ${marginLabel(flavorReport.summary.marginPercent)}, net kâr ${formatBrlFromCents(flavorReport.summary.profitCents)}.`,
      reasoning: [
        `Toplam gelir ${formatBrlFromCents(flavorReport.summary.revenueCents)}.`,
        `Üretim maliyeti ${formatBrlFromCents(flavorReport.summary.productionCostCents)}; fire tahmini ${formatBrlFromCents(flavorReport.summary.scrapCostCents)}.`,
        `${flavorReport.summary.orderCount} aktif sipariş analize dahil edildi.`,
      ],
      metrics: [
        { label: "Marj", value: marginLabel(flavorReport.summary.marginPercent) },
        { label: "Kâr", value: formatBrlFromCents(flavorReport.summary.profitCents) },
      ],
      href: "/reports",
    });
  }

  return items;
}

async function buildStockAndPurchaseRecommendations(db: Db): Promise<AiRecommendation[]> {
  const materials = await db.material.findMany({
    where: { isActive: true, isDailySupply: false, criticalLevel: { gt: 0 } },
    include: { supplier: { select: { id: true, name: true } } },
    orderBy: { code: "asc" },
  });

  const stockItems: AiRecommendation[] = [];
  const purchaseItems: AiRecommendation[] = [];

  const availableQtyMap = await getAvailableQtyMap(
    db,
    materials.map((m) => m.id),
  );

  for (const material of materials) {
    const available = availableQtyMap.get(material.id) ?? 0;
    const onHand = material.currentQty;
    const critical = material.criticalLevel;
    const targetLevel = Math.ceil(critical * SAFETY_STOCK_FACTOR);
    const coverageRatio = critical > 0 ? onHand / critical : 1;

    if (onHand > critical * 1.25) continue;

    const severity: AiRecommendation["severity"] =
      onHand <= critical ? "high" : "medium";

    stockItems.push({
      id: `stock-${material.id}`,
      category: "stock_level",
      severity,
      title: `${material.name}: stok hedefi altında`,
      summary: `Mevcut ${onHand} ${material.unit}; kritik ${critical} ${material.unit}; önerilen hedef ${targetLevel} ${material.unit}.`,
      reasoning: [
        `Kullanılabilir lot stoğu: ${available} ${material.unit}.`,
        `Emniyet stoğu = kritik seviye × ${SAFETY_STOCK_FACTOR} (${targetLevel} ${material.unit}).`,
        `Tedarik süresi varsayımı: ${LEAD_TIME_DAYS} gün; sipariş yükü ve üretim planı bu hedefe göre hesaplandı.`,
      ],
      metrics: [
        { label: "Mevcut", value: `${onHand} ${material.unit}` },
        { label: "Kritik", value: `${critical} ${material.unit}` },
        { label: "Hedef", value: `${targetLevel} ${material.unit}` },
        { label: "Kapsama", value: `${(coverageRatio * 100).toFixed(0)}%` },
      ],
      suggestedAction: `Stok seviyesini en az ${targetLevel} ${material.unit} hedefine çıkarın.`,
      href: "/stock",
    });

    const reorderQty = Math.max(0, Math.ceil(targetLevel - onHand));
    if (reorderQty <= 0 || !material.supplierId) continue;

    const unitPrice = material.unitPriceCents;
    const estimatedCents = Math.round(reorderQty * unitPrice);

    purchaseItems.push({
      id: `purchase-${material.id}`,
      category: "purchase",
      severity,
      title: `${material.name}: satın alma önerisi`,
      summary: `${reorderQty} ${material.unit} sipariş; tahmini tutar ${formatBrlFromCents(estimatedCents)}.`,
      reasoning: [
        `Tedarikçi: ${material.supplier?.name ?? "Tanımsız"}.`,
        `Birim fiyat kartı: ${formatBrlFromCents(unitPrice)}/${material.unit}.`,
        `Hedef stok ${targetLevel} ${material.unit}; mevcut ${onHand} ${material.unit} → önerilen sipariş ${reorderQty} ${material.unit}.`,
      ],
      metrics: [
        { label: "Miktar", value: `${reorderQty} ${material.unit}` },
        { label: "Tahmini tutar", value: formatBrlFromCents(estimatedCents) },
        { label: "Tedarikçi", value: material.supplier?.name ?? "—" },
      ],
      suggestedAction: "Satın alma siparişi oluşturun veya tedarikçiyle iletişime geçin.",
      href: "/stock",
    });
  }

  return [...stockItems, ...purchaseItems];
}

async function buildDemandForecastRecommendations(
  db: Db,
  anchor: Date,
): Promise<AiRecommendation[]> {
  const currentStart = parsePeriodMonth(FIXED_EXPENSE_DEMO_MONTH)?.start ?? daysBefore(anchor, 30);
  const currentEnd = parsePeriodMonth(FIXED_EXPENSE_DEMO_MONTH)?.end ?? anchor;
  const prevEnd = new Date(currentStart);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setMonth(prevStart.getMonth() - 1);
  prevStart.setDate(1);

  const flavorTotals = new Map<
    string,
    { label: string; currentUnits: number; previousUnits: number; pipelineUnits: number }
  >();

  const ordersCurrent = await db.order.findMany({
    where: {
      status: { in: [...ACTIVE_ORDER_STATUSES] },
      orderDate: { gte: currentStart, lte: currentEnd },
    },
    include: {
      items: { include: { product: { include: { flavor: true } } } },
    },
  });

  const ordersPrevious = await db.order.findMany({
    where: {
      status: { in: [...ACTIVE_ORDER_STATUSES] },
      orderDate: { gte: prevStart, lte: prevEnd },
    },
    include: {
      items: { include: { product: { include: { flavor: true } } } },
    },
  });

  const pipelineOrders = await db.order.findMany({
    where: { status: { in: [...PIPELINE_ORDER_STATUSES] } },
    include: {
      items: { include: { product: { include: { flavor: true } } } },
    },
  });

  function addUnits(
    map: Map<string, { label: string; units: number }>,
    flavorId: string,
    label: string,
    units: number,
  ) {
    const row = map.get(flavorId) ?? { label, units: 0 };
    row.units += units;
    map.set(flavorId, row);
  }

  const currentMap = new Map<string, { label: string; units: number }>();
  const previousMap = new Map<string, { label: string; units: number }>();
  const pipelineMap = new Map<string, { label: string; units: number }>();

  for (const order of ordersCurrent) {
    for (const item of order.items) {
      const flavor = item.product?.flavor;
      const key = flavor?.id ?? "unknown";
      const label = flavor?.nameTr ?? flavor?.namePt ?? "Bilinmeyen";
      addUnits(currentMap, key, label, item.quantityUnits);
    }
  }

  for (const order of ordersPrevious) {
    for (const item of order.items) {
      const flavor = item.product?.flavor;
      const key = flavor?.id ?? "unknown";
      const label = flavor?.nameTr ?? flavor?.namePt ?? "Bilinmeyen";
      addUnits(previousMap, key, label, item.quantityUnits);
    }
  }

  for (const order of pipelineOrders) {
    for (const item of order.items) {
      const flavor = item.product?.flavor;
      const key = flavor?.id ?? "unknown";
      const label = flavor?.nameTr ?? flavor?.namePt ?? "Bilinmeyen";
      addUnits(pipelineMap, key, label, item.quantityUnits);
    }
  }

  const allKeys = new Set([
    ...currentMap.keys(),
    ...previousMap.keys(),
    ...pipelineMap.keys(),
  ]);

  for (const key of allKeys) {
    const current = currentMap.get(key)?.units ?? 0;
    const previous = previousMap.get(key)?.units ?? 0;
    const pipeline = pipelineMap.get(key)?.units ?? 0;
    const label =
      currentMap.get(key)?.label ??
      previousMap.get(key)?.label ??
      pipelineMap.get(key)?.label ??
      "Bilinmeyen";
    flavorTotals.set(key, {
      label,
      currentUnits: current,
      previousUnits: previous,
      pipelineUnits: pipeline,
    });
  }

  const items: AiRecommendation[] = [];

  for (const [key, row] of flavorTotals) {
    if (row.currentUnits === 0 && row.pipelineUnits === 0) continue;

    const changePct =
      row.previousUnits > 0
        ? Math.round(((row.currentUnits - row.previousUnits) / row.previousUnits) * 100)
        : row.currentUnits > 0
          ? 100
          : 0;

    const trend =
      changePct > 15 ? "artış" : changePct < -15 ? "düşüş" : "stabil";

    if (row.pipelineUnits > 0 || Math.abs(changePct) >= 15) {
      items.push({
        id: `demand-${key}`,
        category: "demand_forecast",
        severity:
          row.pipelineUnits > 200 || changePct > 40
            ? "high"
            : changePct > 15 || row.pipelineUnits > 50
              ? "medium"
              : "low",
        title: `${row.label}: talep tahmini`,
        summary: `${FIXED_EXPENSE_DEMO_MONTH}: ${row.currentUnits} adet; önceki ay ${row.previousUnits} adet (${changePct >= 0 ? "+" : ""}${changePct}%). Pipeline: ${row.pipelineUnits} adet.`,
        reasoning: [
          `Mevcut dönem sipariş adedi: ${row.currentUnits} (onaylı ve aktif siparişler).`,
          `Önceki ay karşılaştırması: ${row.previousUnits} adet → trend ${trend}.`,
          `Üretim pipeline'ında (onay bekleyen / üretimde / sevke hazır): ${row.pipelineUnits} adet rezerve talep.`,
        ],
        metrics: [
          { label: "Bu dönem", value: `${row.currentUnits} adet` },
          { label: "Önceki ay", value: `${row.previousUnits} adet` },
          { label: "Pipeline", value: `${row.pipelineUnits} adet` },
          { label: "Değişim", value: `${changePct}%` },
        ],
        suggestedAction:
          trend === "artış"
            ? "Mamul stok ve hammadde planını talep artışına göre güncelleyin."
            : "Üretim planında kapasite boşluğu değerlendirilebilir.",
        href: "/orders",
      });
    }
  }

  if (items.length === 0 && pipelineMap.size > 0) {
    let totalPipeline = 0;
    for (const [, v] of pipelineMap) totalPipeline += v.units;
    items.push({
      id: "demand-pipeline-total",
      category: "demand_forecast",
      severity: "medium",
      title: "Açık sipariş pipeline özeti",
      summary: `Üretim öncesi ${totalPipeline} adet mamul talebi bekliyor.`,
      reasoning: [
        `${pipelineOrders.length} sipariş onay / üretim / sevkiyat aşamasında.`,
        "Dönem karşılaştırması için yeterli geçmiş sipariş verisi sınırlı; pipeline verisi kullanıldı.",
      ],
      metrics: [{ label: "Pipeline adet", value: String(totalPipeline) }],
      suggestedAction: "Üretim planı ve mamul stok rezervasyonlarını kontrol edin.",
      href: "/orders",
    });
  }

  return items;
}

async function buildAnomalyRecommendations(
  db: Db,
  anchor: Date,
): Promise<AiRecommendation[]> {
  const items: AiRecommendation[] = [];

  const recentStart = daysBefore(anchor, 30);
  const priorStart = daysBefore(anchor, 60);

  const recentScrap = await buildScrapReport(db, {
    start: recentStart,
    end: anchor,
    label: "Son 30 gün",
  });
  const priorScrap = await buildScrapReport(db, {
    start: priorStart,
    end: recentStart,
    label: "Önceki 30 gün",
  });

  if (
    recentScrap.totalKg > 0 &&
    priorScrap.totalKg > 0 &&
    recentScrap.totalKg >= priorScrap.totalKg * SCRAP_SPIKE_RATIO
  ) {
    const ratio = (recentScrap.totalKg / priorScrap.totalKg).toFixed(1);
    items.push({
      id: "anomaly-scrap-spike",
      category: "anomaly",
      severity: "high",
      title: "Fire artışı tespit edildi",
      summary: `Son 30 günde ${recentScrap.totalKg.toFixed(1)} kg fire; önceki dönem ${priorScrap.totalKg.toFixed(1)} kg (${ratio}×).`,
      reasoning: [
        `Tahmini fire maliyeti: ${formatBrlFromCents(recentScrap.totalCostCents)}.`,
        `Önceki dönem maliyet: ${formatBrlFromCents(priorScrap.totalCostCents)}.`,
        "Pişirme, kesim veya paketleme aşamasında verim düşüşü olabilir.",
      ],
      metrics: [
        { label: "Fire (kg)", value: recentScrap.totalKg.toFixed(1) },
        { label: "Maliyet", value: formatBrlFromCents(recentScrap.totalCostCents) },
      ],
      suggestedAction: "Üretim emirlerinde fire nedenlerini ve hat verimini inceleyin.",
      href: "/production",
    });
  }

  if (recentScrap.totalKg > 0 && priorScrap.totalKg === 0) {
    items.push({
      id: "anomaly-scrap-new",
      category: "anomaly",
      severity: "medium",
      title: "Yeni fire kayıtları",
      summary: `Son 30 günde ${recentScrap.totalKg.toFixed(1)} kg fire kaydedildi.`,
      reasoning: [
        `Tahmini maliyet ${formatBrlFromCents(recentScrap.totalCostCents)}.`,
        `${recentScrap.rows.length} fire kaydı oluşturuldu.`,
      ],
      metrics: [
        { label: "Fire (kg)", value: recentScrap.totalKg.toFixed(1) },
      ],
      href: "/production",
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const delayedCount = await db.order.count({
    where: {
      deliveryDate: { lt: today },
      status: { notIn: ["shipped", "cancelled", "draft"] },
    },
  });

  if (delayedCount > 0) {
    items.push({
      id: "anomaly-delayed-orders",
      category: "anomaly",
      severity: "high",
      title: "Geciken teslimatlar",
      summary: `${delayedCount} sipariş planlanan teslim tarihini geçti.`,
      reasoning: [
        "Teslim tarihi bugünden önce; durum henüz sevk edilmedi veya iptal değil.",
        "Üretim gecikmesi veya mamul stok yetersizliği riski.",
      ],
      metrics: [{ label: "Geciken sipariş", value: String(delayedCount) }],
      suggestedAction: "Sipariş listesinde geciken kayıtları önceliklendirin.",
      href: "/orders",
    });
  }

  const lowYieldOrders = await db.productionOrder.findMany({
    where: {
      status: { in: ["completed", "in_progress"] },
      plannedKg: { gt: 0 },
    },
    include: { product: { include: { flavor: true } } },
    take: 50,
  });

  for (const po of lowYieldOrders) {
    const yieldPct =
      po.yieldPercent ??
      (po.plannedKg > 0 ? (po.producedKg / po.plannedKg) * 100 : 0);

    if (yieldPct >= YIELD_WARNING_PERCENT) continue;

    const flavorName =
      po.product?.flavor?.nameTr ??
      po.product?.flavor?.namePt ??
      po.productionNo;

    items.push({
      id: `anomaly-yield-${po.id}`,
      category: "anomaly",
      severity: yieldPct < 75 ? "high" : "medium",
      title: `${po.productionNo}: düşük verim`,
      summary: `Verim ${yieldPct.toFixed(1)}% (hedef ≥${YIELD_WARNING_PERCENT}%).`,
      reasoning: [
        `Planlanan ${po.plannedKg} kg; üretilen ${po.producedKg} kg.`,
        `Lezzet / ürün: ${flavorName}.`,
        "Reçete, pişirme süresi veya hammadde kalitesi kontrol edilmeli.",
      ],
      metrics: [
        { label: "Verim", value: `${yieldPct.toFixed(1)}%` },
        { label: "Plan", value: `${po.plannedKg} kg` },
        { label: "Üretim", value: `${po.producedKg} kg` },
      ],
      suggestedAction: "Üretim emri detayında fire ve aşama sürelerini inceleyin.",
      href: "/production",
    });
  }

  const overduePayments = await db.payment.count({
    where: { status: "overdue", direction: "in" },
  });

  if (overduePayments > 0) {
    items.push({
      id: "anomaly-overdue-payments",
      category: "anomaly",
      severity: "high",
      title: "Geciken tahsilatlar",
      summary: `${overduePayments} tahsilat kaydı vadesi geçmiş.`,
      reasoning: [
        "Nakit akışı ve cari risk artışı.",
        "Finans modülünde dekont eşleştirme ve tahsilat takibi önerilir.",
      ],
      metrics: [{ label: "Geciken", value: String(overduePayments) }],
      suggestedAction: "Müşteri tahsilat planını ve vade takibini güncelleyin.",
      href: "/finance",
    });
  }

  return items;
}

export async function buildAiRecommendations(
  db: Db,
  options?: { limit?: number },
): Promise<AiRecommendationsReport> {
  const limitKey = options?.limit != null ? String(options.limit) : "all";
  return cachedQuery(
    ["ai-recommendations", limitKey],
    () => buildAiRecommendationsUncached(db, options),
    REVALIDATE.reports,
    ["ai", "dashboard"],
  );
}

async function buildAiRecommendationsUncached(
  db: Db,
  options?: { limit?: number },
): Promise<AiRecommendationsReport> {
  const anchor = demoAnchorDate();
  const parsed = parsePeriodMonth(FIXED_EXPENSE_DEMO_MONTH);
  const periodLabel = parsed?.start
    ? FIXED_EXPENSE_DEMO_MONTH
    : anchor.toISOString().slice(0, 10);

  const [
    profitability,
    stockPurchase,
    demand,
    anomalies,
  ] = await Promise.all([
    buildProfitabilityRecommendations(db),
    buildStockAndPurchaseRecommendations(db),
    buildDemandForecastRecommendations(db, anchor),
    buildAnomalyRecommendations(db, anchor),
  ]);

  const all = [...profitability, ...stockPurchase, ...demand, ...anomalies].sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity),
  );

  const limit = options?.limit;
  const recommendations =
    limit != null && limit > 0 ? all.slice(0, limit) : all;

  return {
    generatedAt: new Date().toISOString(),
    anchorDate: anchor.toISOString().slice(0, 10),
    periodLabel,
    totalCount: all.length,
    byCategory: countByCategory(all),
    recommendations,
  };
}
