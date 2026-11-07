import { z } from "zod";

/**
 * Server-side environment variables (never exposed to client).
 * Validated at import time — missing vars will throw immediately.
 */
const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  GOOGLE_GEMINI_API_KEY: z.string().min(1, "GOOGLE_GEMINI_API_KEY is required"),
  CASHFREE_APP_ID: z.string().min(1, "CASHFREE_APP_ID is required"),
  CASHFREE_SECRET_KEY: z.string().min(1, "CASHFREE_SECRET_KEY is required"),
  CASHFREE_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
  RESEND_FROM_EMAIL: z.string().min(1, "RESEND_FROM_EMAIL is required"),
  UPSTASH_REDIS_REST_URL: z.string().url("UPSTASH_REDIS_REST_URL must be a valid URL"),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1, "UPSTASH_REDIS_REST_TOKEN is required"),
  TURNSTILE_SECRET_KEY: z.string().min(1, "TURNSTILE_SECRET_KEY is required"),
  CRON_SECRET: z.string().min(1, "CRON_SECRET is required"),
});

/**
 * Client-side environment variables (exposed via NEXT_PUBLIC_ prefix).
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  NEXT_PUBLIC_CASHFREE_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1, "NEXT_PUBLIC_TURNSTILE_SITE_KEY is required"),
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL"),
});

function validateServerEnv() {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    const missing = Object.entries(errors)
      .map(([key, msgs]) => `  ${key}: ${msgs?.join(", ")}`)
      .join("\n");
    throw new Error(`Missing or invalid server environment variables:\n${missing}`);
  }
  return parsed.data;
}

function validateClientEnv() {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_CASHFREE_ENV: process.env.NEXT_PUBLIC_CASHFREE_ENV,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    const missing = Object.entries(errors)
      .map(([key, msgs]) => `  ${key}: ${msgs?.join(", ")}`)
      .join("\n");
    throw new Error(`Missing or invalid client environment variables:\n${missing}`);
  }
  return parsed.data;
}

/**
 * Validated server environment variables.
 * Import this in API routes to get type-safe env access.
 *
 * Usage: import { serverEnv } from "@/lib/env";
 */
export const serverEnv = validateServerEnv();

/**
 * Validated client environment variables.
 *
 * Usage: import { clientEnv } from "@/lib/env";
 */
export const clientEnv = validateClientEnv();
