import type { CorreiosEventRaw, TrackingEvent, TrackingStatus } from "./types";

const DELIVERED_CODES = new Set(["BDE", "BDI", "BDR"]);

function textOf(event: Pick<TrackingEvent, "description" | "detail">): string {
  return `${event.description} ${event.detail ?? ""}`.toLowerCase();
}

export function mapCorreiosEvent(raw: CorreiosEventRaw): TrackingEvent {
  return {
    at: typeof raw.dtHrCriado === "string" ? raw.dtHrCriado : new Date().toISOString(),
    code: (raw.codigo ?? "").trim(),
    type: (raw.tipo ?? "").trim(),
    description: (raw.descricao ?? "").trim() || "Güncelleme",
    detail: raw.detalhe?.trim() || null,
    city: raw.unidade?.endereco?.cidade?.trim() || null,
    uf: raw.unidade?.endereco?.uf?.trim() || null,
    unitType: raw.unidade?.tipo?.trim() || null,
  };
}

export function inferTrackingStatus(events: TrackingEvent[]): TrackingStatus {
  const latest = events[0];
  if (!latest) return "unknown";

  const hay = textOf(latest);
  const code = latest.code.toUpperCase();
  const type = latest.type;

  if (
    (DELIVERED_CODES.has(code) && type === "01") ||
    hay.includes("entregue ao destinat") ||
    hay.includes("objeto entregue")
  ) {
    return "delivered";
  }
  if (
    hay.includes("devolvido") ||
    hay.includes("devolução") ||
    hay.includes("devolucao") ||
    (DELIVERED_CODES.has(code) && (type === "20" || type === "21" || type === "26"))
  ) {
    return "returned";
  }
  if (
    hay.includes("extraviado") ||
    hay.includes("apreendido") ||
    hay.includes("avaria") ||
    hay.includes("não autorizado") ||
    hay.includes("nao autorizado")
  ) {
    return "issue";
  }
  if (
    hay.includes("aguardando retirada") ||
    hay.includes("disponível para retirada") ||
    hay.includes("disponivel para retirada") ||
    code === "LDI"
  ) {
    return "waiting_pickup";
  }
  if (
    hay.includes("saiu para entrega") ||
    hay.includes("rota de entrega") ||
    hay.includes("em rota de entrega") ||
    code === "OEC"
  ) {
    return "out_for_delivery";
  }
  if (
    hay.includes("postado") ||
    code === "PO" ||
    code === "PCO"
  ) {
    return events.length > 1 ? "in_transit" : "posted";
  }
  if (
    hay.includes("trânsito") ||
    hay.includes("transito") ||
    hay.includes("encaminhado") ||
    code === "RO" ||
    code === "DO"
  ) {
    return "in_transit";
  }

  return "in_transit";
}

/** CRM sevkiyat durumuna eşleme — yalnızca yola çıkmış kayıtlar için. */
export function trackingToShipmentStatus(
  status: TrackingStatus,
): "delivered" | "returned" | "issue" | "in_transit" | null {
  if (status === "delivered") return "delivered";
  if (status === "returned") return "returned";
  if (status === "issue") return "issue";
  if (status === "in_transit" || status === "out_for_delivery" || status === "waiting_pickup") {
    return "in_transit";
  }
  return null;
}
