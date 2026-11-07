import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { ResultsClient } from "./results-client";

interface Props {
  params: Promise<{ attemptId: string }>;
}

export default async function ResultsPage({ params }: Props) {
  const { attemptId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch attempt with test and answers
  const { data: attempt, error } = await supabase
    .from("test_attempts")
    .select(`
      *,
      test:tests(*),
      user_answers(
        *,
        question:questions(*)
      )
    `)
    .eq("id", parseInt(attemptId))
    .eq("user_id", user.id)
    .single();

  if (error || !attempt) {
    notFound();
  }

  // Deduplicate user answers by question_id (keep the latest one based on id)
  const userAnswersMap = new Map<number, typeof attempt.user_answers[0]>();
  for (const answer of attempt.user_answers || []) {
    const existing = userAnswersMap.get(answer.question_id);
    // Keep the answer with the higher id (most recent) or with ai_feedback
    if (!existing || answer.id > existing.id || (answer.ai_feedback && !existing.ai_feedback)) {
      userAnswersMap.set(answer.question_id, answer);
    }
  }
  const deduplicatedUserAnswers = Array.from(userAnswersMap.values());

  // Fetch average score for this test
  const { data: avgData } = await supabase
    .from("test_attempts")
    .select("score")
    .eq("test_id", attempt.test_id)
    .eq("status", "completed")
    .not("score", "is", null);

  const averageScore = avgData && avgData.length > 0
    ? avgData.reduce((sum, a) => sum + (a.score || 0), 0) / avgData.length
    : 0;

  return (
    <ResultsClient
      attempt={attempt}
      test={attempt.test}
      userAnswers={deduplicatedUserAnswers}
      averageScore={averageScore}
      currentUserId={user.id}
    />
  );
}
