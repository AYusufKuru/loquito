export interface QaSourceRow {
  label: string;
  value: string;
}

export interface QaResponse {
  matched: boolean;
  intentId: string | null;
  question: string;
  answer: string;
  primaryValue?: string;
  confidence: number;
  sources: QaSourceRow[];
  moduleHref?: string;
  samples: string[];
}

export type QaIntentId =
  | "order_pending_approval"
  | "order_in_production"
  | "order_ready_ship"
  | "order_delayed"
  | "order_total"
  | "monthly_revenue"
  | "monthly_profit"
  | "monthly_production_cost"
  | "monthly_fixed_expense"
  | "scrap_total"
  | "stock_critical"
  | "finished_stock"
  | "employees_present"
  | "employees_total"
  | "overdue_payments"
  | "purchase_requests_pending"
  | "production_today"
  | "unknown";

export interface QaIntentDefinition {
  id: QaIntentId;
  keywords: string[];
  weight?: number;
  excludeKeywords?: string[];
}
