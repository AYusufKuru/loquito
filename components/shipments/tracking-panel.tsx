"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { isCorreiosTrackingCode } from "@/lib/correios/code";
import type { TrackingStatus } from "@/lib/correios/types";
import type { SerializedShipment } from "@/lib/shipments/serialize";

interface TrackingPanelProps {
  shipment: SerializedShipment;
  draftTrackingNo: string;
  configured: boolean;
  loading: boolean;
  labels: Record<string, string>;
  onRefresh: () => void;
}

function trackingStatusLabel(
  status: TrackingStatus | null,
  labels: Record<string, string>,
): string {
  if (!status) return labels.trackingStatusUnknown;
  const map: Record<TrackingStatus, string> = {
    posted: labels.trackingStatusPosted,
    in_transit: labels.trackingStatusInTransit,
    out_for_delivery: labels.trackingStatusOutForDelivery,
    waiting_pickup: labels.trackingStatusWaitingPickup,
    delivered: labels.trackingStatusDelivered,
    returned: labels.trackingStatusReturned,
    issue: labels.trackingStatusIssue,
    unknown: labels.trackingStatusUnknown,
  };
  return map[status] ?? status;
}

function trackingVariant(
  status: TrackingStatus | null,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "delivered") return "default";
  if (status === "issue" || status === "returned") return "destructive";
  if (status === "out_for_delivery" || status === "waiting_pickup" || status === "in_transit") {
    return "secondary";
  }
  return "outline";
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function eventPlace(city: string | null, uf: string | null, unitType: string | null): string {
  const loc = [city, uf].filter(Boolean).join("/");
  return [loc, unitType].filter(Boolean).join(" · ");
}

export function TrackingPanel({
  shipment,
  draftTrackingNo,
  configured,
  loading,
  labels,
  onRefresh,
}: TrackingPanelProps) {
  const code = draftTrackingNo.trim() || shipment.trackingNo?.trim() || "";
  const hasCode = Boolean(code);
  const codeOk = hasCode && isCorreiosTrackingCode(code);
  const canRefresh = configured && codeOk && !loading;

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{labels.trackingTitle}</p>
        <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={!canRefresh}>
          {loading ? labels.trackingRefreshing : labels.trackingRefresh}
        </Button>
      </div>

      {!configured && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {labels.trackingNotConfigured}
        </p>
      )}

      {hasCode && !codeOk && (
        <p className="text-xs text-destructive">{labels.trackingInvalidCode}</p>
      )}

      {!hasCode && <p className="text-xs text-muted-foreground">{labels.trackingNoCode}</p>}

      {shipment.trackingStatus && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={trackingVariant(shipment.trackingStatus)}>
            {trackingStatusLabel(shipment.trackingStatus, labels)}
          </Badge>
          {shipment.trackingService && (
            <span className="text-xs text-muted-foreground">{shipment.trackingService}</span>
          )}
        </div>
      )}

      {shipment.trackingStatusText && (
        <p className="text-sm">{shipment.trackingStatusText}</p>
      )}

      <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        {shipment.trackingExpectedAt && (
          <p>
            {labels.trackingExpected}: {formatDateTime(shipment.trackingExpectedAt)}
          </p>
        )}
        {shipment.trackingLastCheckedAt && (
          <p>
            {labels.trackingLastChecked}: {formatDateTime(shipment.trackingLastCheckedAt)}
          </p>
        )}
      </div>

      {shipment.trackingError && (
        <p className="text-xs text-destructive">{shipment.trackingError}</p>
      )}

      {shipment.trackingEvents.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">{labels.trackingTimeline}</p>
          <ol className="space-y-2 border-l pl-3">
            {shipment.trackingEvents.map((event, index) => (
              <li key={`${event.at}-${event.code}-${index}`} className="text-sm">
                <p className="font-medium">{event.description}</p>
                {event.detail && (
                  <p className="text-xs text-muted-foreground">{event.detail}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(event.at)}
                  {eventPlace(event.city, event.uf, event.unitType)
                    ? ` · ${eventPlace(event.city, event.uf, event.unitType)}`
                    : ""}
                </p>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        hasCode &&
        codeOk &&
        !shipment.trackingError && (
          <p className="text-xs text-muted-foreground">{labels.trackingNoEvents}</p>
        )
      )}
    </div>
  );
}

export function listTrackingBadgeLabel(
  status: TrackingStatus | null,
  labels: Record<string, string>,
): string | null {
  if (!status) return null;
  return trackingStatusLabel(status, labels);
}

export function listTrackingBadgeVariant(
  status: TrackingStatus | null,
): "default" | "secondary" | "destructive" | "outline" {
  return trackingVariant(status);
}
