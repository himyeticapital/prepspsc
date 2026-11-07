/**
 * Gemini models used by PrepSPSC.
 *
 * - basic:  the free default for every student-facing AI feature (cheapest current model
 *           with good quality).
 * - better: an optional paid upgrade. A student who doesn't like an answer can regenerate it
 *           with this model, paid from their prepaid credits (see src/lib/credits.ts).
 *
 * Swap models without a code change via GEMINI_BASIC_MODEL / GEMINI_BETTER_MODEL.
 * Prices (Nov 2026, per 1M tokens in/out): gemini-3.1-flash-lite $0.25/$1.50,
 * gemini-3-flash-preview $0.50/$3.00, gemini-2.5-flash-lite $0.10/$0.40.
 */
export const AI_MODELS = {
  basic: process.env.GEMINI_BASIC_MODEL || "gemini-3.1-flash-lite",
  better: process.env.GEMINI_BETTER_MODEL || "gemini-3-flash-preview",
} as const;

export type ModelTier = keyof typeof AI_MODELS;

/** If the basic model is unavailable, fall back to something cheaper, never pricier. */
export const BASIC_MODEL_CHAIN: readonly string[] = Array.from(
  new Set([AI_MODELS.basic, "gemini-2.5-flash-lite"])
);

export function modelForTier(tier: ModelTier): string {
  return AI_MODELS[tier];
}
