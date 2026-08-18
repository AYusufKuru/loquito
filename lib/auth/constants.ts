export const AUTH_COOKIE_NAME = "loquito_session";

/** Oturum süresi: 7 gün */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export const PUBLIC_PATHS = ["/", "/login"] as const;

export const AUTH_API_PATHS = ["/api/auth/login", "/api/auth/logout"] as const;
