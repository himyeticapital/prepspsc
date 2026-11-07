import { NextResponse } from "next/server";
import { isAllFeaturesFree } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit } from "@/lib/rate-limit";
import { validateBody, createOrderSchema } from "@/lib/validations";
import { verifyTurnstileToken } from "@/lib/turnstile";

const PLANS = {
  monthly: {
    amount: 999, // Amount in rupees (₹999)
    currency: "INR",
  },
  yearly: {
    amount: 10000, // Amount in rupees (₹10,000)
    currency: "INR",
  },
};

export async function POST(request: Request) {
  // Everything is free right now — refuse to take anyone's money.
  if (isAllFeaturesFree()) {
    return NextResponse.json(
      { error: "All PrepSPSC features are currently free. No payment is needed.", code: "ALL_FEATURES_FREE" },
      { status: 410 }
    );
  }

  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if already pro
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_pro_member, full_name, pro_expires_at, trial_ends_at")
      .eq("id", user.id)
      .single();

    if (profile?.is_pro_member) {
      if (profile.trial_ends_at) {
        // Allow — trial user upgrading to paid
      } else {
        const expiresAt = profile.pro_expires_at
          ? new Date(profile.pro_expires_at)
          : null;
        const daysLeft = expiresAt
          ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : Infinity;

        if (daysLeft > 7) {
          return NextResponse.json(
            { error: "You are already a Pro member" },
            { status: 400 }
          );
        }
      }
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

    const validation = validateBody(createOrderSchema, rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      );
    }

    const { planId, turnstileToken } = validation.data;

    // Verify Turnstile CAPTCHA if token provided
    if (turnstileToken) {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
      const isValid = await verifyTurnstileToken(turnstileToken, ip || undefined);
      if (!isValid) {
        return NextResponse.json(
          { error: "CAPTCHA verification failed" },
          { status: 403 }
        );
      }
    }

    if (!PLANS[planId as keyof typeof PLANS]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const plan = PLANS[planId as keyof typeof PLANS];

    const clientId = process.env.CASHFREE_APP_ID;
    const clientSecret = process.env.CASHFREE_SECRET_KEY;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Payment system not configured" },
        { status: 503 }
      );
    }

    const orderId = `order_${user.id.slice(0, 8)}_${Date.now()}`;

    // Determine API base URL
    const baseUrl =
      process.env.CASHFREE_ENV === "production"
        ? "https://api.cashfree.com"
        : "https://sandbox.cashfree.com";

    // Create Cashfree order
    const cfResponse = await fetch(`${baseUrl}/pg/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": clientId,
        "x-client-secret": clientSecret,
        "x-api-version": "2023-08-01",
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: plan.amount,
        order_currency: plan.currency,
        customer_details: {
          customer_id: user.id,
          customer_name: profile?.full_name || "User",
          customer_email: user.email || "",
          customer_phone: "9999999999", // Placeholder - Cashfree requires phone
        },
        order_meta: {
          notify_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/cashfree/webhook`,
        },
        order_note: `PrepSPSC Pro ${planId} subscription`,
        order_tags: {
          userId: user.id,
          planId,
        },
      }),
    });

    const cfData = await cfResponse.json();

    if (!cfResponse.ok) {
      console.error("Cashfree create order error:", cfData);
      return NextResponse.json(
        { error: "Failed to create payment order" },
        { status: 500 }
      );
    }

    // Save order to database (reusing razorpay columns for Cashfree IDs)
    await supabase.from("payments").insert({
      user_id: user.id,
      razorpay_order_id: orderId,
      amount: plan.amount * 100, // Store in paise for consistency
      currency: plan.currency,
      status: "created",
      plan_type: planId,
    });

    return NextResponse.json({
      orderId,
      paymentSessionId: cfData.payment_session_id,
      amount: plan.amount,
      currency: plan.currency,
    });
  } catch (error) {
    console.error("Create order error:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}
