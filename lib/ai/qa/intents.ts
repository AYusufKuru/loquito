import type { QaIntentDefinition } from "./types";

export const QA_SAMPLE_QUESTIONS = [
  "Kaç sipariş onay bekliyor?",
  "2026-02 ayında gelir ne kadar?",
  "Net kâr ne kadar?",
  "Kritik stokta kaç malzeme var?",
  "Mamul stokta kaç adet kullanılabilir?",
  "Geciken teslimat var mı?",
  "PED-EXEMPLO-001 sipariş tutarı ne kadar?",
  "Bugün kaç personel mesaide?",
  "Fire ne kadar kg?",
  "Onay bekleyen yatırım talebi var mı?",
] as const;

export const QA_INTENTS: QaIntentDefinition[] = [
  {
    id: "order_total",
    keywords: ["sipariş tutar", "sipariş toplam", "order total", "ped-"],
    weight: 3,
  },
  {
    id: "order_pending_approval",
    keywords: ["onay bekleyen", "bekleyen sipariş", "pending approval", "onay bekliyor"],
    weight: 2,
    excludeKeywords: ["yatırım", "talebi", "demirbaş", "satın alma talep"],
  },
  {
    id: "order_in_production",
    keywords: ["üretimde", "in production", "üretimdeki sipariş"],
    weight: 2,
  },
  {
    id: "order_ready_ship",
    keywords: ["sevke hazır", "ready ship", "sevkiyata hazır"],
    weight: 2,
  },
  {
    id: "order_delayed",
    keywords: ["geciken teslimat", "geciken sipariş", "gecikme", "delayed delivery"],
    weight: 2,
  },
  {
    id: "monthly_profit",
    keywords: ["net kâr", "net kar", "kâr ne", "kar ne", "profit", "net profit"],
    weight: 2,
    excludeKeywords: ["marj"],
  },
  {
    id: "monthly_revenue",
    keywords: ["gelir", "ciro", "revenue", "satış tutar"],
    weight: 2,
    excludeKeywords: ["maliyet", "gider"],
  },
  {
    id: "monthly_production_cost",
    keywords: ["üretim maliyeti", "production cost", "maliyet ne"],
    weight: 2,
    excludeKeywords: ["sabit", "gider"],
  },
  {
    id: "monthly_fixed_expense",
    keywords: ["sabit gider", "fixed expense", "genel gider"],
    weight: 2,
  },
  {
    id: "scrap_total",
    keywords: ["fire", "scrap", "fire ne", "fire kaç"],
    weight: 2,
  },
  {
    id: "stock_critical",
    keywords: ["kritik stok", "düşük stok", "critical stock", "stok uyarı"],
    weight: 2,
    excludeKeywords: ["mamul", "bitmiş"],
  },
  {
    id: "finished_stock",
    keywords: ["mamul stok", "bitmiş ürün", "finished stock", "kullanılabilir adet"],
    weight: 2,
  },
  {
    id: "employees_present",
    keywords: ["mesaide", "puantaj", "bugün personel", "present today"],
    weight: 2,
    excludeKeywords: ["toplam"],
  },
  {
    id: "employees_total",
    keywords: ["toplam personel", "kaç personel", "çalışan sayısı", "aktif personel"],
    weight: 2,
  },
  {
    id: "overdue_payments",
    keywords: ["geciken ödeme", "geciken tahsilat", "vadesi geçmiş", "overdue"],
    weight: 2,
  },
  {
    id: "purchase_requests_pending",
    keywords: ["yatırım talebi", "satın alma talebi", "demirbaş talep", "purchase request"],
    weight: 2,
    excludeKeywords: ["sipariş onay"],
  },
  {
    id: "production_today",
    keywords: ["bugün üretim", "günlük üretim", "bugün kaç kutu", "today production"],
    weight: 2,
  },
];

export function normalizeQuestion(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractOrderNo(text: string): string | null {
  const match = text.match(/PED[-\w]+/i);
  return match ? match[0].toUpperCase() : null;
}

export function extractPeriodMonth(text: string): string | null {
  const normalized = normalizeQuestion(text);
  const match = normalized.match(/(20\d{2})[-\s/](\d{1,2})/);
  if (match) {
    const month = match[2].padStart(2, "0");
    return `${match[1]}-${month}`;
  }
  if (normalized.includes("bu ay") || normalized.includes("this month")) {
    return null;
  }
  return null;
}

export function matchIntent(question: string): {
  intentId: QaIntentDefinition["id"] | "unknown";
  confidence: number;
  orderNo: string | null;
} {
  const normalized = normalizeQuestion(question);
  const orderNo = extractOrderNo(question);

  if (orderNo && /tutar|toplam|ne kadar|amount|total/.test(normalized)) {
    return { intentId: "order_total", confidence: 1, orderNo };
  }

  let best: { id: QaIntentDefinition["id"]; score: number } | null = null;

  for (const intent of QA_INTENTS) {
    if (intent.excludeKeywords?.some((k) => normalized.includes(normalizeQuestion(k)))) {
      continue;
    }

    let score = 0;
    const weight = intent.weight ?? 1;

    for (const keyword of intent.keywords) {
      const nk = normalizeQuestion(keyword);
      if (normalized.includes(nk)) {
        score += weight;
      }
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { id: intent.id, score };
    }
  }

  if (!best) {
    return { intentId: "unknown", confidence: 0, orderNo };
  }

  const confidence = Math.min(1, best.score / 4);
  return { intentId: best.id, confidence, orderNo };
}
