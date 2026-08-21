import type { Prisma, PrismaClient } from "@prisma/client";

import { fetchCorreiosTracking } from "@/lib/correios/client";
import { isCorreiosTrackingCode, normalizeTrackingNo } from "@/lib/correios/code";
import { trackingToShipmentStatus } from "@/lib/correios/map";
import type { TrackingSnapshot } from "@/lib/correios/types";

import { canTransitionShipment, type ShipmentStatus } from "./constants";
import { shipmentInclude } from "./serialize";

type Db = PrismaClient | Prisma.TransactionClient;

function snapshotStatusPatch(
  currentStatus: string,
  snapshot: TrackingSnapshot,
): { status?: ShipmentStatus; actualDelivery?: Date } {
  const mapped = trackingToShipmentStatus(snapshot.status);
  if (!mapped) return {};

  const from = currentStatus as ShipmentStatus;
  if (mapped === "delivered" && canTransitionShipment(from, "delivered")) {
    const deliveredAt = snapshot.events[0]?.at ? new Date(snapshot.events[0].at) : new Date();
    return {
      status: "delivered",
      actualDelivery: Number.isNaN(deliveredAt.getTime()) ? new Date() : deliveredAt,
    };
  }
  if (mapped === "returned" && canTransitionShipment(from, "returned")) {
    return { status: "returned" };
  }
  if (mapped === "issue" && canTransitionShipment(from, "issue")) {
    return { status: "issue" };
  }
  return {};
}

export async function refreshShipmentTracking(db: Db, id: string) {
  const existing = await db.shipment.findUnique({
    where: { id },
    select: { id: true, trackingNo: true, status: true },
  });
  if (!existing) return null;

  const code = existing.trackingNo?.trim() ?? "";
  if (!code) {
    throw new Error("Önce takip kodunu kaydedin.");
  }
  if (!isCorreiosTrackingCode(code)) {
    throw new Error("Geçerli bir Correios takip kodu girin (13 karakter, örn. AA123456789BR).");
  }

  const snapshot = await fetchCorreiosTracking(code);
  const statusPatch = snapshotStatusPatch(existing.status, snapshot);

  return db.shipment.update({
    where: { id },
    data: {
      trackingNo: snapshot.code,
      trackingLastCheckedAt: new Date(snapshot.checkedAt),
      trackingStatus: snapshot.status,
      trackingStatusText: snapshot.statusText,
      trackingExpectedAt: snapshot.expectedAt ? new Date(snapshot.expectedAt) : null,
      trackingService: snapshot.service,
      trackingEvents: snapshot.events as unknown as Prisma.InputJsonValue,
      trackingError: null,
      ...statusPatch,
    },
    include: shipmentInclude,
  });
}

export async function saveShipmentTrackingError(db: Db, id: string, message: string) {
  return db.shipment.update({
    where: { id },
    data: {
      trackingLastCheckedAt: new Date(),
      trackingError: message,
    },
    include: shipmentInclude,
  });
}

export function trackingCacheClearData(nextCode: string | null, previousCode: string | null) {
  const normalized = nextCode?.trim() ? normalizeTrackingNo(nextCode) : null;
  const previous = previousCode?.trim() ? normalizeTrackingNo(previousCode) : null;
  if (normalized === previous) {
    return { trackingNo: normalized };
  }
  return {
    trackingNo: normalized,
    trackingLastCheckedAt: null,
    trackingStatus: null,
    trackingStatusText: null,
    trackingExpectedAt: null,
    trackingService: null,
    trackingEvents: [] as Prisma.InputJsonValue,
    trackingError: null,
  };
}
