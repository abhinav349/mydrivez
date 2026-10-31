import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSessionToken } from "@/lib/auth/jwt";

/**
 * Edge gate: fast, optimistic redirects based on the signed session token.
 * Every page, server action and API route re-checks the session + role against the DB,
 * so this is a UX layer, never the only line of defence.
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const claims = await readSessionToken(req.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (!claims) return NextResponse.redirect(new URL("/admin/login", req.url));
    if (claims.role === "CUSTOMER") return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (pathname.startsWith("/dashboard") || pathname.startsWith("/book")) {
    if (!claims) {
      const url = new URL("/login", req.url);
      url.searchParams.set("next", pathname + search);
      return NextResponse.redirect(url);
    }
    if (claims.role !== "CUSTOMER") return NextResponse.redirect(new URL("/admin", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/book/:path*"],
};
