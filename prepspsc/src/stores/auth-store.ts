import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import { useNotificationStore } from "@/stores/notification-store";
import type { Profile } from "@/types/database.types";
import type { User, Subscription } from "@supabase/supabase-js";

// Helper to clear user-specific localStorage data
const clearUserLocalStorage = () => {
  // Clear notification store
  useNotificationStore.getState().clearAllNotifications();

  // Clear revision checker localStorage keys
  localStorage.removeItem("study-ai-last-revision-check");
  localStorage.removeItem("study-ai-notified-goals");
};

// Store auth subscription outside Zustand to prevent stacking listeners
let authSubscription: Subscription | null = null;

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isInitialized: boolean;
  initialize: () => Promise<void>;
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<boolean>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  isInitialized: false,

  initialize: async () => {
    try {
      const supabase = createClient();

      // Get initial session
      const { data: { user }, error } = await supabase.auth.getUser();

      // Ignore abort errors during initialization
      if (error) {
        if (error.message?.includes("aborted") || error.message?.includes("AbortError")) {
          set({ isLoading: false, isInitialized: true });
          return;
        }
      }

      set({ user, isLoading: false, isInitialized: true });

      // Check if notifications belong to this user (migration for stale data)
      useNotificationStore.getState().setUserId(user?.id ?? null);

      if (user) {
        await get().fetchProfile();
      }

      // Clean up any existing listener before creating a new one
      if (authSubscription) {
        authSubscription.unsubscribe();
        authSubscription = null;
      }

      // Listen for auth changes
      // IMPORTANT: Don't use await inside onAuthStateChange to avoid deadlocks
      // See: https://supabase.com/docs/reference/javascript/auth-onauthstatechange
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        const newUser = session?.user ?? null;
        const currentUser = get().user;

        // Clear user-specific data if user changed (different user logged in)
        if (currentUser && newUser && currentUser.id !== newUser.id) {
          clearUserLocalStorage();
        }

        // Also clear on sign out
        if (event === "SIGNED_OUT") {
          clearUserLocalStorage();
        }

        set({ user: newUser });

        // Update notification store's user ID tracking
        useNotificationStore.getState().setUserId(newUser?.id ?? null);

        if (newUser) {
          // Use setTimeout to defer the async call and avoid deadlock
          setTimeout(() => {
            get().fetchProfile();
          }, 0);
        } else {
          set({ profile: null });
        }
      });

      // Store subscription for cleanup
      authSubscription = subscription;
    } catch (err: unknown) {
      // Ignore abort errors
      if (err instanceof Error && (err.name === "AbortError" || err.message?.includes("aborted"))) {
        set({ isLoading: false, isInitialized: true });
        return;
      }
      console.error("Error initializing auth:", err);
      set({ isLoading: false, isInitialized: true });
    }
  },

  setUser: (user) => set({ user }),

  setProfile: (profile) => set({ profile }),

  fetchProfile: async () => {
    const { user } = get();
    if (!user) return;

    try {
      const supabase = createClient();
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      // Ignore abort errors silently
      if (error) {
        if (error.message?.includes("aborted") || error.message?.includes("AbortError")) {
          return;
        }
        console.error("Error fetching profile:", error);
        return;
      }

      // Check if Pro membership has expired
      if (profile?.is_pro_member && profile?.pro_expires_at) {
        const expiresAt = new Date(profile.pro_expires_at);
        if (expiresAt < new Date()) {
          // Pro has expired — revoke access
          await supabase
            .from("profiles")
            .update({
              is_pro_member: false,
              pro_cancelled: false,
              updated_at: new Date().toISOString(),
            })
            .eq("id", user.id);

          profile.is_pro_member = false;
          profile.pro_cancelled = false;
        }
      }

      set({ profile });
    } catch (err: unknown) {
      // Ignore abort errors
      if (err instanceof Error && (err.name === "AbortError" || err.message?.includes("aborted"))) {
        return;
      }
      console.error("Error fetching profile:", err);
    }
  },

  updateProfile: async (updates) => {
    const { user, profile } = get();
    if (!user) return false;

    const supabase = createClient();

    // Check username uniqueness if username is being updated
    if (updates.username && updates.username !== profile?.username) {
      const { data: existingUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", updates.username)
        .neq("id", user.id)
        .single();

      if (existingUser) {
        // Username is already taken
        throw new Error("USERNAME_TAKEN");
      }
    }

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (error) {
      console.error("Error updating profile:", error);
      return false;
    }

    // Refresh profile to get updated data
    await get().fetchProfile();
    return true;
  },

  signOut: async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearUserLocalStorage();
    set({ user: null, profile: null });
    window.location.href = "/login";
  },
}));
