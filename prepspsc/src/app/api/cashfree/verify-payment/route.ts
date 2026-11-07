import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit } from "@/lib/rate-limit";
import { validateBody, verifyPaymentSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    const rateLimitResponse = await applyRateLimit(request, "payment", user.id);
    if (rateLimitResponse) return rateLimitResponse;

    let rawBody;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validation = validateBody(verifyPaymentSchema, rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      );
    }

    const { orderId, planId } = validation.data;

    const clientId = process.env.CASHFREE_APP_ID;
    const clientSecret = process.env.CASHFREE_SECRET_KEY;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Payment system not configured" },
        { status: 503 }
      );
    }

    // Determine API base URL
    const baseUrl =
      process.env.CASHFREE_ENV === "production"
        ? "https://api.cashfree.com"
        : "https://sandbox.cashfree.com";

    // Verify order status with Cashfree
    const cfResponse = await fetch(`${baseUrl}/pg/orders/${orderId}`, {
      method: "GET",
      headers: {
        "x-client-id": clientId,
        "x-client-secret": clientSecret,
        "x-api-version": "2023-08-01",
      },
    });

    const cfData = await cfResponse.json();

    if (!cfResponse.ok || cfData.order_status !== "PAID") {
      return NextResponse.json(
        { error: "Payment not confirmed" },
        { status: 400 }
      );
    }

    // Verify order belongs to authenticated user (prevents order ID spoofing)
    if (cfData.customer_details?.customer_id !== user.id) {
      return NextResponse.json(
        { error: "Order does not belong to this user" },
        { status: 403 }
      );
    }

    // Calculate expiry date (extend from current expiry if renewing)
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("pro_expires_at")
      .eq("id", user.id)
      .single();

    const baseDate =
      currentProfile?.pro_expires_at &&
      new Date(currentProfile.pro_expires_at) > new Date()
        ? new Date(currentProfile.pro_expires_at)
        : new Date();

    let expiresAt: Date;

    if (planId === "yearly") {
      expiresAt = new Date(baseDate);
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
      expiresAt = new Date(baseDate);
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    // Update payment status
    await supabase
      .from("payments")
      .update({
        cashfree_payment_id: cfData.cf_order_id?.toString() || orderId,
        status: "paid",
      })
      .eq("cashfree_order_id", orderId);

    // Update user profile to Pro with gamification benefits
    await supabase
      .from("profiles")
      .update({
        is_pro_member: true,
        pro_expires_at: expiresAt.toISOString(),
        pro_cancelled: false,
        streak_shields_remaining: 3,
        streak_shields_reset_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    // Unlock Pro Member achievement
    const { data: proAchievement } = await supabase
      .from("achievements")
      .select("id, xp_reward")
      .eq("slug", "pro_member")
      .single();

    if (proAchievement) {
      // Check if not already unlocked
      const { data: existing } = await supabase
        .from("user_achievements")
        .select("id")
        .eq("user_id", user.id)
        .eq("achievement_id", proAchievement.id)
        .single();

      if (!existing) {
        // Unlock achievement
        await supabase.from("user_achievements").insert({
          user_id: user.id,
          achievement_id: proAchievement.id,
        });

        // Award XP (with 1.5x multiplier since they're now Pro)
        const xpAmount = Math.floor(proAchievement.xp_reward * 1.5);

        await supabase.from("xp_transactions").insert({
          user_id: user.id,
          amount: xpAmount,
          reason: "achievement_unlock",
          multiplier: 1.5,
          reference_id: "pro_member",
        });

        // Update XP in profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("xp_points")
          .eq("id", user.id)
          .single();

        const newXP = (profile?.xp_points || 0) + xpAmount;
        const newLevel = Math.max(1, Math.floor(Math.sqrt(newXP / 100)) + 1);

        await supabase
          .from("profiles")
          .update({
            xp_points: newXP,
            xp_level: newLevel,
          })
          .eq("id", user.id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Verify payment error:", error);
    return NextResponse.json(
      { error: "Failed to verify payment" },
      { status: 500 }
    );
  }
}
