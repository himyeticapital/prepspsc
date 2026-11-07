import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { applyRateLimit } from "@/lib/rate-limit";
import { isValidEmail, isDisposableEmail, hasMxRecords } from "@/lib/email-validation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateOtp(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1000000).padStart(6, "0");
}

async function handleSend(email: string, request: Request) {
  // Validate email format
  if (!email || typeof email !== "string" || !isValidEmail(email.trim())) {
    return NextResponse.json(
      { error: "A valid email address is required" },
      { status: 400 }
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (isDisposableEmail(normalizedEmail)) {
    return NextResponse.json(
      { error: "Disposable or temporary email addresses are not allowed" },
      { status: 400 }
    );
  }

  if (!(await hasMxRecords(normalizedEmail))) {
    return NextResponse.json(
      { error: "This email domain doesn't appear to accept mail. Please use a valid email address." },
      { status: 400 }
    );
  }

  // Rate limit by IP
  const rateLimitResponse = await applyRateLimit(request, "auth");
  if (rateLimitResponse) return rateLimitResponse;

  // Check for existing recent codes (max 3 sends per 15 min)
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: recentCodes, error: recentError } = await supabase
    .from("developer_otp_codes")
    .select("id")
    .eq("email", normalizedEmail)
    .eq("otp_type", "email")
    .gte("created_at", fifteenMinAgo);

  if (recentError) {
    console.error("Failed to check recent OTP codes:", recentError);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }

  if (recentCodes && recentCodes.length >= 3) {
    return NextResponse.json(
      { error: "Too many verification codes requested. Please wait 15 minutes before trying again." },
      { status: 429 }
    );
  }

  // Generate and hash OTP
  const code = generateOtp();
  const codeHash = await hashCode(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Store hashed code
  const { error: insertError } = await supabase
    .from("developer_otp_codes")
    .insert({
      email: normalizedEmail,
      code_hash: codeHash,
      otp_type: "email",
      expires_at: expiresAt,
    });

  if (insertError) {
    console.error("Failed to store OTP code:", insertError);
    return NextResponse.json(
      { error: "Failed to generate verification code. Please try again." },
      { status: 500 }
    );
  }

  // Send email via Resend
  const { error: emailError } = await resend.emails.send({
    from: "PrepSPSC <noreply@prepspsc.com>",
    to: normalizedEmail,
    subject: "Your PrepSPSC Developer Verification Code",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="color: #09090b; margin-bottom: 16px;">Verify your email</h2>
        <p style="color: #52525b; font-size: 15px; line-height: 1.5; margin-bottom: 24px;">
          Use the following code to verify your email address for the PrepSPSC Developer Portal. This code expires in 10 minutes.
        </p>
        <div style="background: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #09090b;">${code}</span>
        </div>
        <p style="color: #a1a1aa; font-size: 13px; line-height: 1.5;">
          If you didn't request this code, you can safely ignore this email.
        </p>
      </div>
    `,
  });

  if (emailError) {
    console.error("Failed to send verification email:", emailError);
    return NextResponse.json(
      { error: "Failed to send verification email. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Verification code sent",
  });
}

async function handleVerify(email: string, code: string) {
  if (!email || typeof email !== "string" || !isValidEmail(email.trim())) {
    return NextResponse.json(
      { error: "A valid email address is required" },
      { status: 400 }
    );
  }

  if (!code || typeof code !== "string" || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "A valid 6-digit code is required" },
      { status: 400 }
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Look up latest unexpired, unverified code for this email
  const { data: otpRecord, error: lookupError } = await supabase
    .from("developer_otp_codes")
    .select("id, code_hash, attempts")
    .eq("email", normalizedEmail)
    .eq("otp_type", "email")
    .is("verified_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (lookupError || !otpRecord) {
    return NextResponse.json(
      { verified: false, error: "No valid verification code found. Please request a new one." },
      { status: 400 }
    );
  }

  // Compare hashes
  const providedHash = await hashCode(code);

  if (providedHash === otpRecord.code_hash) {
    // Mark as verified
    const { error: updateError } = await supabase
      .from("developer_otp_codes")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", otpRecord.id);

    if (updateError) {
      console.error("Failed to mark OTP as verified:", updateError);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    return NextResponse.json({ verified: true });
  }

  // Wrong code: increment attempts
  const newAttempts = (otpRecord.attempts || 0) + 1;
  const updateData: Record<string, unknown> = { attempts: newAttempts };

  // Invalidate after 5 failed attempts
  if (newAttempts >= 5) {
    updateData.expires_at = new Date().toISOString();
  }

  await supabase
    .from("developer_otp_codes")
    .update(updateData)
    .eq("id", otpRecord.id);

  return NextResponse.json(
    {
      verified: false,
      error: newAttempts >= 5
        ? "Too many failed attempts. Please request a new code."
        : "Invalid code",
    },
    { status: 400 }
  );
}

export async function POST(request: Request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { action, email, code } = body;

    if (action === "send") {
      return await handleSend(email, request);
    }

    if (action === "verify") {
      return await handleVerify(email, code);
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'send' or 'verify'." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error in developer-email-otp API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
