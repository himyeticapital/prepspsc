import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TestAnalyticsClient } from "./analytics-client";

interface PageProps {
  params: Promise<{ testId: string }>;
}

export default async function TestAnalyticsPage({ params }: PageProps) {
  const { testId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch test details
  const { data: test } = await supabase
    .from("tests")
    .select("*")
    .eq("id", parseInt(testId))
    .single();

  if (!test) {
    redirect("/tests");
  }

  // Fetch user's analytics for this test
  const { data: analytics } = await supabase
    .from("test_analytics")
    .select("*")
    .eq("user_id", user.id)
    .eq("test_id", parseInt(testId))
    .single();

  // Fetch all attempts for this user and test
  const { data: attempts } = await supabase
    .from("test_attempts")
    .select("*, user_answers(*, question:questions(*))")
    .eq("user_id", user.id)
    .eq("test_id", parseInt(testId))
    .eq("status", "completed")
    .order("started_at", { ascending: false });

  // Fetch sections for this test
  const { data: sections } = await supabase
    .from("test_sections")
    .select("*")
    .eq("test_id", parseInt(testId))
    .order("sort_order");

  return (
    <TestAnalyticsClient
      test={test}
      analytics={analytics}
      attempts={attempts || []}
      sections={sections || []}
    />
  );
}
