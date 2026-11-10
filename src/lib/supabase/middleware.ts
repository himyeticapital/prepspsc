import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { loadOnboardingState } from "@/lib/onboarding";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirects must carry session refresh cookies too, or the next request can appear signed out.
  const redirectWithSession = (url: URL) => {
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach(cookie => response.cookies.set(cookie));
    return response;
  };

  // Admin auth routes (no auth required, outside admin layout)
  const adminAuthRoutes = ["/admin-auth/login", "/admin-auth/reset-password"];
  const isAdminAuthRoute = adminAuthRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  // Admin protected routes: /admin and /admin/*. Not /admin-auth/*, which is the
  // admin login itself (matching it here sent signed-out visitors into a redirect loop).
  const pathname = request.nextUrl.pathname;
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

  // Protected routes (excluding admin which has its own handling)
  const protectedRoutes = ["/dashboard", "/tests", "/test", "/room", "/rooms", "/bookmarks", "/profile", "/leaderboard", "/notes", "/results", "/study-ai", "/test-analytics"];
  const isProtectedRoute = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  // Redirect unauthenticated users from protected routes to main login
  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return redirectWithSession(url);
  }

  // A saved avatar alone can belong to a half-saved onboarding attempt.
  if (isProtectedRoute && user) {
    const state = await loadOnboardingState(supabase, user.id).catch(() => null);
    if (!state?.complete) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return redirectWithSession(url);
    }
  }

  // Redirect unauthenticated users from admin routes to admin login
  if (isAdminRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin-auth/login";
    return redirectWithSession(url);
  }

  // Check admin access for authenticated users
  if (isAdminRoute && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "teacher"].includes(profile.role)) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return redirectWithSession(url);
    }
  }

  // Redirect authenticated admins away from admin login page
  if (isAdminAuthRoute && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile && ["admin", "teacher"].includes(profile.role)) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      return redirectWithSession(url);
    }
  }

  // Redirect authenticated users away from auth pages
  const authRoutes = ["/login", "/signup"];
  const isAuthRoute = authRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return redirectWithSession(url);
  }

  return supabaseResponse;
}
