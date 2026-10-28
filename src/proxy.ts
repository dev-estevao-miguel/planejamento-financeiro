import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/** Pages for signed-out visitors; signed-in users are sent home from them. */
const AUTH_PAGES = ["/entrar", "/primeiro-acesso"];

function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`));
}

/**
 * Refreshes the Supabase session cookies on every request and keeps signed-out
 * visitors out of the app. This is a UX gate only: every page and Server
 * Action re-verifies the session, and RLS protects the data itself.
 */
export async function proxy(request: NextRequest) {
  const env = getPublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  let redirectTo: URL | null = null;
  if (!signedIn && !isAuthPage(pathname)) {
    redirectTo = new URL("/entrar", request.url);
    if (pathname !== "/") redirectTo.searchParams.set("next", `${pathname}${search}`);
  } else if (signedIn && isAuthPage(pathname)) {
    redirectTo = new URL("/", request.url);
  }

  if (!redirectTo) return response;

  // Keep any refreshed session cookies on the redirect response.
  const redirect = NextResponse.redirect(redirectTo);
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export const config = {
  matcher: [
    // Everything except static assets, PWA files and the offline fallback.
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|icons/|manifest.webmanifest|sw.js|offline|robots.txt).*)",
  ],
};
