export type RecommendationCategory =
  | "profitability"
  | "stock_level"
  | "purchase"
  | "demand_forecast"
  | "anomaly";

export type RecommendationSeverity = "high" | "medium" | "low";

export interface RecommendationMetric {
  label: string;
  value: string;
}

export interface AiRecommendation {
  id: string;
  category: RecommendationCategory;
  severity: RecommendationSeverity;
  title: string;
  summary: string;
  reasoning: string[];
  metrics: RecommendationMetric[];
  suggestedAction?: string;
  href?: string;
}

export interface AiRecommendationsReport {
  generatedAt: string;
  anchorDate: string;
  periodLabel: string;
  totalCount: number;
  byCategory: Record<RecommendationCategory, number>;
  recommendations: AiRecommendation[];
}
