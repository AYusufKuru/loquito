import { getGmailConfig } from "./config";

export function buildGmailAuthUrl(state?: string): string {
  const { clientId, redirectUri, scopes } = getGmailConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
  });
  if (state) params.set("state", state);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string) {
  const { clientId, clientSecret, redirectUri } = getGmailConfig();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err =
      typeof data.error === "string"
        ? data.error
        : "Gmail yetkilendirme başarısız.";
    throw new Error(err);
  }

  return {
    accessToken: String(data.access_token ?? ""),
    refreshToken:
      typeof data.refresh_token === "string" ? data.refresh_token : null,
    expiresIn: Number(data.expires_in) || 3600,
    scope: typeof data.scope === "string" ? data.scope : null,
  };
}

export async function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = getGmailConfig();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error("Gmail token yenileme başarısız.");
  }

  return {
    accessToken: String(data.access_token ?? ""),
    expiresIn: Number(data.expires_in) || 3600,
  };
}

export async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const data = (await res.json()) as { email?: string };
  if (!res.ok || !data.email) {
    throw new Error("Gmail e-posta adresi alınamadı.");
  }
  return data.email;
}
