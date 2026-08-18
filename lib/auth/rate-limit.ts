interface Attempt {
  count: number;
  firstAt: number;
  blockedUntil: number;
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const BLOCK_MS = 15 * 60 * 1000;

/**
 * Süreç içi deneme sayacı. Tek örnekli kurulum için yeterli; yatay
 * ölçeklemede Redis gibi paylaşımlı bir sayaca taşınmalıdır.
 */
const attempts = new Map<string, Attempt>();

function prune(now: number): void {
  for (const [key, entry] of attempts) {
    if (now > entry.blockedUntil && now - entry.firstAt > WINDOW_MS) {
      attempts.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkLoginRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  prune(now);

  const entry = attempts.get(key);
  if (!entry) return { allowed: true, retryAfterSeconds: 0 };

  if (now < entry.blockedUntil) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((entry.blockedUntil - now) / 1000),
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordFailedLogin(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now, blockedUntil: 0 });
    return;
  }

  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = now + BLOCK_MS;
    entry.count = 0;
    entry.firstAt = now;
  }
}

export function clearLoginAttempts(key: string): void {
  attempts.delete(key);
}
