import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit } from "@/lib/rate-limit";
import { CREDIT_PACKS, cashfreeBaseUrl, cashfreeHeaders } from "@/lib/ai-credits";

const bodySchema = z.object({
  packId: z.enum(["credits_50", "credits_100", "credits_200"]),
});

/**
 * Start a Cashfree payment for an AI credit pack. Credits are only added after the payment is
 * confirmed with Cashfree (see /api/credits/verify and /api/credits/webhook).
 * This works even while every feature is free: credits only pay for optional better answers.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limited = await applyRateLimit(request, "payment", user.id);
    if (limited) return limited;

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: "Unknown credit pack" }, { status: 400 });

    const { packId } = parsed.data;
    const pack = CREDIT_PACKS[packId];

    const headers = cashfreeHeaders();
    if (!headers) return NextResponse.json({ error: "Payment system not configured" }, { status: 503 });

    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const { data: priv } = await supabase.from("profile_private").select("phone_number").eq("id", user.id).maybeSingle();
    const phone = String(priv?.phone_number ?? "").replace(/\D/g, "").slice(-10);

    const orderId = `credits_${user.id.slice(0, 8)}_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://prepspsc.com";

    const cfResponse = await fetch(`${cashfreeBaseUrl()}/pg/orders`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        order_id: orderId,
        order_amount: pack.amountPaise / 100,
        order_currency: "INR",
        customer_details: {
          customer_id: user.id,
          customer_name: profile?.full_name || "Student",
          customer_email: user.email || "",
          customer_phone: phone.length === 10 ? phone : "9999999999", // Cashfree requires a phone
        },
        order_meta: { notify_url: `${appUrl}/api/credits/webhook` },
        order_note: `PrepSPSC AI credits ${pack.label}`,
        order_tags: { purpose: "ai_credits", packId },
      }),
    });
    const cfData = await cfResponse.json();
    if (!cfResponse.ok || !cfData.payment_session_id) {
      console.error("[AI credits] Cashfree create order failed", cfData?.message ?? cfResponse.status);
      return NextResponse.json({ error: "Failed to create payment order" }, { status: 502 });
    }

    const service = createServiceClient();
    const { error: insertError } = await service.from("payments").insert({
      user_id: user.id,
      cashfree_order_id: orderId,
      amount: pack.amountPaise,
      currency: "INR",
      status: "created",
      plan_type: packId,
    });
    if (insertError) console.error("[AI credits] payments insert failed", insertError.message);

    return NextResponse.json({
      orderId,
      paymentSessionId: cfData.payment_session_id,
      amountPaise: pack.amountPaise,
    });
  } catch (error) {
    console.error("[AI credits] create order error", error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
