"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { StudyTimer } from "@/components/room/study-timer";
import { ChatRoom } from "@/components/room/chat-room";
import { TableSelector } from "@/components/room/table-selector";
import { ChatToggle } from "@/components/room/chat-toggle";
import { OnlinePresence } from "@/components/rooms/online-presence";
import { useTableStore } from "@/stores/table-store";
import { toast } from "sonner";
import { Users, Sparkles, Lightbulb, ArrowLeft, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Room, Profile } from "@/types/database.types";

interface RoomClientProps {
  room: Room;
  userId: string;
  userRole: string;
  userProfile?: Profile | null;
  isSubscribed?: boolean;
}

export function RoomClient({ room, userId, userRole, userProfile, isSubscribed = false }: RoomClientProps) {
  const [totalMinutesToday, setTotalMinutesToday] = useState(0);
  const supabase = useMemo(() => createClient(), []);

  const {
    currentTableId,
    chatScope,
    fetchTables,
    setChatScope,
    subscribeToTables,
    reset,
  } = useTableStore();

  // Initialize tables when component mounts
  useEffect(() => {
    if (room.id) {
      fetchTables(room.id);
      const unsubscribe = subscribeToTables(room.id);

      return () => {
        unsubscribe();
        reset();
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id]);

  // Handle session completion
  // Note: The actual sync to database (including XP) is handled by the timer store's
  // addToHistory -> syncStudyTimeToDatabase flow. This callback is just for UI feedback.
  const handleSessionComplete = (minutes: number) => {
    setTotalMinutesToday((prev) => prev + minutes);
    toast.success(`Great job! ${minutes} minutes logged. +${minutes} XP earned!`);
  };

  const isPremiumRoom = room.privacy_level === "premium";

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="widget-glass p-6 rounded-2xl"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Link href="/rooms">
              <Button
                variant="ghost"
                size="sm"
                className="text-white/60 hover:text-white mr-2"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-white">
                  {room.name}
                </h1>
                {isPremiumRoom && (
                  <Crown className="w-5 h-5 text-orange-400" />
                )}
              </div>
              {room.description && (
                <p className="text-white/60 text-sm">{room.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <OnlinePresence roomId={room.id} compact />
            {totalMinutesToday > 0 && (
              <span className="px-3 py-1.5 rounded-full text-xs bg-primary/20 text-primary flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" />
                {totalMinutesToday}m today
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Table Selector */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <TableSelector
          roomId={room.id}
          roomName={room.name}
          userId={userId}
          maxTables={room.max_tables || 20}
        />
      </motion.div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Timer Section */}
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="widget-glass p-5 rounded-2xl"
          >
            <StudyTimer onSessionComplete={handleSessionComplete} isPro={!!userProfile?.is_pro_member} />
          </motion.div>

          {/* Study Tips */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="widget-glass p-5 rounded-2xl"
          >
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-400" />
              Study Tips
            </h3>
            <ul className="text-sm text-white/60 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Take a 5-minute break after every 25 minutes of study
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Stay hydrated and keep water nearby
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Review what you learned at the end of each session
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Set specific goals before starting each session
              </li>
            </ul>
          </motion.div>
        </div>

        {/* Chat Section */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="widget-glass rounded-2xl overflow-hidden flex flex-col h-[600px]"
        >
          {/* Chat Header with Toggle */}
          <div className="p-4 border-b border-white/10 flex-shrink-0">
            <ChatToggle
              currentScope={chatScope}
              onScopeChange={setChatScope}
              isAtTable={!!currentTableId}
            />
          </div>

          {/* Chat Content */}
          <div className="p-4 flex-1 min-h-0 flex flex-col overflow-hidden">
            <ChatRoom
              roomId={room.id}
              userId={userId}
              userRole={userRole}
              userProfile={userProfile}
              tableId={currentTableId}
              messageScope={chatScope}
              readOnly={!isSubscribed}
            />
          </div>
        </motion.div>
      </div>

      {/* Online Presence - Full View */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <OnlinePresence roomId={room.id} maxAvatars={10} />
      </motion.div>
    </div>
  );
}
