import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { generationId, isSaved } = await request.json();

    if (!generationId) {
      return NextResponse.json(
        { error: "Missing generationId" },
        { status: 400 }
      );
    }

    // Verify user owns the generation
    const { data: generation, error: fetchError } = await supabase
      .from("ai_generations")
      .select("id, user_id")
      .eq("id", generationId)
      .single();

    if (fetchError || !generation || generation.user_id !== user.id) {
      return NextResponse.json(
        { error: "Generation not found" },
        { status: 404 }
      );
    }

    // Update saved status
    const { error: updateError } = await supabase
      .from("ai_generations")
      .update({ is_saved: isSaved })
      .eq("id", generationId);

    if (updateError) {
      console.error("Failed to update saved status:", updateError);
      return NextResponse.json(
        { error: "Failed to update saved status" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      isSaved,
    });
  } catch (error) {
    console.error("Save error:", error);
    return NextResponse.json(
      { error: "Failed to save" },
      { status: 500 }
    );
  }
}
