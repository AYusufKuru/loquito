export type CorreiosEnv = "production" | "homolog";

export interface CorreiosConfig {
  user: string;
  apiCode: string;
  contract: string;
  postcard: string;
  dr: number | null;
  env: CorreiosEnv;
  apiBase: string;
}

function parseDr(raw: string | undefined): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function getCorreiosConfig(): CorreiosConfig {
  const env: CorreiosEnv =
    process.env.CORREIOS_ENV?.trim().toLowerCase() === "homolog"
      ? "homolog"
      : "production";

  return {
    user: process.env.CORREIOS_USER?.trim() ?? "",
    apiCode: process.env.CORREIOS_API_CODE?.trim() ?? "",
    contract: process.env.CORREIOS_CONTRACT?.trim() ?? "",
    postcard: process.env.CORREIOS_POSTCARD?.trim() ?? "",
    dr: parseDr(process.env.CORREIOS_DR),
    env,
    apiBase:
      env === "homolog"
        ? "https://apihom.correios.com.br"
        : "https://api.correios.com.br",
  };
}

export function isCorreiosConfigured(): boolean {
  const { user, apiCode } = getCorreiosConfig();
  return Boolean(user && apiCode);
}

export class CorreiosNotConfiguredError extends Error {
  constructor() {
    super(
      "Correios API bilgileri tanımlı değil. CORREIOS_USER ve CORREIOS_API_CODE ortam değişkenlerini ekleyin.",
    );
    this.name = "CorreiosNotConfiguredError";
  }
}

export class CorreiosApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "CorreiosApiError";
    this.status = status;
  }
}
