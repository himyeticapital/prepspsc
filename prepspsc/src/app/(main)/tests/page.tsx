import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TestsClient } from "./tests-client";

export default async function TestsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_pro_member")
    .eq("id", user.id)
    .single();

  // Fetch all categories
  const { data: categories } = await supabase
    .from("exam_categories")
    .select("*")
    .order("sort_order", { ascending: true });

  // Fetch all active tests with their categories
  const { data: tests } = await supabase
    .from("tests")
    .select(`
      *,
      category:exam_categories(*)
    `)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  // Fetch user's test analytics
  const { data: analytics } = await supabase
    .from("test_analytics")
    .select("*")
    .eq("user_id", user.id);

  return (
    <TestsClient
      tests={tests || []}
      categories={categories || []}
      isPro={profile?.is_pro_member || false}
      analytics={analytics || []}
    />
  );
}
