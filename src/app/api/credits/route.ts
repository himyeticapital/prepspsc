import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BETTER_ANSWER_PRICE_PAISE, CREDIT_PACKS, betterAnswersFor } from "@/lib/ai-credits";

export const dynamic = "force-dynamic";

/** The signed-in student's AI credit balance, recent history, price and packs. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Row-level security limits both reads to this student's own rows.
  const { data: wallet } = await supabase
    .from("ai_credit_wallets")
    .select("balance_paise")
    .eq("user_id", user.id)
    .maybeSingle();
  const { data: history } = await supabase
    .from("ai_credit_ledger")
    .select("delta_paise, reason, note, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const balancePaise = Number(wallet?.balance_paise ?? 0);
  return NextResponse.json({
    balancePaise,
    betterAnswerPricePaise: BETTER_ANSWER_PRICE_PAISE,
    betterAnswersLeft: betterAnswersFor(balancePaise),
    packs: Object.entries(CREDIT_PACKS).map(([id, p]) => ({
      id,
      label: p.label,
      amountPaise: p.amountPaise,
      betterAnswers: betterAnswersFor(p.amountPaise),
    })),
    history: history ?? [],
  });
}
