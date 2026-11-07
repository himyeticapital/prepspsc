import { hasProAccess } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { TestClient } from "./test-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TestPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch test with questions (only active tests)
  const { data: test, error } = await supabase
    .from("tests")
    .select(`
      *,
      questions(*)
    `)
    .eq("id", parseInt(id))
    .eq("is_active", true)
    .single();

  if (error || !test) {
    notFound();
  }

  // Check if premium and user has access
  if (test.is_premium) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_pro_member")
      .eq("id", user.id)
      .single();

    if (!hasProAccess(profile)) {
      redirect("/tests?error=premium_required");
    }
  }

  // Sort questions by sort_order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sortedQuestions = test.questions?.sort(
    (a: any, b: any) => a.sort_order - b.sort_order
  ) || [];

  return (
    <TestClient
      test={test}
      questions={sortedQuestions}
      userId={user.id}
      isPreview={false}
    />
  );
}
