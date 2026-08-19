"use client";

import { apiFetch } from "@/lib/http";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { useFormErrors } from "@/hooks/use-form-errors";
import { validateCustomerId } from "@/lib/forms/finance-validation";
import type { CustomerStatement } from "@/lib/finance/statements";
import { formatBrlFromCents } from "@/lib/stock/constants";

interface StatementsSectionProps {
  customers: Array<{ id: string; name: string }>;
  labels: Record<string, string>;
}

export function StatementsSection({
  customers,
  labels,
}: StatementsSectionProps) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [statement, setStatement] = useState<CustomerStatement | null>(null);
  const [loading, setLoading] = useState(false);
  const {
    fieldError,
    clearErrors,
    clearFieldError,
    showApiError,
    showError,
    applyValidationErrors,
    ErrorModal,
  } = useFormErrors();

  const load = useCallback(async () => {
    if (!applyValidationErrors(validateCustomerId(customerId))) return;

    setLoading(true);
    clearErrors();
    try {
      const res = await apiFetch(`/api/finance/statements/${customerId}`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.loadError);
        return;
      }
      setStatement(data.statement);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }, [customerId, clearErrors, labels.connectionError, labels.loadError, showApiError, showError, applyValidationErrors]);

  function printStatement() {
    window.print();
  }

  return (
    <>
      {ErrorModal}
      <Card className="print-area">
      <CardHeader>
        <CardTitle className="text-base">{labels.statementTitle}</CardTitle>
        <CardDescription>{labels.statementDesc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <FormField label={labels.customer} error={fieldError("customerId")} required>
            <select
              className="mt-1 rounded-md border bg-background px-3 py-2 text-sm min-w-[240px]"
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                clearFieldError("customerId");
              }}
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </FormField>
          <Button variant="outline" onClick={load} disabled={loading}>
            {labels.loadStatement}
          </Button>
          {statement && (
            <Button variant="outline" onClick={printStatement}>
              {labels.exportPdf}
            </Button>
          )}
        </div>

        {statement && (
          <>
            <div className="grid gap-3 sm:grid-cols-3 text-sm">
              <div>
                <p className="text-muted-foreground">{labels.totalDebit}</p>
                <p className="text-lg font-semibold">
                  {formatBrlFromCents(statement.totalDebitCents)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{labels.totalCredit}</p>
                <p className="text-lg font-semibold">
                  {formatBrlFromCents(statement.totalCreditCents)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{labels.balance}</p>
                <p className="text-lg font-semibold">
                  {formatBrlFromCents(statement.balanceCents)}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="px-3 py-2">{labels.date}</th>
                    <th className="px-3 py-2">{labels.reference}</th>
                    <th className="px-3 py-2">{labels.descriptionCol}</th>
                    <th className="px-3 py-2">{labels.debit}</th>
                    <th className="px-3 py-2">{labels.credit}</th>
                    <th className="px-3 py-2">{labels.balance}</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.lines.map((line, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-3 py-2">{line.date.slice(0, 10)}</td>
                      <td className="px-3 py-2 font-mono text-xs">{line.reference}</td>
                      <td className="px-3 py-2">{line.description}</td>
                      <td className="px-3 py-2">
                        {line.debitCents > 0
                          ? formatBrlFromCents(line.debitCents)
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {line.creditCents > 0
                          ? formatBrlFromCents(line.creditCents)
                          : "—"}
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {formatBrlFromCents(line.balanceCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
    </>
  );
}
