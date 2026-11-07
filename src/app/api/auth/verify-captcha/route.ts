import { NextRequest, NextResponse } from "next/server";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { applyRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await applyRateLimit(request, "auth", undefined, {
      fallback: "local-auth",
    });
    if (rateLimitResponse) return rateLimitResponse;

    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: "CAPTCHA token required" },
        { status: 400 }
      );
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const isValid = await verifyTurnstileToken(token, ip || undefined);

    if (!isValid) {
      return NextResponse.json(
        { error: "CAPTCHA verification failed" },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("CAPTCHA verification error:", error);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}
