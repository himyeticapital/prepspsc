import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { getRedisRestConfig } from "@/lib/redis-config";

// Lazy initialization to avoid build-time errors when env vars aren't available
let redis: Redis | null = null;
let rateLimitersInstance: Record<string, Ratelimit> | null = null;

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
  identifier?: string
): Promise<NextResponse | null> {
  const ip =
    (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()) ??
    request.headers.get("x-real-ip") ??
    "anonymous";

  const id = identifier || ip;

  try {
    const rateLimiters = getRateLimiters();
    const { success, limit, remaining, reset } = await rateLimiters[limiterKey].limit(id);

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
    // Fail closed if Redis is unavailable (deny request)
    console.error("Rate limit check failed:", error);
    return new NextResponse(
      JSON.stringify({ error: "Service temporarily unavailable" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}
