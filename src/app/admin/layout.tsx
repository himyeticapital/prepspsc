import { createClient } from "@/lib/supabase/server";
import { AdminLayoutClient } from "@/components/admin/admin-layout-client";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  console.log("[AdminLayout] User check:", { userId: user?.id, error: userError?.message });

  // If no user, middleware will handle redirect - but for login/reset pages, show without sidebar
  if (!user) {
    console.log("[AdminLayout] No user found, rendering without sidebar");
    return <>{children}</>;
  }

  // Check admin/teacher role
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  console.log("[AdminLayout] Profile check:", { role: profile?.role, error: profileError?.message });

  // If not admin/teacher, middleware handles redirect - but return children as fallback
  if (!profile || !["admin", "teacher"].includes(profile.role)) {
    console.log("[AdminLayout] No valid profile/role, rendering without sidebar");
    return <>{children}</>;
  }

  console.log("[AdminLayout] Rendering with sidebar, role:", profile.role);

  return (
    <AdminLayoutClient role={profile.role}>
      {children}
    </AdminLayoutClient>
  );
}
