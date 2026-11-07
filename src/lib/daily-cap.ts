import { Redis } from "@upstash/redis";
import { getRedisRestConfig } from "@/lib/redis-config";
import { NextResponse } from "next/server";

/**
 * Per-user daily caps on AI-heavy features.
 *
 * These are abuse guards, not plan limits: they apply to every user, are set
 * well above what a real student uses in a day, and reset at midnight IST.
 * Counters live in Upstash Redis. If Redis is down or not configured the cap
 * fails open, so a counter outage never blocks studying.
 */
export const DAILY_CAPS = {
  aiGeneration: { limit: 100, label: "AI generations" },
  studyPlan: { limit: 10, label: "study plans" },
  paperBlurt: { limit: 50, label: "Paper Blurt scans" },
  examExtraction: { limit: 20, label: "syllabus topic extractions" },
} as const;

export type DailyCapFeature = keyof typeof DAILY_CAPS;

export interface CounterStore {
  /** Atomically add 1 to `key` and return the new count. Set the TTL when the key is created. */
  incr(key: string, ttlSeconds: number): Promise<number>;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// Keep counters a little longer than a day so they never vanish mid-day.
const COUNTER_TTL_SECONDS = 26 * 60 * 60;

/** Calendar day in India (YYYY-MM-DD). */
export function istDayKey(now: Date): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The next midnight in India, as a UTC instant. */
export function nextIstMidnight(now: Date): Date {
  const istNow = now.getTime() + IST_OFFSET_MS;
  const nextIstDayStart = Math.floor(istNow / DAY_MS) * DAY_MS + DAY_MS;
  return new Date(nextIstDayStart - IST_OFFSET_MS);
}

export async function consumeDailyCap(
  store: CounterStore,
  userId: string,
  feature: DailyCapFeature,
  now: Date = new Date()
) {
  const { limit } = DAILY_CAPS[feature];
  const key = `cap:${feature}:${userId}:${istDayKey(now)}`;
  const used = await store.incr(key, COUNTER_TTL_SECONDS);
  return {
    allowed: used <= limit,
    limit,
    remaining: Math.max(0, limit - used),
    resetAt: nextIstMidnight(now),
  };
}

let defaultStore: CounterStore | null | undefined;

function getDefaultStore(): CounterStore | null {
  if (defaultStore !== undefined) return defaultStore;
  const config = getRedisRestConfig();
  if (!config) {
    console.warn("[daily-cap] Upstash Redis not configured; daily caps are off");
    defaultStore = null;
    return defaultStore;
  }
  const redis = new Redis(config);
  defaultStore = {
    async incr(key, ttlSeconds) {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, ttlSeconds);
      return count;
    },
  };
  return defaultStore;
}

/**
 * Count one use of `feature` for this user. Returns a 429 response once the
 * day's cap is used up, otherwise null (carry on).
 */
export async function enforceDailyCap(
  userId: string,
  feature: DailyCapFeature,
  options: { store?: CounterStore | null; now?: Date } = {}
): Promise<NextResponse | null> {
  const store = "store" in options ? options.store ?? null : getDefaultStore();
  if (!store) return null;

  const now = options.now ?? new Date();
  try {
    const result = await consumeDailyCap(store, userId, feature, now);
    if (result.allowed) return null;

    const { label } = DAILY_CAPS[feature];
    const retryAfter = Math.max(1, Math.ceil((result.resetAt.getTime() - now.getTime()) / 1000));
    return NextResponse.json(
      {
        error: `Daily limit reached: you've used all ${result.limit} ${label} for today. It resets at midnight.`,
        code: "DAILY_CAP",
        limit: result.limit,
        resetAt: result.resetAt.toISOString(),
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(result.limit),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  } catch (error) {
    console.error(`[daily-cap] ${feature} check failed; allowing request`, error);
    return null;
  }
}
