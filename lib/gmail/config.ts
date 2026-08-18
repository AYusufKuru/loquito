export function getGmailConfig() {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";

  return {
    clientId: process.env.GMAIL_CLIENT_ID ?? "",
    clientSecret: process.env.GMAIL_CLIENT_SECRET ?? "",
    redirectUri:
      process.env.GMAIL_REDIRECT_URI ?? `${appUrl}/api/ai/gmail/callback`,
    scopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
  };
}

export function isGmailConfigured(): boolean {
  const { clientId, clientSecret } = getGmailConfig();
  return Boolean(clientId && clientSecret);
}

export const GMAIL_QUERY =
  "in:inbox has:attachment (pedido OR order OR sipariş OR proposta OR formulário)";
