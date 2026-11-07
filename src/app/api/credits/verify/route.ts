import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit } from "@/lib/rate-limit";
import { grantPaidCreditOrder } from "@/lib/ai-credits";

const bodySchema = z.object({ orderId: z.string().min(1).max(50) });

/** Called by the browser after checkout. Credits are added only if Cashfree says the order is paid. */
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
    if (!parsed.success) return NextResponse.json({ error: "Invalid order" }, { status: 400 });

    const result = await grantPaidCreditOrder(createServiceClient(), parsed.data.orderId, user.id);
    if (!result.ok) {
      return NextResponse.json({ error: "Payment not confirmed", reason: result.reason }, { status: 400 });
    }
    return NextResponse.json({ success: true, balancePaise: result.balancePaise });
  } catch (error) {
    console.error("[AI credits] verify error", error);
    return NextResponse.json({ error: "Failed to verify payment" }, { status: 500 });
  }
}
