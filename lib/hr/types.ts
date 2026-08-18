export interface EmployeeRow {
  id: string;
  name: string;
  role: string | null;
  department: string | null;
  monthlySalaryCents: number;
  hourlyRateCents: number;
  overtimeMultiplier: number;
  shift: string | null;
  startDate: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
}

export interface EmployeeSummary {
  totalCount: number;
  activeCount: number;
  totalMonthlySalaryCents: number;
}

export interface AttendanceRow {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  workedHours: number;
  overtimeHours: number;
  status: string;
  notes: string | null;
}

export interface WorkAssignmentRow {
  id: string;
  employeeId: string;
  employeeName: string;
  productionOrderId: string | null;
  productionNo: string | null;
  orderId: string | null;
  orderNo: string | null;
  lineId: string | null;
  hours: number;
  date: string;
  notes: string | null;
  laborCostCents: number;
}

export interface PayrollEmployeeRow {
  employeeId: string;
  employeeName: string;
  role: string | null;
  workedHours: number;
  overtimeHours: number;
  regularPayCents: number;
  overtimePayCents: number;
  totalPayCents: number;
  absentDays: number;
  leaveDays: number;
}

export interface PayrollSummary {
  month: string;
  employeeCount: number;
  totalWorkedHours: number;
  totalOvertimeHours: number;
  totalRegularPayCents: number;
  totalOvertimePayCents: number;
  totalPayCents: number;
  rows: PayrollEmployeeRow[];
}

export interface OrderLaborBreakdown {
  orderId: string;
  totalLaborCostCents: number;
  recordedHours: number;
  estimatedHours: number;
  isEstimated: boolean;
  assignments: WorkAssignmentRow[];
}

export interface EmployeeInput {
  name: string;
  role?: string | null;
  department?: string | null;
  monthlySalaryCents: number;
  hourlyRateCents?: number;
  overtimeMultiplier?: number;
  shift?: string | null;
  startDate?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive?: boolean;
}
