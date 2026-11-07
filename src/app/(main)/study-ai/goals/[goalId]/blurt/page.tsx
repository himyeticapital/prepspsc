import { hasProAccess } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { BlurtingPad } from "@/components/study-ai/revision/blurting-pad";

interface BlurtPageProps {
  params: Promise<{ goalId: string }>;
}

export const metadata = {
  title: "Blurting | Study with AI",
};

export default async function BlurtPage({ params }: BlurtPageProps) {
  const { goalId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the study goal with its materials
  const { data: goal, error } = await supabase
    .from("study_ai_goals")
    .select(`
      *,
      study_uploads(*),
      ai_generations(*)
    `)
    .eq("id", parseInt(goalId))
    .eq("user_id", user.id)
    .single();

  if (error || !goal) {
    notFound();
  }

  // Get user profile for Pro status
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_pro_member")
    .eq("id", user.id)
    .single();

  // Combine all source content from uploads
  const sourceContent = (goal.study_uploads || [])
    .map((upload: any) => upload.extracted_text || "")
    .filter(Boolean)
    .join("\n\n");

  return (
    <BlurtingPad
      goal={goal}
      sourceContent={sourceContent}
      isPro={hasProAccess(profile)}
    />
  );
}
