import { afterEach, describe, expect, it, vi } from "vitest";

const KEYS = ["GEMINI_BASIC_MODEL", "GEMINI_BETTER_MODEL"] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.resetModules();
});

async function load() {
  vi.resetModules();
  return import("@/lib/ai-models");
}

describe("AI model tiers", () => {
  it("uses Gemini 3.1 Flash-Lite as the free default and Gemini 3 Flash as the paid upgrade", async () => {
    for (const k of KEYS) delete process.env[k];
    const { AI_MODELS, modelForTier } = await load();
    expect(AI_MODELS.basic).toBe("gemini-3.1-flash-lite");
    expect(AI_MODELS.better).toBe("gemini-3-flash-preview");
    expect(modelForTier("basic")).toBe("gemini-3.1-flash-lite");
    expect(modelForTier("better")).toBe("gemini-3-flash-preview");
  });

  it("falls back to an even cheaper model, never a pricier one", async () => {
    const { BASIC_MODEL_CHAIN } = await load();
    expect(BASIC_MODEL_CHAIN[0]).toBe("gemini-3.1-flash-lite");
    expect(BASIC_MODEL_CHAIN).toContain("gemini-2.5-flash-lite");
    expect(BASIC_MODEL_CHAIN).not.toContain("gemini-3-flash-preview");
  });

  it("lets env vars swap models without a code change", async () => {
    process.env.GEMINI_BASIC_MODEL = "gemini-2.5-flash-lite";
    process.env.GEMINI_BETTER_MODEL = "gemini-3.5-flash";
    const { AI_MODELS } = await load();
    expect(AI_MODELS.basic).toBe("gemini-2.5-flash-lite");
    expect(AI_MODELS.better).toBe("gemini-3.5-flash");
  });
});
