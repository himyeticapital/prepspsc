import { describe, expect, it } from "vitest";
import {
  DAILY_CAPS,
  consumeDailyCap,
  enforceDailyCap,
  istDayKey,
  nextIstMidnight,
  type CounterStore,
} from "@/lib/daily-cap";

function memoryStore() {
  const counts = new Map<string, number>();
  const ttls = new Map<string, number>();
  const store: CounterStore = {
    async incr(key, ttlSeconds) {
      const n = (counts.get(key) ?? 0) + 1;
      counts.set(key, n);
      if (n === 1) ttls.set(key, ttlSeconds);
      return n;
    },
  };
  return { store, counts, ttls };
}

const brokenStore: CounterStore = {
  async incr() {
    throw new Error("redis down");
  },
};

// 07:00 IST on 7 Nov 2026
const NOW = new Date("2026-11-07T01:30:00Z");

describe("IST day boundaries", () => {
  it("rolls the day over at midnight IST, not UTC", () => {
    expect(istDayKey(new Date("2026-11-06T18:29:59Z"))).toBe("2026-11-06");
    expect(istDayKey(new Date("2026-11-06T18:30:00Z"))).toBe("2026-11-07");
  });

  it("finds the next midnight IST", () => {
    expect(nextIstMidnight(NOW).toISOString()).toBe("2026-11-07T18:30:00.000Z");
  });
});

describe("consumeDailyCap", () => {
  it("allows up to the cap, then blocks", async () => {
    const { store } = memoryStore();
    const { limit } = DAILY_CAPS.aiGeneration;
    for (let i = 1; i <= limit; i++) {
      const r = await consumeDailyCap(store, "user-1", "aiGeneration", NOW);
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(limit - i);
    }
    const over = await consumeDailyCap(store, "user-1", "aiGeneration", NOW);
    expect(over.allowed).toBe(false);
    expect(over.remaining).toBe(0);
    expect(over.limit).toBe(limit);
  });

  it("counts each user and each feature separately", async () => {
    const { store } = memoryStore();
    const { limit } = DAILY_CAPS.studyPlan;
    for (let i = 0; i < limit; i++) await consumeDailyCap(store, "user-1", "studyPlan", NOW);
    expect((await consumeDailyCap(store, "user-1", "studyPlan", NOW)).allowed).toBe(false);
    expect((await consumeDailyCap(store, "user-2", "studyPlan", NOW)).allowed).toBe(true);
    expect((await consumeDailyCap(store, "user-1", "paperBlurt", NOW)).allowed).toBe(true);
  });

  it("starts fresh the next IST day and expires old counters", async () => {
    const { store, ttls } = memoryStore();
    const { limit } = DAILY_CAPS.examExtraction;
    for (let i = 0; i <= limit; i++) await consumeDailyCap(store, "user-1", "examExtraction", NOW);
    const tomorrow = new Date("2026-11-07T18:30:00Z");
    expect((await consumeDailyCap(store, "user-1", "examExtraction", tomorrow)).allowed).toBe(true);
    for (const ttl of ttls.values()) expect(ttl).toBeGreaterThanOrEqual(24 * 60 * 60);
  });
});

describe("enforceDailyCap", () => {
  it("lets requests through under the cap", async () => {
    const { store } = memoryStore();
    expect(await enforceDailyCap("user-1", "paperBlurt", { store, now: NOW })).toBeNull();
  });

  it("returns a friendly 429 once the cap is used up", async () => {
    const { store } = memoryStore();
    const { limit } = DAILY_CAPS.paperBlurt;
    for (let i = 0; i < limit; i++) await enforceDailyCap("user-1", "paperBlurt", { store, now: NOW });
    const res = await enforceDailyCap("user-1", "paperBlurt", { store, now: NOW });
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    expect(Number(res!.headers.get("Retry-After"))).toBeGreaterThan(0);
    const body = await res!.json();
    expect(body.code).toBe("DAILY_CAP");
    expect(body.limit).toBe(limit);
    expect(body.error).toContain(String(limit));
    expect(body.error).not.toMatch(/upgrade/i);
  });

  it("fails open when the counter store errors or is not configured", async () => {
    expect(await enforceDailyCap("user-1", "aiGeneration", { store: brokenStore, now: NOW })).toBeNull();
    expect(await enforceDailyCap("user-1", "aiGeneration", { store: null, now: NOW })).toBeNull();
  });
});
