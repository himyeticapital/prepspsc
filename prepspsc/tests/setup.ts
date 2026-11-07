import { config } from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Load .env.local
config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  throw new Error(
    "Missing Supabase env vars. Ensure .env.local has NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY"
  );
}

/**
 * Service role client — bypasses RLS, used for test setup/teardown
 */
export const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Create an authenticated Supabase client for a test user.
 * Uses the anon key but sets the session to the given user's access token.
 */
export async function createAuthenticatedClient(
  email: string,
  password: string
): Promise<SupabaseClient> {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Failed to sign in as ${email}: ${error.message}`);
  }

  return client;
}

/**
 * Create a test user via admin API. Returns the user ID.
 * Handles race conditions when multiple test files run in parallel.
 */
export async function createTestUser(
  email: string,
  password: string
): Promise<string> {
  // Try to create the user
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  // If created successfully, return the ID
  if (!error && data?.user) {
    return data.user.id;
  }

  // If user already exists (race condition or previous run), look them up
  const { data: existingUsers } = await adminClient.auth.admin.listUsers();
  const existing = existingUsers?.users?.find((u) => u.email === email);
  if (existing) {
    return existing.id;
  }

  throw new Error(`Failed to create test user ${email}: ${error?.message}`);
}

/**
 * Delete a test user and their data.
 * Silently ignores invalid IDs (e.g., if user creation failed).
 */
export async function deleteTestUser(userId: string): Promise<void> {
  if (!userId || userId.length < 36) return;
  try {
    await adminClient.auth.admin.deleteUser(userId);
  } catch {
    // Ignore — user may already be deleted or never created
  }
}

// Test user credentials
export const TEST_USER_A = {
  email: "rls-test-user-a@prepspsc-test.local",
  password: "TestPassword123!",
};

export const TEST_USER_B = {
  email: "rls-test-user-b@prepspsc-test.local",
  password: "TestPassword456!",
};
