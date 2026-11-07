"use client";

import { useParams, notFound, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { RoomClient } from "./room-client";
import { useAuthStore } from "@/stores/auth-store";
import { useRoomStore } from "@/stores/room-store";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Crown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Room } from "@/types/database.types";

export default function RoomPage() {
  const params = useParams();
  const roomId = parseInt(params.id as string);
  const router = useRouter();
  const { user, profile, isLoading: authLoading } = useAuthStore();
  const { subscriptions, fetchSubscriptions } = useRoomStore();
  const [room, setRoom] = useState<Room | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFoundError, setNotFoundError] = useState(false);

  // Fetch subscriptions when user is available
  useEffect(() => {
    if (user?.id) {
      fetchSubscriptions(user.id);
    }
  }, [user?.id, fetchSubscriptions]);

  const isSubscribed = subscriptions.some((s) => s.room_id === roomId);

  const fetchRoom = useCallback(async (id: number, signal: { cancelled: boolean }) => {
    const supabase = createClient();

    try {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("id", id)
        .single();

      if (signal.cancelled) return;

      if (error) {
        // Ignore AbortError but don't block loading
        if (error.message?.includes("aborted") || error.message?.includes("AbortError")) {
          // Still allow loading to complete on next valid fetch
          return;
        }
        console.error("Failed to fetch room:", error.message);
        setNotFoundError(true);
      } else if (data) {
        setRoom(data);
      } else {
        setNotFoundError(true);
      }
    } catch (err: any) {
      if (signal.cancelled) return;
      // Ignore AbortError
      if (err?.name === "AbortError" || err?.message?.includes("aborted")) {
        return;
      }
      console.error("Error fetching room:", err);
      setNotFoundError(true);
    } finally {
      // Always set loading to false if not cancelled
      if (!signal.cancelled) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // Validate roomId is a valid number
    if (!roomId || isNaN(roomId)) {
      setIsLoading(false);
      setNotFoundError(true);
      return;
    }

    const signal = { cancelled: false };

    setIsLoading(true);
    setRoom(null);
    setNotFoundError(false);
    fetchRoom(roomId, signal);

    return () => {
      signal.cancelled = true;
    };
  }, [roomId, fetchRoom]);

  if (notFoundError) {
    notFound();
  }

  // Only show loading if we're actively fetching the room
  // Don't block on authLoading - show the room while auth loads in background
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // If loading is done but no room, show not found
  if (!room) {
    notFound();
  }

  // Premium room access control: only Pro members can enter
  if (room.privacy_level === "premium" && !authLoading && !profile?.is_pro_member) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="widget-glass p-8 rounded-2xl text-center max-w-sm">
          <div className="w-14 h-14 rounded-xl bg-orange-500/20 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-orange-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Premium Room</h2>
          <p className="text-white/60 text-sm mb-6">
            This room is exclusive to Pro members. Upgrade to access premium study rooms and collaborate with other Pro members.
          </p>
          <Button
            onClick={() => router.push("/pricing")}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Crown className="w-4 h-4 mr-2" />
            Upgrade to Pro
          </Button>
        </div>
      </div>
    );
  }

  return (
    <RoomClient
      room={room}
      userId={user?.id || ""}
      userRole={profile?.role || "user"}
      userProfile={profile}
      isSubscribed={isSubscribed}
    />
  );
}
