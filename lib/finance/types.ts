export type OverheadAllocationMethod = "kg" | "hours";

export interface FixedExpenseRow {
  id: string;
  periodMonth: string;
  name: string;
  amountCents: number;
  category: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PeriodExpenseSummary {
  periodMonth: string;
  totalCents: number;
  itemCount: number;
  activeCount: number;
}

export interface OverheadSummary {
  periodMonth: string;
  allocationMethod: OverheadAllocationMethod;
  monthlyOverheadCents: number;
  monthlyDenominator: number;
  denominatorLabel: string;
  costPerUnitCents: number;
}

export interface StatementReceiptRow {
  id: string;
  paymentId: string | null;
  fileName: string;
  filePath: string;
  transactionDate: string | null;
  amountCents: number | null;
  controlNo: string | null;
  counterparty: string | null;
  direction: string | null;
  isMatched: boolean;
  isApproved: boolean;
  createdAt: string;
  bankStatementId: string | null;
  orderNo: string | null;
  matchScore: number | null;
  matchReason: string | null;
  proposedOrderId: string | null;
}

export interface BankStatementRow {
  id: string;
  fileName: string;
  periodFrom: string | null;
  periodTo: string | null;
  uploadedAt: string;
  status: string;
  lineCount: number;
  matchedCount: number;
  approvedCount: number;
}
