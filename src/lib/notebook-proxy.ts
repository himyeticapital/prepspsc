import { createClient } from "@/lib/supabase/client";

/**
 * Calls the open-notebook-proxy Edge Function.
 * Uses supabase.functions.invoke() which handles auth internally.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function proxyNotebook(body: Record<string, unknown> | FormData): Promise<any> {
  const supabase = createClient();

  const isFormData = body instanceof FormData;

  // Use supabase.functions.invoke() — handles auth token automatically
  const { data, error } = await supabase.functions.invoke("open-notebook-proxy", {
    body: isFormData ? body : body,
  });

  if (error) {
    const msg = error.message || String(error);
    console.error("[notebook-proxy] Edge function error:", msg);

    if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("Invalid JWT")) {
      // Try once more after refreshing session
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        throw new Error("Session expired. Please refresh the page and log in again.");
      }

      // Retry with refreshed session
      const { data: retryData, error: retryError } = await supabase.functions.invoke("open-notebook-proxy", {
        body: isFormData ? body : body,
      });

      if (retryError) {
        throw new Error("Session expired. Please refresh the page and log in again.");
      }
      return retryData;
    }

    throw new Error(`Edge Function error: ${msg}`);
  }

  return data;
}
