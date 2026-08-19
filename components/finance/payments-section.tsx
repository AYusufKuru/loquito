"use client";

import { apiFetch } from "@/lib/http";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/ui/form-field";
import { useFormErrors } from "@/hooks/use-form-errors";
import { validatePaymentForm } from "@/lib/forms/finance-validation";
import { sanitizeMoneyInput } from "@/lib/forms/validation";
import type { OrderPaymentRow } from "@/lib/finance/payments";
import { formatBrlFromCents, parseBrlToCents } from "@/lib/stock/constants";

interface PaymentsSectionProps {
  canCreate: boolean;
  canEdit: boolean;
  labels: Record<string, string>;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "secondary",
  partial: "default",
  pending: "outline",
  overdue: "destructive",
};

export function PaymentsSection({
  canCreate,
  canEdit,
  labels,
}: PaymentsSectionProps) {
  const [orders, setOrders] = useState<OrderPaymentRow[]>([]);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const {
    fieldError,
    clearErrors,
    clearFieldError,
    showApiError,
    showError,
    applyValidationErrors,
    ErrorModal,
  } = useFormErrors();
  const [payForm, setPayForm] = useState({
    orderId: "",
    amount: "",
    method: "transfer",
    reference: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    clearErrors();
    try {
      const q = overdueOnly ? "?overdueOnly=true" : "";
      const res = await apiFetch(`/api/finance/payments${q}`);
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.loadError);
        return;
      }
      setOrders(data.orders);
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }, [overdueOnly, labels.connectionError, labels.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  async function markPaid(order: OrderPaymentRow) {
    if (!canEdit) return;
    const paymentId = order.paymentIds[0];
    if (!paymentId) return;
    setLoading(true);
    clearErrors();
    try {
      const res = await apiFetch(`/api/finance/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markPaid: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.saveError);
        return;
      }
      setMessage(labels.paymentRecorded);
      await load();
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  async function recordPayment() {
    if (!canCreate) return;
    if (!applyValidationErrors(validatePaymentForm(payForm))) return;

    const cents = parseBrlToCents(payForm.amount);
    if (cents == null || cents <= 0) return;

    setLoading(true);
    clearErrors();
    try {
      const res = await apiFetch("/api/finance/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: payForm.orderId || null,
          amountCents: cents,
          method: payForm.method,
          reference: payForm.reference || null,
          markPaid: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, labels.saveError);
        return;
      }
      setMessage(labels.paymentRecorded);
      setPayForm({ orderId: "", amount: "", method: "transfer", reference: "" });
      await load();
    } catch {
      showError(labels.connectionError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {ErrorModal}
      <Card>
      <CardHeader>
        <CardTitle className="text-base">{labels.paymentsTitle}</CardTitle>
        <CardDescription>{labels.paymentsDesc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={load} disabled={loading}>
            {labels.refresh}
          </Button>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
            />
            {labels.overdueOnly}
          </label>
        </div>

        {message && <p className="text-sm text-green-600">{message}</p>}

        {canCreate && (
          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-medium">{labels.recordPayment}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label>{labels.orderNo}</Label>
                <select
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={payForm.orderId}
                  onChange={(e) => setPayForm({ ...payForm, orderId: e.target.value })}
                >
                  <option value="">{labels.selectOrder}</option>
                  {orders.map((o) => (
                    <option key={o.orderId} value={o.orderId}>
                      {o.orderNo} — {o.customerName}
                    </option>
                  ))}
                </select>
              </div>
              <FormField label={labels.amount} error={fieldError("amount")} required>
                <Input
                  className="mt-1"
                  value={payForm.amount}
                  onChange={(e) => {
                    setPayForm({ ...payForm, amount: sanitizeMoneyInput(e.target.value) });
                    clearFieldError("amount");
                  }}
                />
              </FormField>
              <div>
                <Label>{labels.method}</Label>
                <select
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={payForm.method}
                  onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
                >
                  <option value="transfer">{labels.methodTransfer}</option>
                  <option value="pix">{labels.methodPix}</option>
                </select>
              </div>
              <div>
                <Label>{labels.reference}</Label>
                <Input
                  className="mt-1"
                  value={payForm.reference}
                  onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
                />
              </div>
            </div>
            <Button onClick={recordPayment} disabled={loading}>
              {labels.recordPayment}
            </Button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-3 py-2">{labels.orderNo}</th>
                <th className="px-3 py-2">{labels.customer}</th>
                <th className="px-3 py-2">{labels.expected}</th>
                <th className="px-3 py-2">{labels.paid}</th>
                <th className="px-3 py-2">{labels.remaining}</th>
                <th className="px-3 py-2">{labels.dueDate}</th>
                <th className="px-3 py-2">{labels.status}</th>
                {canEdit && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {orders.map((row) => (
                <tr key={row.orderId} className="border-b last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{row.orderNo}</td>
                  <td className="px-3 py-2">{row.customerName}</td>
                  <td className="px-3 py-2">
                    {formatBrlFromCents(row.expectedCents)}
                    {row.discountPercent > 0 && (
                      <span className="text-xs text-muted-foreground">
                        (−{row.discountPercent}%)
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{formatBrlFromCents(row.paidCents)}</td>
                  <td className="px-3 py-2">{formatBrlFromCents(row.remainingCents)}</td>
                  <td className="px-3 py-2">
                    {row.dueDate?.slice(0, 10) ?? "—"}
                    {row.daysUntilDue != null && row.status !== "paid" && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({row.daysUntilDue}g)
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={STATUS_VARIANT[row.status] ?? "outline"}>
                      {labels[`status_${row.status}`] ?? row.status}
                    </Badge>
                  </td>
                  {canEdit && (
                    <td className="px-3 py-2">
                      {row.status !== "paid" && row.paymentIds[0] && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markPaid(row)}
                          disabled={loading}
                        >
                          {labels.markPaid}
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
    </>
  );
}
