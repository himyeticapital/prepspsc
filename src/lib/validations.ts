import { z } from "zod";

// === Cashfree ===
export const createOrderSchema = z.object({
  planId: z.enum(["monthly", "yearly"]),
  turnstileToken: z.string().min(1).optional(),
});

export const verifyPaymentSchema = z.object({
  orderId: z.string().min(1).max(100),
  planId: z.enum(["monthly", "yearly"]),
});

// === Study AI ===
export const studyAIGenerateSchema = z.object({
  userId: z.string().uuid().optional(),
  goalId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]),
  generationType: z.enum(["mindmap", "summary", "flashcards", "quiz", "infographic"]),
  sourceContent: z.string().min(10).max(50000),
  // "better" = paid upgrade (Gemini 3 Flash), charged from the student's AI credits
  modelTier: z.enum(["basic", "better"]).optional().default("basic"),
});

// === Evaluate Test ===
export const evaluateTestSchema = z.object({
  attemptId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]),
});

// === Sync Study Time ===
export const syncStudyTimeSchema = z.object({
  minutes: z.number().int().min(1).max(1440),
  sessionName: z.string().max(200).optional(),
  mode: z.string().max(50).optional(),
});

// === Room Categories ===
export const createRoomCategorySchema = z.object({
  slug: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
  sort_order: z.number().int().min(0).max(1000).optional(),
});

// === Admin Delete Questions ===
export const deleteQuestionsSchema = z.object({
  questionIds: z.array(z.number().int().positive()).max(500).optional(),
  testId: z.number().int().positive().optional(),
  deleteAll: z.boolean().optional(),
}).refine(
  (data) => data.questionIds || data.testId,
  { message: "Either questionIds or testId is required" }
);

// === News ===
export const newsQuerySchema = z.object({
  category: z.enum(["sikkim", "national", "international"]),
});

// === Parse Content ===
export const parseContentSchema = z.object({
  type: z.enum(["youtube"]),
  url: z.string().url().optional(),
  videoId: z.string().max(50).optional(),
}).refine(
  (data) => data.url || data.videoId,
  { message: "Either url or videoId is required" }
);

// === Cancel Subscription ===
export const cancelSubscriptionSchema = z.object({
  reason: z.string().max(500).optional(),
});

/**
 * Parse and validate request body with Zod.
 * Returns parsed data or error details.
 */
export function validateBody<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string; details: z.ZodIssue[] } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: "Validation failed",
      details: result.error.issues,
    };
  }
  return { success: true, data: result.data };
}
