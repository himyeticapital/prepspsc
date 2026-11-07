"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SwipeStack } from "@/components/buddies/swipe-stack";
import { MatchList } from "@/components/buddies/match-list";
import { MatchCelebration } from "@/components/buddies/match-celebration";
import { BuddyChat } from "@/components/buddies/buddy-chat";
import { AddBuddyDialog } from "@/components/buddies/add-buddy-dialog";

import { useBuddyStore } from "@/stores/buddy-store";
import { useAuthStore } from "@/stores/auth-store";
import { Heart, Users, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export function BuddiesClient() {
  const { profile } = useAuthStore();
  const searchParams = useSearchParams();
  const {
    fetchCandidates,
    fetchMatches,
    subscribeToUpdates,
    activeMatchId,
    setActiveMatch,
    matches,
    incomingRequests,
    isLoadingRequests,
    fetchRequests,
    respondToRequest,
  } = useBuddyStore();
  const [activeTab, setActiveTab] = useState("discover");
  const inviteHandled = useRef(false);

  const userId = profile?.id;

  useEffect(() => {
    if (!userId) return;
    fetchCandidates(userId);
    fetchMatches(userId);
    fetchRequests(userId);
    const unsubscribe = subscribeToUpdates(userId);
    return () => unsubscribe();
  }, [userId, fetchCandidates, fetchMatches, fetchRequests, subscribeToUpdates]);

  // Handle invite link: ?invite=<userId>
  useEffect(() => {
    if (!userId || inviteHandled.current) return;
    const inviteId = searchParams.get("invite");
    if (!inviteId || inviteId === userId) return;

    inviteHandled.current = true;

    (async () => {
      try {
        const res = await fetch("/api/buddy/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_user_id: inviteId, source: "invite" }),
        });
        const data = await res.json();

        if (data.matched) {
          toast.success(
            data.alreadyMatched
              ? "You're already matched!"
              : `Matched with ${data.buddyProfile.full_name || data.buddyProfile.username}!`
          );
          fetchMatches(userId);
          setActiveTab("matches");
        } else {
          toast.error(data.error || "Failed to add buddy");
        }
      } catch {
        toast.error("Something went wrong with the invite link");
      }

      // Clean up the URL
      const url = new URL(window.location.href);
      url.searchParams.delete("invite");
      window.history.replaceState({}, "", url.pathname);
    })();
  }, [userId, searchParams, fetchMatches]);

  const totalUnread = matches.reduce((sum, m) => sum + m.unreadCount, 0);

  if (!userId) return null;

  // If a chat is open, show it full screen
  if (activeMatchId !== null) {
    return (
      <div className="h-[calc(100vh-8rem)] md:h-[calc(100vh-6rem)] max-w-lg mx-auto bg-zinc-900/40 rounded-2xl border border-white/5 overflow-hidden">
        <BuddyChat
          matchId={activeMatchId}
          userId={userId}
          onBack={() => setActiveMatch(null)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
          <Heart className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Study Buddy</h1>
          <p className="text-xs text-zinc-400">Find your study partner</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-zinc-900/60 border border-white/5 rounded-xl p-1 mb-4">
          <TabsTrigger
            value="discover"
            className="rounded-lg data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400"
          >
            <Users className="w-4 h-4 mr-2" />
            Discover
          </TabsTrigger>
          <TabsTrigger
            value="matches"
            className="rounded-lg data-[state=active]:bg-zinc-800 data-[state=active]:text-white text-zinc-400 relative"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Matches
            {(totalUnread + incomingRequests.length) > 0 && (
              <span className="ml-1.5 w-5 h-5 bg-pink-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
                {(totalUnread + incomingRequests.length) > 9 ? "9+" : totalUnread + incomingRequests.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="discover" className="mt-0">
          <SwipeStack userId={userId} />
        </TabsContent>

        <TabsContent value="matches" className="mt-0">
          <div className="flex justify-end mb-3">
            <AddBuddyDialog userId={userId} />
          </div>

          {/* Incoming Requests */}
          {incomingRequests.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider px-1">
                Buddy Requests
              </p>
              {incomingRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-zinc-800/50 border border-pink-500/20"
                >
                  {req.sender.avatar_url ? (
                    <img
                      src={req.sender.avatar_url}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                      {(req.sender.full_name || req.sender.username || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {req.sender.full_name || req.sender.username}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Lv.{req.sender.xp_level || 1} wants to be your study buddy
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={async () => {
                        try {
                          await respondToRequest(req.id, "accept", userId);
                          toast.success(`Matched with ${req.sender.full_name || req.sender.username}!`);
                        } catch {
                          toast.error("Failed to accept request");
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-pink-500 text-white hover:bg-pink-600 transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await respondToRequest(req.id, "decline", userId);
                        } catch {
                          toast.error("Failed to decline request");
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <MatchList
            userId={userId}
            onOpenChat={(matchId) => setActiveMatch(matchId)}
          />
        </TabsContent>
      </Tabs>

      {/* Match Celebration Overlay */}
      <MatchCelebration />
    </div>
  );
}
