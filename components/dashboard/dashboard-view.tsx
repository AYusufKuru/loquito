import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DashboardSnapshot } from "@/lib/dashboard/types";
import { formatBrlFromCents } from "@/lib/stock/constants";

interface DashboardViewProps {
  data: DashboardSnapshot;
  labels: Record<string, string>;
}

function AlertList({
  alerts,
  empty,
}: {
  alerts: DashboardSnapshot["criticalAlerts"];
  empty: string;
}) {
  if (alerts.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="space-y-2">
      {alerts.map((a, i) => (
        <li key={i}>
          {a.href ? (
            <Link
              href={a.href}
              className="flex items-start gap-2 rounded-md border p-2 text-sm hover:bg-muted/50"
            >
              <Badge
                variant={
                  a.severity === "high" ? "destructive" : "secondary"
                }
                className="shrink-0"
              >
                {a.severity === "high" ? "!" : "•"}
              </Badge>
              <span>{a.message}</span>
            </Link>
          ) : (
            <div className="flex items-start gap-2 rounded-md border p-2 text-sm">
              <Badge variant="secondary">{a.type}</Badge>
              <span>{a.message}</span>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export function DashboardView({ data, labels }: DashboardViewProps) {
  return (
    <div className="space-y-6">
      {data.criticalAlerts.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{labels.criticalAlerts}</CardTitle>
            <CardDescription>{labels.criticalAlertsDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <AlertList alerts={data.criticalAlerts} empty={labels.noAlerts} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{labels.pendingApproval}</CardDescription>
            <CardTitle className="text-3xl">
              {data.orderCounts.pendingApproval}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{labels.inProduction}</CardDescription>
            <CardTitle className="text-3xl">
              {data.orderCounts.inProduction}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{labels.readyToShip}</CardDescription>
            <CardTitle className="text-3xl">
              {data.orderCounts.readyToShip}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{labels.delayedOrders}</CardDescription>
            <CardTitle className="text-3xl text-destructive">
              {data.orderCounts.delayed}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{labels.monthlyFinance}</CardTitle>
            <CardDescription>
              {data.monthlyFinance.periodMonth}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-muted-foreground">{labels.revenue}</p>
              <p className="text-lg font-semibold">
                {formatBrlFromCents(data.monthlyFinance.revenueCents)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{labels.productionCost}</p>
              <p className="text-lg font-semibold">
                {formatBrlFromCents(data.monthlyFinance.productionCostCents)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{labels.fixedExpenses}</p>
              <p className="text-lg font-semibold">
                {formatBrlFromCents(data.monthlyFinance.fixedExpenseCents)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{labels.netProfit}</p>
              <p className="text-lg font-semibold">
                {formatBrlFromCents(data.monthlyFinance.profitCents)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{labels.dailyProduction}</CardTitle>
            <CardDescription>{labels.dailyProductionDesc}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-muted-foreground">{labels.producedUnits}</p>
              <p className="text-lg font-semibold">{data.todayProducedUnits}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{labels.producedKg}</p>
              <p className="text-lg font-semibold">{data.todayProducedKg} kg</p>
            </div>
            <div>
              <p className="text-muted-foreground">{labels.activeEmployees}</p>
              <p className="text-lg font-semibold">
                {data.hr.presentToday}/{data.hr.activeEmployees}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{labels.onAssignment}</p>
              <p className="text-lg font-semibold">
                {data.hr.onAssignmentToday}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{labels.cookersTitle}</CardTitle>
          <CardDescription>{labels.cookersDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {data.cookers.map((c) => (
              <div key={c.lineCode} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{c.lineName}</span>
                  <Badge variant={c.status === "running" ? "default" : "outline"}>
                    {c.statusLabel}
                  </Badge>
                </div>
                {c.orderNo ? (
                  <p className="mt-2 text-muted-foreground">
                    {c.orderNo} · {c.stage ?? "—"} ({c.progressPercent}%)
                  </p>
                ) : (
                  <p className="mt-2 text-muted-foreground">{labels.noActiveOrder}</p>
                )}
                {c.hasDowntime && (
                  <Badge variant="destructive" className="mt-2">
                    {labels.downtime}
                  </Badge>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
            {data.cuttingLine && (
              <div className="rounded-lg border p-3">
                <p className="font-medium">{data.cuttingLine.lineName}</p>
                <p className="text-muted-foreground">
                  {data.cuttingLine.dailyProducedUnits} /{" "}
                  {data.cuttingLine.dailyTargetUnits} {labels.unitsShort} (
                  {data.cuttingLine.progressPercent}%)
                </p>
              </div>
            )}
            {data.packagingLine && (
              <div className="rounded-lg border p-3">
                <p className="font-medium">{data.packagingLine.lineName}</p>
                <p className="text-muted-foreground">
                  {data.packagingLine.dailyProducedUnits} /{" "}
                  {data.packagingLine.dailyTargetUnits} {labels.unitsShort} (
                  {data.packagingLine.progressPercent}%)
                </p>
              </div>
            )}
          </div>
          <Link
            href="/production"
            className="mt-3 text-sm text-primary underline"
          >
            {labels.viewProduction}
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{labels.upcomingDeliveries}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {data.upcomingDeliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground">{labels.noItems}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2">{labels.orderNo}</th>
                    <th className="py-2">{labels.customer}</th>
                    <th className="py-2">{labels.deliveryDate}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.upcomingDeliveries.map((o) => (
                    <tr key={o.id} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs">{o.orderNo}</td>
                      <td className="py-2">{o.customerName}</td>
                      <td className="py-2">
                        {o.deliveryDate?.slice(0, 10) ?? "—"}
                        {o.daysUntilDelivery != null && (
                          <span className="text-xs text-muted-foreground">
                            ({o.daysUntilDelivery}g)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{labels.paymentDue}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {data.overduePayments.length === 0 &&
            data.upcomingPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{labels.noItems}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2">{labels.orderNo}</th>
                    <th className="py-2">{labels.amount}</th>
                    <th className="py-2">{labels.dueDate}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.overduePayments.map((p) => (
                    <tr key={`o-${p.orderNo}`} className="border-b">
                      <td className="py-2 font-mono text-xs">{p.orderNo}</td>
                      <td className="py-2">
                        {formatBrlFromCents(p.amountCents)}
                      </td>
                      <td className="py-2 text-destructive">
                        {p.dueDate} ({p.daysUntilDue}g)
                      </td>
                    </tr>
                  ))}
                  {data.upcomingPayments.map((p) => (
                    <tr key={`u-${p.orderNo}`} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs">{p.orderNo}</td>
                      <td className="py-2">
                        {formatBrlFromCents(p.amountCents)}
                      </td>
                      <td className="py-2">{p.dueDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Link href="/finance" className="mt-3 text-sm text-primary underline">
              {labels.viewFinance}
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{labels.stockAlerts}</CardTitle>
          </CardHeader>
          <CardContent>
            <AlertList alerts={data.stockAlerts} empty={labels.noAlerts} />
            <Link href="/stock" className="mt-3 text-sm text-primary underline">
              {labels.viewStock}
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{labels.finishedStock}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-muted-foreground">{labels.availableUnits}</p>
              <p className="text-lg font-semibold">
                {data.finishedStock.availableUnits}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{labels.reservedUnits}</p>
              <p className="text-lg font-semibold">
                {data.finishedStock.reservedUnits}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{labels.stockValue}</p>
              <p className="text-lg font-semibold">
                {formatBrlFromCents(data.finishedStock.totalValueCents)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{labels.expiringSoon}</p>
              <p className="text-lg font-semibold">
                {data.finishedStock.expiringSoonCount}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{labels.aiRecommendations}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.aiRecommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {labels.noAiRecommendations}
            </p>
          ) : (
            <ul className="space-y-2">
              {data.aiRecommendations.map((r) => (
                <li key={r.id}>
                  {r.href ? (
                    <Link
                      href={r.href}
                      className="block rounded-md border p-3 text-sm hover:bg-muted/50"
                    >
                      <div className="flex items-start gap-2">
                        <Badge
                          variant={
                            r.severity === "high" ? "destructive" : "secondary"
                          }
                          className="shrink-0"
                        >
                          {r.severity === "high" ? "!" : "•"}
                        </Badge>
                        <div>
                          <p className="font-medium">{r.title}</p>
                          <p className="text-muted-foreground">{r.summary}</p>
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <div className="rounded-md border p-3 text-sm">
                      <p className="font-medium">{r.title}</p>
                      <p className="text-muted-foreground">{r.summary}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Link href="/ai" className="mt-3 text-sm text-primary underline">
            {labels.viewAi}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
