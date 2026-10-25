import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") return NextResponse.next();
  if (!request.cookies.has("unicircle_session")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  // This is only an early redirect. The server layout verifies the live session.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/directory/:path*",
    "/campus-explorer/:path*",
    "/clubs/:path*",
    "/events/:path*",
    "/resources/:path*",
    "/chat/:path*",
    "/transport/:path*",
    "/forum/:path*",
    "/news/:path*",
    "/assistant/:path*",
    "/profile/:path*",
    "/notifications/:path*",
    "/admin/:path*",
  ],
};
