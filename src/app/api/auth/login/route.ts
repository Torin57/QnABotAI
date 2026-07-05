import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, verifyAdminPassword, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";
import { createFailedAttemptGuard } from "@/lib/rate-limit";

// 5 неудачных попыток → блокировка на 15 минут (in-memory, ключ — IP)
const loginGuard = createFailedAttemptGuard({
  maxFailures: 5,
  lockoutMs: 15 * 60 * 1000,
});

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request);

  if (loginGuard.isBlocked(ip)) {
    return NextResponse.json(
      { error: "Слишком много неудачных попыток. Попробуйте через 15 минут." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!password) {
    return NextResponse.json({ error: "Введите пароль" }, { status: 400 });
  }

  const isValid = await verifyAdminPassword(password);
  if (!isValid) {
    loginGuard.recordFailure(ip);
    return NextResponse.json({ error: "Неверный пароль" }, { status: 401 });
  }

  loginGuard.reset(ip);

  const token = await createSessionToken();

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
