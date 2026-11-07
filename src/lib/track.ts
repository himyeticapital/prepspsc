import { createClient } from "@/lib/supabase/client";

export function trackFeatureUsage(
  feature: string,
  action: string,
  metadata?: Record<string, unknown>
) {
  const supabase = createClient();
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (!user) return;
    supabase
      .from("feature_usage")
      .insert({
        user_id: user.id,
        feature,
        action,
        metadata: metadata || {},
      })
      .then(() => {}); // fire and forget
  });
}
