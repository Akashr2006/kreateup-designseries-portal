import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth-shared";

/**
 * Edge-side gate.
 *
 * This only checks that a session cookie is *present* — the signature is
 * verified, and the account re-read from the database, in the (portal) layout.
 * Doing the cheap check here saves a full server render for anonymous traffic;
 * doing the real check there keeps Prisma out of the edge runtime.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login" && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!hasSession && !pathname.startsWith("/login")) {
    const url = new URL("/login", request.url);
    // Remember where they were headed so the sign-in can bounce them back.
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /**
     * Everything except Next internals, the API (which returns JSON 401s of its
     * own) and static assets.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)",
  ],
};
