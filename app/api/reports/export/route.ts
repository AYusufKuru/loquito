import { buildCsv, csvResponse } from "@/lib/reports/export";
import { buildMaterialConsumptionReport } from "@/lib/reports/materials";
import { buildProfitabilityReport } from "@/lib/reports/profitability";
import { buildScrapReport } from "@/lib/reports/scrap";
import {
  parseReportQuery,
  requireReportsView,
  reportError,
} from "@/lib/reports/api-helpers";
import { prisma } from "@/lib/prisma";
import { formatBrlFromCents } from "@/lib/stock/constants";

export async function GET(request: Request) {
  const auth = await requireReportsView();
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? "profitability";
    const format = searchParams.get("format") ?? "csv";
    const { range, groupBy } = parseReportQuery(searchParams);

    if (format !== "csv") {
      return reportError(new Error("Yalnızca CSV destekleniyor."), "Dışa aktarma başarısız.");
    }

    const stamp = range.label.replace(/[^\d-]/g, "_");

    if (type === "profitability") {
      const report = await buildProfitabilityReport(prisma, range, groupBy);
      const headers = [
        "Grup",
        "Gelir",
        "Hammadde",
        "İşçilik",
        "Genel gider",
        "Üretim maliyeti",
        "Kâr",
        "Marj %",
      ];
      const rows = report.rows.map((r) => [
        r.groupLabel,
        formatBrlFromCents(r.revenueCents),
        formatBrlFromCents(r.materialCostCents),
        formatBrlFromCents(r.laborCostCents),
        formatBrlFromCents(r.overheadCostCents),
        formatBrlFromCents(r.productionCostCents),
        formatBrlFromCents(r.profitCents),
        String(r.marginPercent),
      ]);
      const csv = buildCsv(headers, rows);
      return csvResponse(csv, `karlilik-${stamp}.csv`);
    }

    if (type === "materials") {
      const report = await buildMaterialConsumptionReport(prisma, range);
      const headers = ["Kod", "Malzeme", "Kategori", "Miktar", "Birim", "Maliyet"];
      const rows = report.rows.map((r) => [
        r.materialCode,
        r.materialName,
        r.category,
        String(r.quantity),
        r.unit,
        formatBrlFromCents(r.costCents),
      ]);
      const csv = buildCsv(headers, rows);
      return csvResponse(csv, `malzeme-tuketim-${stamp}.csv`);
    }

    if (type === "scrap") {
      const report = await buildScrapReport(prisma, range);
      const headers = ["Üretim emri", "Lezzet", "Fire kg", "Neden", "Maliyet", "Tarih"];
      const rows = report.rows.map((r) => [
        r.productionNo,
        r.flavorName,
        String(r.quantityKg),
        r.reason ?? "",
        formatBrlFromCents(r.costCents),
        r.date.slice(0, 10),
      ]);
      const csv = buildCsv(headers, rows);
      return csvResponse(csv, `fire-${stamp}.csv`);
    }

    return reportError(new Error("Geçersiz rapor türü."), "Dışa aktarma başarısız.");
  } catch (error) {
    return reportError(error, "Dışa aktarma başarısız.");
  }
}
