import { isCorreiosTrackingCode, normalizeTrackingNo } from "./code";
import {
  CorreiosApiError,
  CorreiosNotConfiguredError,
  getCorreiosConfig,
  isCorreiosConfigured,
} from "./config";
import { inferTrackingStatus, mapCorreiosEvent } from "./map";
import { getCorreiosToken, clearCorreiosTokenCache } from "./token";
import type { CorreiosSroRaw, TrackingSnapshot } from "./types";

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const row = payload as Record<string, unknown>;
  if (Array.isArray(row.msgs) && row.msgs.length > 0) return row.msgs.map(String).join(" ");
  if (typeof row.msgs === "string" && row.msgs.trim()) return row.msgs;
  if (typeof row.message === "string" && row.message.trim()) return row.message;
  return fallback;
}

export async function fetchCorreiosTracking(rawCode: string): Promise<TrackingSnapshot> {
  if (!isCorreiosConfigured()) {
    throw new CorreiosNotConfiguredError();
  }

  const code = normalizeTrackingNo(rawCode);
  if (!isCorreiosTrackingCode(code)) {
    throw new CorreiosApiError(
      "Geçerli bir Correios takip kodu girin (13 karakter, örn. AA123456789BR).",
      400,
    );
  }

  const config = getCorreiosConfig();
  const url = `${config.apiBase}/srorastro/v1/objetos/${encodeURIComponent(code)}?resultado=T`;

  const request = async (token: string) =>
    fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

  let token = await getCorreiosToken();
  let res = await request(token);

  if (res.status === 401) {
    clearCorreiosTokenCache();
    token = await getCorreiosToken();
    res = await request(token);
  }

  const payload = (await res.json().catch(() => null)) as CorreiosSroRaw | null;

  if (!res.ok) {
    throw new CorreiosApiError(
      readErrorMessage(payload, "Correios kargo durumu alınamadı."),
      res.status >= 500 ? 502 : res.status,
    );
  }

  const objeto = payload?.objetos?.[0];
  if (!objeto) {
    throw new CorreiosApiError("Correios bu kod için kayıt döndürmedi.", 404);
  }
  if (objeto.mensagem && !objeto.eventos?.length) {
    throw new CorreiosApiError(objeto.mensagem, 404);
  }

  const events = (objeto.eventos ?? [])
    .map(mapCorreiosEvent)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const status = inferTrackingStatus(events);
  const statusText = events[0]?.description || objeto.mensagem || "Durum bilgisi yok";
  const service =
    objeto.tipoPostal?.categoria?.trim() ||
    objeto.tipoPostal?.descricao?.trim() ||
    null;
  const expectedAt =
    typeof objeto.dtPrevista === "string" && !Number.isNaN(Date.parse(objeto.dtPrevista))
      ? new Date(objeto.dtPrevista).toISOString()
      : null;

  return {
    code,
    status,
    statusText,
    expectedAt,
    service,
    events,
    checkedAt: new Date().toISOString(),
  };
}
