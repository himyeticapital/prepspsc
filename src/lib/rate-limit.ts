import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { getRedisRestConfig } from "@/lib/redis-config";

// Lazy initialization to avoid build-time errors when env vars aren't available
let redis: Redis | null = null;
let rateLimitersInstance: Record<string, Ratelimit> | null = null;

// Emergency protection for CAPTCHA only. This is per server instance; Redis
// remains the shared limiter whenever available. Never use for payments/OTP.
const localAuthAttempts = new Map<string, number[]>();
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_ATTEMPTS = 10;
const MAX_LOCAL_IDENTIFIERS = 10_000;

function applyLocalAuthLimit(id: string): NextResponse | null {
  const now = Date.now();
  const cutoff = now - AUTH_WINDOW_MS;
  const attempts = (localAuthAttempts.get(id) ?? []).filter(time => time > cutoff);

  if (!localAuthAttempts.has(id)) {
    for (const [key, times] of localAuthAttempts) {
      if (times[times.length - 1] <= cutoff) localAuthAttempts.delete(key);
    }
    // Keep memory bounded without evicting active limits.
    if (localAuthAttempts.size >= MAX_LOCAL_IDENTIFIERS) {
      return NextResponse.json(
        { error: "Service temporarily unavailable" },
        { status: 503, headers: { "Retry-After": "60" } }
      );
    }
  }

  if (attempts.length >= AUTH_ATTEMPTS) {
    const reset = attempts[0] + AUTH_WINDOW_MS;
    const retryAfter = Math.max(1, Math.ceil((reset - now) / 1000));
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", retryAfter },
      { status: 429, headers: {
        "X-RateLimit-Limit": String(AUTH_ATTEMPTS),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(reset),
        "Retry-After": String(retryAfter),
      } }
    );
  }

  attempts.push(now);
  localAuthAttempts.set(id, attempts);
  return null;
}

function getRedis(): Redis {
  if (!redis) {
    const config = getRedisRestConfig();
    if (!config) throw new Error("Upstash Redis is not configured");
    redis = new Redis(config);
  }
  return redis;
}

function getRateLimiters() {
  if (!rateLimitersInstance) {
    const redisClient = getRedis();
    rateLimitersInstance = {
      auth: new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(10, "15 m"),
        prefix: "rl:auth",
      }),
      aiGeneration: new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(30, "1 m"),
        prefix: "rl:ai",
      }),
      payment: new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(3, "1 m"),
        prefix: "rl:payment",
      }),
      general: new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(30, "1 m"),
        prefix: "rl:general",
      }),
      admin: new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(20, "1 m"),
        prefix: "rl:admin",
      }),
      evaluate: new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(5, "1 m"),
        prefix: "rl:evaluate",
      }),
      news: new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(20, "1 m"),
        prefix: "rl:news",
      }),
    };
  }
  return rateLimitersInstance;
}

export type RateLimiterKey = "auth" | "aiGeneration" | "payment" | "general" | "admin" | "evaluate" | "news";

export async function applyRateLimit(
  request: Request,
  limiterKey: RateLimiterKey,
  identifier?: string,
  options?: { fallback: "local-auth" }
): Promise<NextResponse | null> {
  const ip =
    (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()) ??
    request.headers.get("x-real-ip") ??
    "anonymous";

  const id = identifier || ip;

  try {
    const rateLimiters = getRateLimiters();
    const { success, limit, reset } = await rateLimiters[limiterKey].limit(id);

    if (!success) {
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
          retryAfter: Math.ceil((reset - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": reset.toString(),
            "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    return null;
  } catch (error) {
    console.error("Rate limit check failed:", error);
    if (limiterKey === "auth" && options?.fallback === "local-auth") {
      return applyLocalAuthLimit(id);
    }
    // Sensitive callers continue to fail closed if Redis is unavailable.
    return new NextResponse(
      JSON.stringify({ error: "Service temporarily unavailable" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}
