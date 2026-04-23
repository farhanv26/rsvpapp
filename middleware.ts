import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin-session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }

  // Mobile API routes use Bearer token auth handled in each route handler.
  if (pathname.startsWith("/admin/api/mobile/")) {
    return NextResponse.next();
  }

  const secret = process.env.ADMIN_AUTH_SECRET;
  if (!secret || secret.length < 16) {
    return new NextResponse("Admin auth is not configured (set ADMIN_AUTH_SECRET, 16+ characters).", {
      status: 503,
    });
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    const login = new URL("/admin/login", request.url);
    return NextResponse.redirect(login);
  }

  try {
    await verifyAdminSessionToken(token);
  } catch {
    const login = new URL("/admin/login", request.url);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
