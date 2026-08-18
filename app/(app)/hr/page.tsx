import { HrManager } from "@/components/hr/hr-manager";
import {
  hasPermission,
  requireModuleAccess,
} from "@/lib/auth/permissions";
import {
  computeEmployeeSummary,
  listEmployees,
} from "@/lib/hr/service";
import { serializeEmployee } from "@/lib/hr/serialize";
import { t } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HrPage() {
  const { permissions } = await requireModuleAccess("hr");

  const canCreate = hasPermission(permissions, "hr", "create");
  const canEdit = hasPermission(permissions, "hr", "edit");

  const [employees, summary, productionOrders] = await Promise.all([
    listEmployees(prisma),
    computeEmployeeSummary(prisma),
    prisma.productionOrder.findMany({
      where: { status: { in: ["planned", "in_progress"] } },
      include: { order: { select: { orderNo: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const labels: Record<string, string> = {
    title: t("modules.hr.title"),
    description: t("hr.pageDesc"),
    employeesTab: t("hr.employeesTab"),
    attendanceTab: t("hr.attendanceTab"),
    assignmentsTab: t("hr.assignmentsTab"),
    payrollTab: t("hr.payrollTab"),
    summaryTitle: t("hr.summaryTitle"),
    listTitle: t("hr.listTitle"),
    detailTitle: t("hr.detailTitle"),
    detailDesc: t("hr.detailDesc"),
    newEmployee: t("hr.newEmployee"),
    selectEmployee: t("hr.selectEmployee"),
    noEmployees: t("hr.noEmployees"),
    searchPlaceholder: t("hr.searchPlaceholder"),
    name: t("hr.name"),
    role: t("hr.role"),
    shift: t("hr.shift"),
    monthlySalary: t("hr.monthlySalary"),
    hourlyRate: t("hr.hourlyRate"),
    hourlyAuto: t("hr.hourlyAuto"),
    overtimeMultiplier: t("hr.overtimeMultiplier"),
    startDate: t("hr.startDate"),
    phone: t("hr.phone"),
    email: t("hr.email"),
    isActive: t("hr.isActive"),
    inactive: t("hr.inactive"),
    activeCount: t("hr.activeCount"),
    totalCount: t("hr.totalCount"),
    totalSalary: t("hr.totalSalary"),
    save: t("hr.save"),
    create: t("hr.create"),
    saving: t("hr.saving"),
    saved: t("hr.saved"),
    created: t("hr.created"),
    saveError: t("hr.saveError"),
    salaryRequired: t("hr.salaryRequired"),
    connectionError: t("hr.connectionError"),
    attendanceTitle: t("hr.attendanceTitle"),
    attendanceDesc: t("hr.attendanceDesc"),
    addAttendance: t("hr.addAttendance"),
    date: t("hr.date"),
    status: t("hr.status"),
    clockIn: t("hr.clockIn"),
    clockOut: t("hr.clockOut"),
    workedHours: t("hr.workedHours"),
    overtimeHours: t("hr.overtimeHours"),
    noAttendance: t("hr.noAttendance"),
    filterFrom: t("hr.filterFrom"),
    filterTo: t("hr.filterTo"),
    refresh: t("hr.refresh"),
    assignmentsTitle: t("hr.assignmentsTitle"),
    assignmentsDesc: t("hr.assignmentsDesc"),
    productionOrder: t("hr.productionOrder"),
    noProductionOrder: t("hr.noProductionOrder"),
    orderNo: t("hr.orderNo"),
    hours: t("hr.hours"),
    saveAssignment: t("hr.saveAssignment"),
    noAssignments: t("hr.noAssignments"),
    laborCost: t("hr.laborCost"),
    totalLaborCost: t("hr.totalLaborCost"),
    payrollTitle: t("hr.payrollTitle"),
    payrollDesc: t("hr.payrollDesc"),
    payrollMonth: t("hr.payrollMonth"),
    regularPay: t("hr.regularPay"),
    totalPayroll: t("hr.totalPayroll"),
    totalPay: t("hr.totalPay"),
    absentDays: t("hr.absentDays"),
    leaveDays: t("hr.leaveDays"),
    loading: t("hr.loading"),
    loadError: t("hr.loadError"),
  };

  return (
    <div className="mx-auto max-w-7xl">
      <HrManager
          initialEmployees={employees.map(serializeEmployee)}
          initialSummary={summary}
          productionOrders={productionOrders.map((o) => ({
            id: o.id,
            productionNo: o.productionNo,
            orderNo: o.order?.orderNo ?? null,
            status: o.status,
          }))}
          canCreate={canCreate}
          canEdit={canEdit}
          labels={labels}
        />
    </div>
  );
}
