"use client";

import { motion } from "framer-motion";
import { Flame } from "lucide-react";

interface StreakCardProps {
  currentStreak: number;
  maxStreak: number;
}

export function StreakCard({ currentStreak, maxStreak }: StreakCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6 streak-glow"
    >
      <div className="flex items-center gap-4">
        <div className="relative">
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="p-4 rounded-full bg-accent/20"
          >
            <Flame className="w-10 h-10 text-accent" />
          </motion.div>
          {currentStreak > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-6 h-6 bg-accent rounded-full flex items-center justify-center text-xs font-bold text-accent-foreground"
            >
              {currentStreak}
            </motion.div>
          )}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Current Streak</p>
          <p className="text-4xl font-bold text-accent">
            {currentStreak} <span className="text-lg">days</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Best: {maxStreak} days
          </p>
        </div>
      </div>
    </motion.div>
  );
}
