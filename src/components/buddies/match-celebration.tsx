"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useBuddyStore } from "@/stores/buddy-store";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, ArrowRight } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useEffect } from "react";

export function MatchCelebration() {
  const { newMatch, dismissMatch, setActiveMatch } = useBuddyStore();
  const { profile } = useAuthStore();

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (newMatch) {
      const timer = setTimeout(dismissMatch, 8000);
      return () => clearTimeout(timer);
    }
  }, [newMatch, dismissMatch]);

  return (
    <AnimatePresence>
      {newMatch && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={dismissMatch}
          />

          {/* Content */}
          <motion.div
            className="relative z-10 flex flex-col items-center px-6"
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 20 }}
            transition={{ type: "spring", bounce: 0.4 }}
          >
            {/* Avatars */}
            <div className="flex items-center gap-4 mb-6">
              {/* Your avatar */}
              <motion.div
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring", bounce: 0.5 }}
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="w-20 h-20 rounded-full object-cover border-2 border-pink-500 shadow-lg shadow-pink-500/20"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary border-2 border-pink-500">
                    {(profile?.full_name || "?")[0].toUpperCase()}
                  </div>
                )}
              </motion.div>

              {/* Heart */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4, type: "spring", bounce: 0.6 }}
              >
                <Heart className="w-10 h-10 text-pink-500 fill-pink-500" />
              </motion.div>

              {/* Buddy avatar */}
              <motion.div
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring", bounce: 0.5 }}
              >
                {newMatch.buddy.avatar_url ? (
                  <img
                    src={newMatch.buddy.avatar_url}
                    alt=""
                    className="w-20 h-20 rounded-full object-cover border-2 border-pink-500 shadow-lg shadow-pink-500/20"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary border-2 border-pink-500">
                    {(newMatch.buddy.full_name || newMatch.buddy.username || "?")[0].toUpperCase()}
                  </div>
                )}
              </motion.div>
            </div>

            {/* Title */}
            <motion.h2
              className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 mb-2"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: "spring", bounce: 0.5 }}
            >
              It&apos;s a Match!
            </motion.h2>
            <motion.p
              className="text-zinc-400 text-sm mb-8 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              You and {newMatch.buddy.full_name || newMatch.buddy.username} want to study together
            </motion.p>

            {/* Buttons */}
            <motion.div
              className="flex flex-col gap-3 w-full max-w-xs"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <Button
                onClick={() => {
                  setActiveMatch(newMatch.matchId);
                  dismissMatch();
                }}
                className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
                size="lg"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Send a Message
              </Button>
              <Button
                onClick={dismissMatch}
                variant="ghost"
                className="w-full text-zinc-400 hover:text-white"
              >
                Keep Swiping
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
