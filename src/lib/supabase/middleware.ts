import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPresetAvatar } from "@/lib/avatars";

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

  // Admin auth routes (no auth required, outside admin layout)
  const adminAuthRoutes = ["/admin-auth/login", "/admin-auth/reset-password"];
  const isAdminAuthRoute = adminAuthRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  // Admin protected routes (all /admin/* routes require auth)
  const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");

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
    return NextResponse.redirect(url);
  }

  // Enforce avatar selection: authenticated users on protected routes must have a preset avatar
  if (isProtectedRoute && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .single();

    if (!profile || !isPresetAvatar(profile.avatar_url)) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }
  }

  // Redirect unauthenticated users from admin routes to admin login
  if (isAdminRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin-auth/login";
    return NextResponse.redirect(url);
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
      return NextResponse.redirect(url);
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
      return NextResponse.redirect(url);
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
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
