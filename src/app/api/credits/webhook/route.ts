import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { grantPaidCreditOrder, verifyCashfreeSignature } from "@/lib/ai-credits";

/**
 * Cashfree's server-to-server notice for AI credit orders (set as notify_url on each credit order).
 * The signature is always checked, and the order is re-fetched from Cashfree before any credit is
 * added, so a forged or edited webhook body can never add credits.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature") || "";
  const timestamp = request.headers.get("x-webhook-timestamp") || "";

  if (!verifyCashfreeSignature(rawBody, signature, timestamp, process.env.CASHFREE_SECRET_KEY || "")) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: { type?: string; data?: { order?: { order_id?: string } } };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderId = payload.data?.order?.order_id;
  if (payload.type !== "PAYMENT_SUCCESS_WEBHOOK" || !orderId) {
    return NextResponse.json({ success: true, message: "Event acknowledged" });
  }

  try {
    const result = await grantPaidCreditOrder(createServiceClient(), orderId);
    if (!result.ok) console.warn("[AI credits] webhook did not credit", orderId, result.reason);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[AI credits] webhook error", orderId, error);
    // A 5xx makes Cashfree retry later; crediting is idempotent, so retries are safe.
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "AI credits webhook active" });
}
