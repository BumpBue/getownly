import { decodeJwt } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import { HOME_PATH_BY_ROLE, ROLES, type Role } from "@/lib/auth/types";

/**
 * Routing only. This decides which page shell a browser is sent to; it is not
 * a security boundary.
 *
 * The token is decoded, not verified: the signing secret belongs to the API
 * and is deliberately not duplicated into the web app. Every real decision —
 * who you are, what you may read, what you may change — is made by NestJS on
 * each request, so a forged cookie buys nothing but an empty page.
 */

const ACCESS_TOKEN_COOKIE = "getownly_access_token";
const REFRESH_TOKEN_COOKIE = "getownly_refresh_token";

/** Prefixes only one role may enter. */
const ROLE_PREFIXES: { prefix: string; role: Role }[] = [
  { prefix: "/admin", role: "ADMIN" },
  { prefix: "/instructor", role: "INSTRUCTOR" },
];

/** Prefixes any signed-in user may enter. */
const AUTHENTICATED_PREFIXES = [
  "/my-courses",
  "/wallet",
  "/cart",
  "/checkout",
  "/orders",
  "/learn",
  "/account",
  "/profile",
];

/** Pages that only make sense when signed out. */
const GUEST_ONLY_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

interface SessionHint {
  role: Role | null;
  hasSession: boolean;
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = readSessionHint(request);

  if (GUEST_ONLY_PATHS.some((path) => pathname === path)) {
    // Someone already signed in has no use for the login form.
    if (session.hasSession && session.role) {
      return NextResponse.redirect(new URL(HOME_PATH_BY_ROLE[session.role], request.url));
    }
    return NextResponse.next();
  }

  const roleRule = ROLE_PREFIXES.find(({ prefix }) => isUnder(pathname, prefix));
  const needsAuth = roleRule !== undefined || AUTHENTICATED_PREFIXES.some((p) => isUnder(pathname, p));

  if (!needsAuth) {
    return NextResponse.next();
  }

  if (!session.hasSession) {
    return NextResponse.redirect(loginUrl(request, `${pathname}${search}`));
  }

  // A role mismatch only matters when the role is actually known. Right after
  // the access token expires it is not, and the page will refresh the session
  // on its first API call.
  if (roleRule && session.role && session.role !== roleRule.role) {
    return NextResponse.redirect(new URL(HOME_PATH_BY_ROLE[session.role], request.url));
  }

  return NextResponse.next();
}

function readSessionHint(request: NextRequest): SessionHint {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  // The refresh cookie outlives the access one, so it is what "still signed
  // in" means here.
  const hasSession = Boolean(accessToken) || Boolean(refreshToken);

  if (!accessToken) {
    return { role: null, hasSession };
  }

  try {
    const claims = decodeJwt(accessToken);
    const role = typeof claims.role === "string" ? claims.role : null;
    const expired = typeof claims.exp === "number" && claims.exp * 1000 <= Date.now();

    if (expired || !role || !ROLES.includes(role as Role)) {
      return { role: null, hasSession };
    }
    return { role: role as Role, hasSession };
  } catch {
    return { role: null, hasSession };
  }
}

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function loginUrl(request: NextRequest, next: string): URL {
  const url = new URL("/login", request.url);
  url.searchParams.set("next", next);
  return url;
}

export const config = {
  // Everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
