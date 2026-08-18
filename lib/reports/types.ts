export interface ProfitabilityRow {
  groupKey: string;
  groupLabel: string;
  revenueCents: number;
  materialCostCents: number;
  laborCostCents: number;
  overheadCostCents: number;
  productionCostCents: number;
  profitCents: number;
  marginPercent: number;
  orderCount: number;
}

export interface ProfitabilityReport {
  rangeLabel: string;
  rangeFrom: string;
  rangeTo: string;
  groupBy: string;
  rows: ProfitabilityRow[];
  summary: {
    revenueCents: number;
    materialCostCents: number;
    laborCostCents: number;
    overheadCostCents: number;
    productionCostCents: number;
    profitCents: number;
    marginPercent: number;
    fixedExpenseCents: number;
    scrapCostCents: number;
    orderCount: number;
  };
}

export interface MaterialConsumptionRow {
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  category: string;
  quantity: number;
  costCents: number;
}

export interface MaterialConsumptionReport {
  rangeLabel: string;
  rows: MaterialConsumptionRow[];
  totalCostCents: number;
}

export interface ScrapRow {
  id: string;
  productionNo: string;
  flavorName: string;
  quantityKg: number;
  reason: string | null;
  costCents: number;
  date: string;
}

export interface ScrapReport {
  rangeLabel: string;
  rows: ScrapRow[];
  totalKg: number;
  totalCostCents: number;
}

export interface IncomeExpensePoint {
  periodMonth: string;
  revenueCents: number;
  productionCostCents: number;
  fixedExpenseCents: number;
  scrapCostCents: number;
  profitCents: number;
}

export interface IncomeExpenseReport {
  rangeLabel: string;
  points: IncomeExpensePoint[];
}
