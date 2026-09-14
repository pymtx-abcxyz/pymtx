import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

/**
 * Edge middleware — gate /admin and /business portals behind harbor_session.
 * API routes enforce role checks themselves (need DB). Client portal stays public (invite token).
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtectedPage =
    pathname.startsWith("/admin") || pathname.startsWith("/business");

  if (!isProtectedPage) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/business/:path*"],
};
