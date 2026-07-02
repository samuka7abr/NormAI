import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "";

const PROTECTED_PREFIXES = ["/projects", "/dictionary", "/account"];
const AUTH_PATHS = ["/login", "/signup", "/forgot-password"];

async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const cookie = request.headers.get("cookie") ?? "";
  if (!cookie || !API_URL) return false;

  try {
    const res = await fetch(`${API_URL}/users/me`, {
      headers: { Cookie: cookie },
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p));

  if (isProtected) {
    const authenticated = await isAuthenticated(request);
    if (!authenticated) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (isAuthPage) {
    const authenticated = await isAuthenticated(request);
    if (authenticated) {
      const projectsUrl = new URL("/projects", request.url);
      return NextResponse.redirect(projectsUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/projects/:path*",
    "/dictionary/:path*",
    "/account/:path*",
    "/login",
    "/signup",
    "/forgot-password",
  ],
};
