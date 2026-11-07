import { NextRequest, NextResponse } from "next/server";
import { isDisposableDomain } from "@/lib/disposable-domains";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { valid: false, error: "Email is required" },
        { status: 400 }
      );
    }

    const trimmed = email.trim().toLowerCase();

    // Basic format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return NextResponse.json(
        { valid: false, error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Check disposable domains
    if (isDisposableDomain(trimmed)) {
      return NextResponse.json(
        {
          valid: false,
          error:
            "Disposable or temporary email addresses are not allowed. Please use a permanent email.",
        },
        { status: 400 }
      );
    }

    // Server-side MX record check via DNS-over-HTTPS (works in Edge/serverless)
    const domain = trimmed.split("@")[1];
    try {
      const dnsRes = await fetch(
        `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`,
        { signal: AbortSignal.timeout(5000) }
      );
      const dnsData = await dnsRes.json();
      // Status 0 = NOERROR, Answer array should have MX records
      if (dnsData.Status !== 0 || !dnsData.Answer || dnsData.Answer.length === 0) {
        return NextResponse.json(
          {
            valid: false,
            error:
              "This email domain doesn't appear to accept mail. Please use a valid email address.",
          },
          { status: 400 }
        );
      }
    } catch {
      // DNS check failed — allow through rather than blocking legitimate users
    }

    return NextResponse.json({ valid: true });
  } catch {
    return NextResponse.json(
      { valid: false, error: "Validation failed" },
      { status: 500 }
    );
  }
}
