import {
  CorreiosApiError,
  CorreiosNotConfiguredError,
  getCorreiosConfig,
  isCorreiosConfigured,
} from "./config";

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cached: CachedToken | null = null;
let pending: Promise<string> | null = null;

const RENEW_BEFORE_MS = 5 * 60 * 1000;

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const row = payload as Record<string, unknown>;
  if (typeof row.msgs === "string" && row.msgs.trim()) return row.msgs;
  if (Array.isArray(row.msgs) && row.msgs.length > 0) {
    return row.msgs.map(String).join(" ");
  }
  if (typeof row.message === "string" && row.message.trim()) return row.message;
  if (typeof row.mensagem === "string" && row.mensagem.trim()) return row.mensagem;
  return fallback;
}

async function requestToken(): Promise<string> {
  if (!isCorreiosConfigured()) {
    throw new CorreiosNotConfiguredError();
  }

  const config = getCorreiosConfig();
  const basic = Buffer.from(`${config.user}:${config.apiCode}`).toString("base64");

  let path = "/token/v1/autentica";
  let body: string | undefined;
  if (config.postcard) {
    path = "/token/v1/autentica/cartaopostagem";
    body = JSON.stringify({
      numero: config.postcard,
      ...(config.contract ? { contrato: config.contract } : {}),
      ...(config.dr ? { dr: config.dr } : {}),
    });
  } else if (config.contract) {
    path = "/token/v1/autentica/contrato";
    body = JSON.stringify({
      numero: config.contract,
      ...(config.dr ? { dr: config.dr } : {}),
    });
  }

  const res = await fetch(`${config.apiBase}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  const payload: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const fallback =
      res.status === 401 || res.status === 403
        ? "Correios kimlik bilgileri geçersiz veya API erişimi yok."
        : "Correios token alınamadı.";
    throw new CorreiosApiError(readErrorMessage(payload, fallback), res.status >= 500 ? 502 : res.status);
  }

  const token =
    payload && typeof payload === "object" && typeof (payload as { token?: unknown }).token === "string"
      ? (payload as { token: string }).token
      : "";
  if (!token) {
    throw new CorreiosApiError("Correios token yanıtı beklenen formatta değil.");
  }

  const expiraEm =
    payload && typeof payload === "object"
      ? (payload as { expiraEm?: unknown }).expiraEm
      : undefined;
  const expiresAt =
    typeof expiraEm === "string" && !Number.isNaN(Date.parse(expiraEm))
      ? Date.parse(expiraEm)
      : Date.now() + 24 * 60 * 60 * 1000;

  cached = { token, expiresAt };
  return token;
}

export async function getCorreiosToken(): Promise<string> {
  if (cached && cached.expiresAt - Date.now() > RENEW_BEFORE_MS) {
    return cached.token;
  }
  if (!pending) {
    pending = requestToken().finally(() => {
      pending = null;
    });
  }
  return pending;
}

export function clearCorreiosTokenCache(): void {
  cached = null;
}
