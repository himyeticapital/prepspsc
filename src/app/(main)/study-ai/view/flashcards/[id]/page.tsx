import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { FlashcardsViewer } from "@/components/study-ai/viewers/flashcard-viewer";

interface FlashcardsPageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: "Flashcards | Study with AI",
};

export default async function FlashcardsPage({ params }: FlashcardsPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the generation
  const { data: generation, error } = await supabase
    .from("ai_generations")
    .select("*, study_ai_goals(goal_text)")
    .eq("id", parseInt(id))
    .eq("user_id", user.id)
    .single();

  if (error || !generation || generation.generation_type !== "flashcards") {
    notFound();
  }

  return (
    <FlashcardsViewer
      generation={generation}
      goalText={(generation.study_ai_goals as any)?.goal_text || "Flashcards"}
    />
  );
}
