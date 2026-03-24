import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

/**
 * KVFX Auth Middleware
 *
 * Protects /assistant, /logs, /add-trade, /upgrade.
 * Refreshes Supabase auth tokens on every request.
 * Redirects unauthenticated users to /login.
 * Redirects authenticated users away from /login.
 * Redirects beta users with expired access to /upgrade.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — required for SSR to stay in sync
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protected routes — require authentication
  const isProtected =
    pathname.startsWith("/assistant") ||
    pathname.startsWith("/logs") ||
    pathname.startsWith("/add-trade") ||
    pathname.startsWith("/upgrade");

  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Beta expiry check — only on /assistant routes, not /upgrade itself
  if (user && pathname.startsWith("/assistant")) {
    try {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("tier, beta_expires_at")
        .eq("id", user.id)
        .single();

      if (
        profile?.tier === "beta" &&
        profile?.beta_expires_at &&
        new Date(profile.beta_expires_at) < new Date()
      ) {
        return NextResponse.redirect(new URL("/upgrade", request.url));
      }
    } catch {
      // Profile read failure — allow through, page will handle gracefully
    }
  }

  // Redirect authenticated users away from login page
  if (pathname === "/login" && user) {
    return NextResponse.redirect(new URL("/assistant", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Run on all paths except Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
