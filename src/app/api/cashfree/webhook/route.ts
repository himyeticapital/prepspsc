import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Use service role for webhook (no user auth context)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CashfreeWebhookPayload {
  type: string;
  data: {
    order: {
      order_id: string;
      order_amount: number;
      order_currency: string;
      order_status: string;
      order_tags?: {
        userId?: string;
        planId?: string;
      };
    };
    payment?: {
      cf_payment_id: number;
      payment_status: string;
      payment_amount: number;
      payment_currency: string;
      payment_time: string;
      payment_method?: {
        card?: object;
        upi?: object;
        netbanking?: object;
        wallet?: object;
      };
    };
    customer_details?: {
      customer_id: string;
      customer_email: string;
      customer_phone: string;
      customer_name: string;
    };
  };
  event_time: string;
}

function verifyWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string
): boolean {
  const secretKey = process.env.CASHFREE_SECRET_KEY;
  if (!secretKey) return false;

  // Cashfree webhook signature verification
  // signature = base64(HMAC-SHA256(timestamp + payload, secret_key))
  const signatureData = timestamp + payload;
  const expectedSignature = crypto
    .createHmac("sha256", secretKey)
    .update(signatureData)
    .digest("base64");

  return signature === expectedSignature;
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-webhook-signature") || "";
    const timestamp = request.headers.get("x-webhook-timestamp") || "";

    // Verify webhook signature in production
    if (process.env.CASHFREE_ENV === "production") {
      if (!verifyWebhookSignature(rawBody, signature, timestamp)) {
        console.error("Webhook signature verification failed");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    }

    const payload: CashfreeWebhookPayload = JSON.parse(rawBody);
    console.log("Cashfree webhook received:", payload.type, payload.data.order?.order_id);

    // Handle different event types
    if (payload.type === "PAYMENT_SUCCESS_WEBHOOK") {
      const { order, payment, customer_details } = payload.data;
      const orderId = order.order_id;
      const userId = customer_details?.customer_id || order.order_tags?.userId;
      const planId = order.order_tags?.planId;

      if (!userId || !orderId) {
        console.error("Missing userId or orderId in webhook payload");
        return NextResponse.json(
          { error: "Missing required fields" },
          { status: 400 }
        );
      }

      // Check if payment already processed
      const { data: existingPayment } = await supabase
        .from("payments")
        .select("status")
        .eq("cashfree_order_id", orderId)
        .single();

      if (existingPayment?.status === "paid") {
        // Already processed, return success
        return NextResponse.json({ success: true, message: "Already processed" });
      }

      // Update payment status
      await supabase
        .from("payments")
        .update({
          cashfree_payment_id: payment?.cf_payment_id?.toString() || orderId,
          status: "paid",
        })
        .eq("cashfree_order_id", orderId);

      // Get current profile to handle renewals
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("pro_expires_at")
        .eq("id", userId)
        .single();

      // Calculate expiry date
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
        // Default to monthly
        expiresAt = new Date(baseDate);
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      }

      // Update user profile to Pro
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
        .eq("id", userId);

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
          .eq("user_id", userId)
          .eq("achievement_id", proAchievement.id)
          .single();

        if (!existing) {
          // Unlock achievement
          await supabase.from("user_achievements").insert({
            user_id: userId,
            achievement_id: proAchievement.id,
          });

          // Award XP with 1.5x multiplier
          const xpAmount = Math.floor(proAchievement.xp_reward * 1.5);

          await supabase.from("xp_transactions").insert({
            user_id: userId,
            amount: xpAmount,
            reason: "achievement_unlock",
            multiplier: 1.5,
            reference_id: "pro_member",
          });

          // Update XP in profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("xp_points")
            .eq("id", userId)
            .single();

          const newXP = (profile?.xp_points || 0) + xpAmount;
          const newLevel = Math.max(1, Math.floor(Math.sqrt(newXP / 100)) + 1);

          await supabase
            .from("profiles")
            .update({
              xp_points: newXP,
              xp_level: newLevel,
            })
            .eq("id", userId);
        }
      }

      console.log(`Payment successful for user ${userId}, order ${orderId}`);
      return NextResponse.json({ success: true });
    }

    // Handle payment failure
    if (payload.type === "PAYMENT_FAILED_WEBHOOK") {
      const { order } = payload.data;
      const orderId = order.order_id;

      await supabase
        .from("payments")
        .update({ status: "failed" })
        .eq("cashfree_order_id", orderId);

      console.log(`Payment failed for order ${orderId}`);
      return NextResponse.json({ success: true });
    }

    // Handle other event types
    console.log(`Unhandled webhook type: ${payload.type}`);
    return NextResponse.json({ success: true, message: "Event acknowledged" });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

// Cashfree may also send GET requests for webhook verification
export async function GET() {
  return NextResponse.json({ status: "Webhook endpoint active" });
}
