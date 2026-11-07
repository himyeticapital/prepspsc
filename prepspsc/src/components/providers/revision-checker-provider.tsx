"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRevisionChecker } from "@/hooks/use-revision-checker";

export function RevisionCheckerProvider() {
  const [userId, setUserId] = useState<string | undefined>();

  useEffect(() => {
    const supabase = createClient();

    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUserId(session?.user?.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Use the revision checker hook
  useRevisionChecker(userId);

  return null; // This component doesn't render anything
}
