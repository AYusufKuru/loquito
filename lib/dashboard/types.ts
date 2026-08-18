export interface DashboardCookerCard {
  lineCode: string;
  lineName: string;
  status: string;
  statusLabel: string;
  orderNo: string | null;
  stage: string | null;
  progressPercent: number;
  hasDowntime: boolean;
}

export interface DashboardLineCard {
  lineCode: string;
  lineName: string;
  status: string;
  dailyProducedUnits: number;
  dailyTargetUnits: number;
  progressPercent: number;
}

export interface DashboardOrderCounts {
  pendingApproval: number;
  inProduction: number;
  readyToShip: number;
  delayed: number;
}

export interface DashboardOrderRow {
  id: string;
  orderNo: string;
  customerName: string;
  status: string;
  statusLabel: string;
  deliveryDate: string | null;
  totalCents: number;
  daysUntilDelivery: number | null;
}

export interface DashboardPaymentDue {
  orderNo: string;
  customerName: string;
  dueDate: string;
  amountCents: number;
  daysUntilDue: number;
}

export interface DashboardAlert {
  type: string;
  message: string;
  severity: "high" | "medium" | "low";
  href?: string;
}

export interface DashboardMonthlyFinance {
  periodMonth: string;
  revenueCents: number;
  productionCostCents: number;
  fixedExpenseCents: number;
  profitCents: number;
}

export interface DashboardAiRecommendation {
  id: string;
  title: string;
  summary: string;
  severity: "high" | "medium" | "low";
  href?: string;
}

export interface DashboardSnapshot {
  generatedAt: string;
  orderCounts: DashboardOrderCounts;
  upcomingDeliveries: DashboardOrderRow[];
  overduePayments: DashboardPaymentDue[];
  upcomingPayments: DashboardPaymentDue[];
  monthlyFinance: DashboardMonthlyFinance;
  cookers: DashboardCookerCard[];
  cuttingLine: DashboardLineCard | null;
  packagingLine: DashboardLineCard | null;
  todayProducedUnits: number;
  todayProducedKg: number;
  stockAlerts: DashboardAlert[];
  finishedStock: {
    totalUnits: number;
    availableUnits: number;
    reservedUnits: number;
    totalValueCents: number;
    expiringSoonCount: number;
  };
  hr: {
    activeEmployees: number;
    presentToday: number;
    onAssignmentToday: number;
  };
  criticalAlerts: DashboardAlert[];
  aiRecommendations: DashboardAiRecommendation[];
}
