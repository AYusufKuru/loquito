import type { PrismaClient } from "@prisma/client";

import { getPurchaseSummary } from "@/lib/assets/service";
import { computeFinishedStockSummary } from "@/lib/finished-stock/service";
import {
  FIXED_EXPENSE_DEMO_MONTH,
  parsePeriodMonth,
} from "@/lib/finance/constants";
import { buildIncomeExpenseReport } from "@/lib/reports/income-expense";
import { buildScrapReport } from "@/lib/reports/scrap";
import { computeStockAlerts } from "@/lib/stock/inventory";
import { formatBrlFromCents } from "@/lib/stock/constants";

import {
  extractPeriodMonth,
  matchIntent,
  QA_SAMPLE_QUESTIONS,
} from "./intents";
import type { QaIntentId, QaResponse } from "./types";

type Db = PrismaClient;

function defaultPeriod(question: string): string {
  const extracted = extractPeriodMonth(question);
  if (extracted) return extracted;
  return FIXED_EXPENSE_DEMO_MONTH;
}

function periodRange(periodMonth: string) {
  const parsed = parsePeriodMonth(periodMonth);
  if (!parsed) {
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      label: periodMonth,
    };
  }
  return { start: parsed.start, end: parsed.end, label: periodMonth };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

async function handleIntent(
  db: Db,
  intentId: QaIntentId,
  question: string,
  orderNo: string | null,
): Promise<Omit<QaResponse, "matched" | "intentId" | "question" | "confidence" | "samples">> {
  switch (intentId) {
    case "order_pending_approval": {
      const count = await db.order.count({ where: { status: "pending_approval" } });
      return {
        answer: `Onay bekleyen ${count} sipariş var.`,
        primaryValue: String(count),
        sources: [
          { label: "Durum", value: "pending_approval" },
          { label: "Kayıt sayısı", value: String(count) },
        ],
        moduleHref: "/orders",
      };
    }

    case "order_in_production": {
      const count = await db.order.count({ where: { status: "in_production" } });
      return {
        answer: `Üretimde ${count} sipariş var.`,
        primaryValue: String(count),
        sources: [
          { label: "Durum", value: "in_production" },
          { label: "Kayıt sayısı", value: String(count) },
        ],
        moduleHref: "/orders",
      };
    }

    case "order_ready_ship": {
      const count = await db.order.count({ where: { status: "ready_ship" } });
      return {
        answer: `Sevke hazır ${count} sipariş var.`,
        primaryValue: String(count),
        sources: [
          { label: "Durum", value: "ready_ship" },
          { label: "Kayıt sayısı", value: String(count) },
        ],
        moduleHref: "/orders",
      };
    }

    case "order_delayed": {
      const today = startOfToday();
      const count = await db.order.count({
        where: {
          deliveryDate: { lt: today },
          status: { notIn: ["shipped", "cancelled", "draft"] },
        },
      });
      return {
        answer:
          count > 0
            ? `Geciken teslimat: ${count} sipariş planlanan tarihi geçti.`
            : "Geciken teslimat yok.",
        primaryValue: String(count),
        sources: [
          { label: "Geciken sipariş", value: String(count) },
          { label: "Referans tarih", value: today.toISOString().slice(0, 10) },
        ],
        moduleHref: "/orders",
      };
    }

    case "order_total": {
      const no = orderNo ?? "PED-EXEMPLO-001";
      const order = await db.order.findFirst({
        where: { orderNo: no },
        include: { customer: { select: { name: true } } },
      });
      if (!order) {
        return {
          answer: `${no} siparişi bulunamadı.`,
          primaryValue: "—",
          sources: [{ label: "Sipariş no", value: no }],
          moduleHref: "/orders",
        };
      }
      return {
        answer: `${no} toplam tutar ${formatBrlFromCents(order.totalCents)} (${order.customer.name}, durum: ${order.status}).`,
        primaryValue: formatBrlFromCents(order.totalCents),
        sources: [
          { label: "Sipariş no", value: order.orderNo },
          { label: "Müşteri", value: order.customer.name },
          { label: "Toplam", value: formatBrlFromCents(order.totalCents) },
          { label: "Durum", value: order.status },
          { label: "Sipariş tarihi", value: order.orderDate.toISOString().slice(0, 10) },
        ],
        moduleHref: "/orders",
      };
    }

    case "monthly_revenue": {
      const period = defaultPeriod(question);
      const range = periodRange(period);
      const report = await buildIncomeExpenseReport(db, range);
      const point = report.points.find((p) => p.periodMonth === period);
      const revenue = point?.revenueCents ?? 0;
      return {
        answer: `${period} döneminde gelir ${formatBrlFromCents(revenue)}.`,
        primaryValue: formatBrlFromCents(revenue),
        sources: [
          { label: "Dönem", value: period },
          { label: "Gelir", value: formatBrlFromCents(revenue) },
          { label: "Üretim maliyeti", value: formatBrlFromCents(point?.productionCostCents ?? 0) },
        ],
        moduleHref: "/reports",
      };
    }

    case "monthly_profit": {
      const period = defaultPeriod(question);
      const range = periodRange(period);
      const report = await buildIncomeExpenseReport(db, range);
      const point = report.points.find((p) => p.periodMonth === period);
      const profit = point?.profitCents ?? 0;
      return {
        answer: `${period} döneminde net kâr ${formatBrlFromCents(profit)}.`,
        primaryValue: formatBrlFromCents(profit),
        sources: [
          { label: "Dönem", value: period },
          { label: "Gelir", value: formatBrlFromCents(point?.revenueCents ?? 0) },
          { label: "Üretim maliyeti", value: formatBrlFromCents(point?.productionCostCents ?? 0) },
          { label: "Sabit gider", value: formatBrlFromCents(point?.fixedExpenseCents ?? 0) },
          { label: "Fire maliyeti", value: formatBrlFromCents(point?.scrapCostCents ?? 0) },
          { label: "Net kâr", value: formatBrlFromCents(profit) },
        ],
        moduleHref: "/reports",
      };
    }

    case "monthly_production_cost": {
      const period = defaultPeriod(question);
      const range = periodRange(period);
      const report = await buildIncomeExpenseReport(db, range);
      const point = report.points.find((p) => p.periodMonth === period);
      const cost = point?.productionCostCents ?? 0;
      return {
        answer: `${period} döneminde üretim maliyeti ${formatBrlFromCents(cost)}.`,
        primaryValue: formatBrlFromCents(cost),
        sources: [
          { label: "Dönem", value: period },
          { label: "Üretim maliyeti", value: formatBrlFromCents(cost) },
          { label: "Gelir", value: formatBrlFromCents(point?.revenueCents ?? 0) },
        ],
        moduleHref: "/reports",
      };
    }

    case "monthly_fixed_expense": {
      const period = defaultPeriod(question);
      const range = periodRange(period);
      const report = await buildIncomeExpenseReport(db, range);
      const point = report.points.find((p) => p.periodMonth === period);
      const fixed = point?.fixedExpenseCents ?? 0;
      return {
        answer: `${period} döneminde sabit gider toplamı ${formatBrlFromCents(fixed)}.`,
        primaryValue: formatBrlFromCents(fixed),
        sources: [
          { label: "Dönem", value: period },
          { label: "Sabit gider", value: formatBrlFromCents(fixed) },
        ],
        moduleHref: "/finance",
      };
    }

    case "scrap_total": {
      const period = defaultPeriod(question);
      const range = periodRange(period);
      const scrap = await buildScrapReport(db, range);
      const isKgQuestion = /kg|kilogram/.test(question.toLocaleLowerCase("tr-TR"));
      if (isKgQuestion) {
        return {
          answer: `${period} döneminde toplam fire ${scrap.totalKg.toFixed(1)} kg.`,
          primaryValue: `${scrap.totalKg.toFixed(1)} kg`,
          sources: [
            { label: "Dönem", value: period },
            { label: "Fire (kg)", value: scrap.totalKg.toFixed(1) },
            { label: "Tahmini maliyet", value: formatBrlFromCents(scrap.totalCostCents) },
            { label: "Kayıt sayısı", value: String(scrap.rows.length) },
          ],
          moduleHref: "/production",
        };
      }
      return {
        answer: `${period} döneminde fire maliyeti ${formatBrlFromCents(scrap.totalCostCents)} (${scrap.totalKg.toFixed(1)} kg).`,
        primaryValue: formatBrlFromCents(scrap.totalCostCents),
        sources: [
          { label: "Dönem", value: period },
          { label: "Fire (kg)", value: scrap.totalKg.toFixed(1) },
          { label: "Maliyet", value: formatBrlFromCents(scrap.totalCostCents) },
        ],
        moduleHref: "/production",
      };
    }

    case "stock_critical": {
      const alerts = await computeStockAlerts();
      const lowStock = alerts.filter((a) => a.type === "low_stock");
      return {
        answer: `Kritik seviyede veya altında ${lowStock.length} malzeme var.`,
        primaryValue: String(lowStock.length),
        sources: lowStock.slice(0, 5).map((a) => ({
          label: a.materialName ?? a.materialCode ?? "Malzeme",
          value: a.message,
        })),
        moduleHref: "/stock",
      };
    }

    case "finished_stock": {
      const summary = await computeFinishedStockSummary(db);
      return {
        answer: `Mamul stokta ${summary.availableUnits} adet kullanılabilir (${summary.reservedUnits} rezerve, toplam ${summary.totalUnits} adet).`,
        primaryValue: String(summary.availableUnits),
        sources: [
          { label: "Kullanılabilir", value: String(summary.availableUnits) },
          { label: "Rezerve", value: String(summary.reservedUnits) },
          { label: "Toplam adet", value: String(summary.totalUnits) },
          { label: "Stok değeri", value: formatBrlFromCents(summary.totalValueCents) },
          { label: "SKT yaklaşan lot", value: String(summary.expiringSoonCount) },
        ],
        moduleHref: "/stock",
      };
    }

    case "employees_present": {
      const today = startOfToday();
      const todayEnd = endOfToday();
      const present = await db.attendance.count({
        where: {
          date: { gte: today, lte: todayEnd },
          status: { in: ["present", "overtime"] },
        },
      });
      return {
        answer: `Bugün mesaide ${present} personel kaydı var.`,
        primaryValue: String(present),
        sources: [
          { label: "Tarih", value: today.toISOString().slice(0, 10) },
          { label: "Mesaide", value: String(present) },
        ],
        moduleHref: "/hr",
      };
    }

    case "employees_total": {
      const total = await db.employee.count({ where: { isActive: true } });
      return {
        answer: `Aktif personel sayısı ${total}.`,
        primaryValue: String(total),
        sources: [{ label: "Aktif personel", value: String(total) }],
        moduleHref: "/hr",
      };
    }

    case "overdue_payments": {
      const count = await db.payment.count({
        where: { status: "overdue", direction: "in" },
      });
      const total = await db.payment.aggregate({
        where: { status: "overdue", direction: "in" },
        _sum: { amountCents: true },
      });
      return {
        answer:
          count > 0
            ? `${count} geciken tahsilat; toplam ${formatBrlFromCents(total._sum.amountCents ?? 0)}.`
            : "Geciken tahsilat yok.",
        primaryValue: String(count),
        sources: [
          { label: "Geciken kayıt", value: String(count) },
          { label: "Toplam tutar", value: formatBrlFromCents(total._sum.amountCents ?? 0) },
        ],
        moduleHref: "/finance",
      };
    }

    case "purchase_requests_pending": {
      const summary = await getPurchaseSummary(db);
      const hasPending = summary.pendingApprovalCount > 0;
      return {
        answer: hasPending
          ? `Onay bekleyen ${summary.pendingApprovalCount} yatırım/satın alma talebi; toplam ${formatBrlFromCents(summary.pendingApprovalTotalCents)}.`
          : "Onay bekleyen yatırım/satın alma talebi yok.",
        primaryValue: String(summary.pendingApprovalCount),
        sources: [
          { label: "Onay bekleyen", value: String(summary.pendingApprovalCount) },
          { label: "Tutar", value: formatBrlFromCents(summary.pendingApprovalTotalCents) },
          { label: "Onaylanmış tutar", value: formatBrlFromCents(summary.approvedTotalCents) },
        ],
        moduleHref: "/assets",
      };
    }

    case "production_today": {
      const today = startOfToday();
      const todayEnd = endOfToday();
      const agg = await db.productionOrder.aggregate({
        where: {
          OR: [
            { actualEnd: { gte: today, lte: todayEnd } },
            { status: "in_progress" },
          ],
        },
        _sum: { producedUnits: true, producedKg: true, currentKg: true },
      });
      const units = agg._sum.producedUnits ?? 0;
      const kg = (agg._sum.producedKg ?? 0) + (agg._sum.currentKg ?? 0);
      return {
        answer: `Bugün üretim: ${units} kutu, ${kg.toFixed(1)} kg.`,
        primaryValue: String(units),
        sources: [
          { label: "Tarih", value: today.toISOString().slice(0, 10) },
          { label: "Kutu", value: String(units) },
          { label: "Kg", value: kg.toFixed(1) },
        ],
        moduleHref: "/production",
      };
    }

    default:
      return {
        answer:
          "Bu soruyu anlayamadım. Örnek sorulardan birini deneyin veya daha spesifik yazın (ör. dönem, sipariş no).",
        primaryValue: undefined,
        sources: [],
      };
  }
}

export async function askQuestion(db: Db, question: string): Promise<QaResponse> {
  const trimmed = question.trim();
  const samples = [...QA_SAMPLE_QUESTIONS];

  if (!trimmed) {
    return {
      matched: false,
      intentId: null,
      question: trimmed,
      answer: "Lütfen bir soru yazın veya örneklerden seçin.",
      confidence: 0,
      sources: [],
      samples,
    };
  }

  const { intentId, confidence, orderNo } = matchIntent(trimmed);

  if (intentId === "unknown") {
    return {
      matched: false,
      intentId: null,
      question: trimmed,
      answer:
        "Sorunuzu eşleştiremedim. Sipariş, stok, finans veya üretim hakkında sayısal bir soru deneyin.",
      confidence: 0,
      sources: [],
      samples,
    };
  }

  const result = await handleIntent(db, intentId, trimmed, orderNo);

  return {
    matched: true,
    intentId,
    question: trimmed,
    confidence,
    samples,
    ...result,
  };
}

export function listSampleQuestions(): string[] {
  return [...QA_SAMPLE_QUESTIONS];
}
