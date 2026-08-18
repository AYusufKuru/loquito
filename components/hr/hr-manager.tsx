"use client";

import { useState } from "react";

import { EmployeesSection } from "@/components/hr/employees-section";
import { AttendanceSection } from "@/components/hr/attendance-section";
import { PayrollSection } from "@/components/hr/payroll-section";
import { WorkAssignmentsSection } from "@/components/hr/work-assignments-section";
import { cn } from "@/lib/utils";
import type { EmployeeRow, EmployeeSummary } from "@/lib/hr/types";

type Tab = "employees" | "attendance" | "assignments" | "payroll";

interface HrManagerProps {
  initialEmployees: EmployeeRow[];
  initialSummary: EmployeeSummary;
  productionOrders: Array<{
    id: string;
    productionNo: string;
    orderNo: string | null;
    status: string;
  }>;
  canCreate: boolean;
  canEdit: boolean;
  labels: Record<string, string>;
}

export function HrManager({
  initialEmployees,
  initialSummary,
  productionOrders,
  canCreate,
  canEdit,
  labels,
}: HrManagerProps) {
  const [tab, setTab] = useState<Tab>("employees");

  const tabs: { id: Tab; label: string }[] = [
    { id: "employees", label: labels.employeesTab },
    { id: "attendance", label: labels.attendanceTab },
    { id: "assignments", label: labels.assignmentsTab },
    { id: "payroll", label: labels.payrollTab },
  ];

  return (
    <div>
      <div className="flex gap-2 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "employees" && (
          <EmployeesSection
            initialEmployees={initialEmployees}
            initialSummary={initialSummary}
            canCreate={canCreate}
            canEdit={canEdit}
            labels={labels}
          />
        )}
        {tab === "attendance" && (
          <AttendanceSection
            employees={initialEmployees}
            canEdit={canEdit}
            labels={labels}
          />
        )}
        {tab === "assignments" && (
          <WorkAssignmentsSection
            employees={initialEmployees}
            productionOrders={productionOrders}
            canEdit={canEdit}
            labels={labels}
          />
        )}
        {tab === "payroll" && <PayrollSection labels={labels} />}
      </div>
    </div>
  );
}
