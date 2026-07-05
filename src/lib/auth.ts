/**
 * Простая парольная авторизация для единственного админа (пилот на одного преподавателя).
 * Сессия — подписанный cookie-токен (HMAC-SHA256), без хранения сессий на сервере.
 * Реализовано через Web Crypto API, чтобы работать одинаково в Node и в Edge-рантайме мидлвари.
 */

export const SESSION_COOKIE_NAME = "admin_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 год

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET не задан в .env");
  }
  return secret;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return base64UrlEncode(new Uint8Array(signature));
}

/** Создаёт подписанный сессионный токен со сроком действия `SESSION_MAX_AGE_SECONDS`. */
export async function createSessionToken(): Promise<string> {
  const secret = getSessionSecret();
  const payload = JSON.stringify({ exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 });
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(payload));
  const signature = await hmacSign(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

/** Проверяет подпись и срок действия сессионного токена из cookie. */
export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) return false;

  try {
    const secret = getSessionSecret();
    const expectedSignature = await hmacSign(payloadB64, secret);
    if (expectedSignature !== signature) return false;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64))) as { exp: number };
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}

/**
 * Сравнивает введённый пароль с bcrypt-хешем из `.env` (`ADMIN_PASSWORD_HASH_BASE64`).
 * Хеш хранится в base64: символы `$` внутри обычного bcrypt-хеша Next.js интерпретирует
 * как ссылки на переменные окружения (`$2b`, `$10`, ...) и портит значение при загрузке `.env`.
 */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  const hashBase64 = process.env.ADMIN_PASSWORD_HASH_BASE64;
  if (!hashBase64) {
    throw new Error("ADMIN_PASSWORD_HASH_BASE64 не задан в .env");
  }
  const hash = atob(hashBase64);
  const bcrypt = await import("bcryptjs");
  return bcrypt.compare(password, hash);
}
