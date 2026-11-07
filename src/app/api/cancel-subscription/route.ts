import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    const rateLimitResponse = await applyRateLimit(request, "payment", user.id);
    if (rateLimitResponse) return rateLimitResponse;

    // Check if user is a Pro member
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_pro_member, pro_expires_at, pro_cancelled")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    if (!profile.is_pro_member) {
      return NextResponse.json(
        { error: "No active Pro subscription" },
        { status: 400 }
      );
    }

    if (profile.pro_cancelled) {
      return NextResponse.json(
        { error: "Subscription already cancelled" },
        { status: 400 }
      );
    }

    // Set pro_cancelled flag
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        pro_cancelled: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Failed to cancel subscription:", updateError);
      return NextResponse.json(
        { error: "Failed to cancel subscription" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Subscription cancelled. You will retain Pro access until your current period ends.",
      expires_at: profile.pro_expires_at,
    });
  } catch (error) {
    console.error("Cancel subscription error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
