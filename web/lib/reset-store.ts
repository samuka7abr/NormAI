type OTPEntry = { code: string; expiresAt: number; attempts: number };
type TokenEntry = { email: string; expiresAt: number; used: boolean };
type RateLimitEntry = { count: number; windowStart: number };

const otpStore = new Map<string, OTPEntry>();
const tokenStore = new Map<string, TokenEntry>();
const rateLimitStore = new Map<string, RateLimitEntry>();

const OTP_TTL = 10 * 60 * 1000;
const TOKEN_TTL = 15 * 60 * 1000;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 3;
const MAX_OTP_ATTEMPTS = 3;

export function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(email);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitStore.set(email, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

export function setOTP(email: string, code: string) {
  otpStore.set(email, { code, expiresAt: Date.now() + OTP_TTL, attempts: 0 });
}

export function verifyOTP(email: string, code: string): { valid: boolean; error?: string } {
  const entry = otpStore.get(email);
  if (!entry || Date.now() > entry.expiresAt) {
    otpStore.delete(email);
    return { valid: false, error: "Código inválido ou expirado." };
  }
  entry.attempts++;
  if (entry.attempts > MAX_OTP_ATTEMPTS) {
    otpStore.delete(email);
    return { valid: false, error: "Muitas tentativas. Solicite um novo código." };
  }
  if (entry.code !== code) return { valid: false, error: "Código incorreto." };
  otpStore.delete(email);
  return { valid: true };
}

export function setResetToken(token: string, email: string) {
  tokenStore.set(token, { email, expiresAt: Date.now() + TOKEN_TTL, used: false });
}

export function consumeResetToken(token: string): { valid: boolean; email?: string; error?: string } {
  const entry = tokenStore.get(token);
  if (!entry) return { valid: false, error: "Token inválido." };
  if (Date.now() > entry.expiresAt) {
    tokenStore.delete(token);
    return { valid: false, error: "Token expirado." };
  }
  if (entry.used) return { valid: false, error: "Token já utilizado." };
  tokenStore.delete(token);
  return { valid: true, email: entry.email };
}
