import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { applyRateLimit } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { isValidEmail, isDisposableEmail, hasMxRecords } from "@/lib/email-validation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sk_live_${hex}`;
}

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  try {
    // Rate limit: 10 signups per 15 minutes per IP
    const rateLimitResponse = await applyRateLimit(request, "auth");
    if (rateLimitResponse) return rateLimitResponse;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const {
      name,
      email,
      app_name,
      app_description,
      website_url,
      turnstile_token,
      company, // honeypot — real users never see/fill this
      phone_number,
      phone_verified,
    } = body;

    // Honeypot check: if filled, it's a bot
    if (company) {
      // Silently reject — bots don't need to know why
      return NextResponse.json({
        success: true,
        // Fake all-zeros key, built at runtime so secret scanners don't mistake it for a real one
        api_key: ["sk", "live", "0".repeat(40)].join("_"),
        key_prefix: ["sk", "live", "0000"].join("_"),
        tier: "free",
        rate_limit_rpm: 10,
        monthly_quota: 1000,
      });
    }

    // Turnstile CAPTCHA verification
    if (!turnstile_token || typeof turnstile_token !== "string") {
      return NextResponse.json(
        { error: "CAPTCHA verification required. Please complete the challenge." },
        { status: 400 }
      );
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const turnstileValid = await verifyTurnstileToken(turnstile_token, ip);
    if (!turnstileValid) {
      return NextResponse.json(
        { error: "CAPTCHA verification failed. Please try again." },
        { status: 403 }
      );
    }

    // Validate required fields
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { error: "Name is required (minimum 2 characters)" },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || !isValidEmail(email.trim())) {
      return NextResponse.json(
        { error: "A valid email address is required" },
        { status: 400 }
      );
    }

    if (isDisposableEmail(email.trim())) {
      return NextResponse.json(
        { error: "Disposable or temporary email addresses are not allowed. Please use a real email." },
        { status: 400 }
      );
    }

    if (!(await hasMxRecords(email.trim()))) {
      return NextResponse.json(
        { error: "This email domain doesn't appear to accept mail. Please use a valid email address." },
        { status: 400 }
      );
    }

    if (
      !app_name ||
      typeof app_name !== "string" ||
      app_name.trim().length < 2
    ) {
      return NextResponse.json(
        { error: "App name is required (minimum 2 characters)" },
        { status: 400 }
      );
    }

    if (
      !app_description ||
      typeof app_description !== "string" ||
      app_description.trim().length < 10
    ) {
      return NextResponse.json(
        { error: "App description is required (minimum 10 characters)" },
        { status: 400 }
      );
    }

    if (
      !website_url ||
      typeof website_url !== "string" ||
      website_url.trim().length < 5
    ) {
      return NextResponse.json(
        { error: "Website URL is required" },
        { status: 400 }
      );
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(website_url.trim());
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("bad protocol");
      }
    } catch {
      return NextResponse.json(
        { error: "Please enter a valid URL starting with http:// or https://" },
        { status: 400 }
      );
    }

    // Block well-known domains that users cannot own
    const blockedDomains = [
      "google.com", "google.co.in", "youtube.com", "facebook.com", "meta.com",
      "instagram.com", "twitter.com", "x.com", "linkedin.com", "github.com",
      "microsoft.com", "apple.com", "amazon.com", "netflix.com", "whatsapp.com",
      "telegram.org", "reddit.com", "wikipedia.org", "yahoo.com", "bing.com",
      "stackoverflow.com", "medium.com", "discord.com", "twitch.tv", "tiktok.com",
      "pinterest.com", "snapchat.com", "spotify.com", "openai.com", "anthropic.com",
      "supabase.com", "vercel.com", "netlify.com", "cloudflare.com", "aws.amazon.com",
      "firebase.google.com", "heroku.com", "digitalocean.com", "notion.so",
      "figma.com", "canva.com", "dribbble.com", "behance.net", "wordpress.com",
      "blogger.com", "tumblr.com", "quora.com", "baidu.com", "zoom.us",
      "slack.com", "trello.com", "atlassian.com", "jira.com", "bitbucket.org",
      "gitlab.com", "npmjs.com", "pypi.org", "stripe.com", "razorpay.com",
      "paypal.com", "example.com", "test.com", "localhost",
    ];
    const hostname = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
    if (blockedDomains.includes(hostname)) {
      return NextResponse.json(
        { error: "Please enter your own website or app URL, not a well-known platform." },
        { status: 400 }
      );
    }

    // Check if the URL is reachable (HEAD request with short timeout)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const urlRes = await fetch(parsedUrl.href, {
        method: "HEAD",
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timeout);
      if (!urlRes.ok && urlRes.status >= 500) {
        return NextResponse.json(
          { error: "This website URL doesn't appear to be reachable. Please check the URL and try again." },
          { status: 400 }
        );
      }
    } catch {
      // Try GET as fallback — some servers reject HEAD
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        await fetch(parsedUrl.href, {
          method: "GET",
          signal: controller.signal,
          redirect: "follow",
        });
        clearTimeout(timeout);
      } catch {
        return NextResponse.json(
          { error: "This website URL doesn't appear to be reachable. Please check the URL and try again." },
          { status: 400 }
        );
      }
    }

    // Verify phone was provided and verified via Firebase OTP
    if (!phone_number || typeof phone_number !== "string" || phone_number.trim().length < 10) {
      return NextResponse.json(
        { error: "A verified phone number is required" },
        { status: 400 }
      );
    }

    if (!phone_verified) {
      return NextResponse.json(
        { error: "Phone number must be verified via OTP" },
        { status: 400 }
      );
    }

    // Verify email OTP was completed (double-check against database)
    const { data: emailVerification } = await supabase
      .from("developer_otp_codes")
      .select("id, verified_at")
      .eq("email", email.trim().toLowerCase())
      .eq("otp_type", "email")
      .not("verified_at", "is", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!emailVerification) {
      return NextResponse.json(
        { error: "Email must be verified via OTP before generating an API key" },
        { status: 400 }
      );
    }

    // Check if email already has a signup
    const { data: existingSignup } = await supabase
      .from("api_developer_signups")
      .select("id, status, api_key_id")
      .eq("email", email.trim().toLowerCase())
      .single();

    if (existingSignup) {
      return NextResponse.json(
        {
          error:
            "This email is already registered. Contact support if you need a new key.",
        },
        { status: 409 }
      );
    }

    // Generate and hash the API key
    const rawApiKey = generateApiKey();
    const keyHash = await hashApiKey(rawApiKey);
    const keyPrefix = rawApiKey.substring(0, 12); // "sk_live_XXXX"

    // Insert the developer signup
    const { data: signup, error: signupError } = await supabase
      .from("api_developer_signups")
      .insert({
        email: email.trim().toLowerCase(),
        name: name.trim(),
        app_name: app_name.trim(),
        app_description: app_description.trim(),
        website_url: website_url.trim(),
        phone_number: phone_number.trim(),
        status: "approved",
      })
      .select("id")
      .single();

    if (signupError) {
      console.error("Failed to create developer signup:", signupError);
      if (signupError.code === "23505") {
        return NextResponse.json(
          { error: "This email is already registered." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create signup. Please try again." },
        { status: 500 }
      );
    }

    // Call the RPC to create the API key and link it
    const { error: rpcError } = await supabase.rpc(
      "create_api_key_for_developer",
      {
        p_signup_id: signup.id,
        p_key_hash: keyHash,
        p_key_prefix: keyPrefix,
      }
    );

    if (rpcError) {
      console.error("Failed to create API key via RPC:", rpcError);
      // Clean up the signup if key creation fails
      await supabase
        .from("api_developer_signups")
        .delete()
        .eq("id", signup.id);
      return NextResponse.json(
        { error: "Failed to generate API key. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      api_key: rawApiKey,
      key_prefix: keyPrefix,
      tier: "free",
      rate_limit_rpm: 10,
      monthly_quota: 1000,
    });
  } catch (error) {
    console.error("Error in developer-signup API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
