export interface PlanLineInput {
  productSku?: string;
  productName?: string;
  netWeightG: number;
  toProduceBoxes: number;
  boxesPerBatch: number;
  batchesNeeded: number;
}

export interface PlanningDayEntry {
  date: string;
  workDayIndex: number;
  cookingBatches: number;
  cuttingBoxes: number;
  cumulativeCutBoxes: number;
}

export interface ProductionPlanResult {
  startDate: string;
  estimatedCompletionDate: string;
  estimatedDeliveryDate: string;
  deliveryDateRequested: string | null;
  totalBatches: number;
  totalBoxesToProduce: number;
  cookingWorkDays: number;
  cuttingWorkDays: number;
  totalWorkDays: number;
  timeline: PlanningDayEntry[];
  lines: Array<{
    productSku: string;
    productName: string;
    netWeightG: number;
    toProduceBoxes: number;
    batchesNeeded: number;
    dailyCapacity: number;
  }>;
  meetsDelivery: boolean | null;
  settingsSnapshot: {
    potCount: number;
    batchYieldKg: number;
    coolingDays: number;
    dailyCapacity250g: number;
  };
}
