import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isAuthenticated = await verifySessionToken(token);

  if (isAuthenticated) {
    return NextResponse.next();
  }

  const isApiRequest = pathname.startsWith("/api/");
  if (isApiRequest) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const loginUrl = new URL("/admin/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/admin/qna/:path*",
    "/admin/log/:path*",
    "/admin",
    "/api/qna/:path*",
    "/api/log/:path*",
    "/api/settings/:path*",
  ],
};
