import { createBrowserClient } from "@supabase/ssr";

// Singleton instance to avoid multiple clients competing for browser locks
let browserClient: ReturnType<typeof createBrowserClient<any>> | null = null;

// No-op lock function to prevent AbortError from Navigator Lock API
// See: https://github.com/supabase/supabase-js/issues/1517
const noOpLock = async <T>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<T>
): Promise<T> => {
  return await fn();
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createClient(): ReturnType<typeof createBrowserClient<any>> {
  if (typeof window === "undefined") {
    // Server-side: always create a new client (this shouldn't be called server-side anyway)
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  // Client-side: use singleton to prevent multiple client issues
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          // Use no-op lock to prevent AbortError from Navigator Lock API
          // This is safe because we're using a singleton pattern
          lock: noOpLock,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      }
    );
  }

  return browserClient;
}

// Reset the singleton (useful after logout to get fresh auth state)
export function resetClient(): void {
  browserClient = null;
}
