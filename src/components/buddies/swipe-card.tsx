"use client";

import { motion, useMotionValue, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";
import { Flame, BookOpen, Clock, Brain, Heart, X, Sparkles } from "lucide-react";
import type { BuddyCandidate } from "@/stores/buddy-store";
import { getExamLabel } from "@/lib/exam-options";

interface SwipeCardProps {
  candidate: BuddyCandidate;
  onSwipe: (direction: "like" | "pass") => void;
  isTop: boolean;
  index: number;
}

function formatStudyTime(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function SwipeCard({ candidate, onSwipe, isTop, index }: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const passOpacity = useTransform(x, [-100, 0], [1, 0]);

  const handleDragEnd = (_: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    const threshold = 100;
    const velocityThreshold = 500;

    if (info.offset.x > threshold || info.velocity.x > velocityThreshold) {
      onSwipe("like");
    } else if (info.offset.x < -threshold || info.velocity.x < -velocityThreshold) {
      onSwipe("pass");
    }
  };

  const compatPercent = Math.round(candidate.compatibility_score);

  return (
    <motion.div
      className={cn(
        "absolute inset-0 touch-none",
        !isTop && "pointer-events-none"
      )}
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        scale: 1 - index * 0.05,
        zIndex: 10 - index,
      }}
      initial={{ scale: 1 - index * 0.05, y: index * 8 }}
      animate={{ scale: 1 - index * 0.05, y: index * 8 }}
      exit={{
        x: x.get() > 0 ? 300 : -300,
        opacity: 0,
        transition: { duration: 0.3 },
      }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
    >
      <div className="w-full h-full rounded-2xl overflow-hidden border border-white/10 bg-zinc-900/90 backdrop-blur-xl shadow-2xl">
        {/* Like/Pass overlays */}
        <motion.div
          className="absolute inset-0 z-10 flex items-center justify-center bg-green-500/20 rounded-2xl pointer-events-none"
          style={{ opacity: likeOpacity }}
        >
          <div className="border-4 border-green-400 rounded-xl px-6 py-2 rotate-[-20deg]">
            <span className="text-3xl font-bold text-green-400">LIKE</span>
          </div>
        </motion.div>
        <motion.div
          className="absolute inset-0 z-10 flex items-center justify-center bg-red-500/20 rounded-2xl pointer-events-none"
          style={{ opacity: passOpacity }}
        >
          <div className="border-4 border-red-400 rounded-xl px-6 py-2 rotate-[20deg]">
            <span className="text-3xl font-bold text-red-400">PASS</span>
          </div>
        </motion.div>

        {/* Card Content */}
        <div className="relative h-full flex flex-col p-6">
          {/* Compatibility Badge */}
          <div className="absolute top-4 right-4 z-20">
            <div className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold",
              compatPercent >= 70 ? "bg-green-500/20 text-green-400 border border-green-500/30" :
              compatPercent >= 40 ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
              "bg-zinc-700/50 text-zinc-400 border border-zinc-600/30"
            )}>
              <Sparkles className="w-3 h-3" />
              {compatPercent}%
            </div>
          </div>

          {/* Avatar + Name */}
          <div className="flex flex-col items-center mt-4 mb-6">
            {candidate.avatar_url ? (
              <img
                src={candidate.avatar_url}
                alt={candidate.full_name || ""}
                className="w-24 h-24 rounded-full object-cover border-2 border-primary/30 shadow-lg"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center text-3xl font-bold text-primary">
                {(candidate.full_name || candidate.username || "?")[0].toUpperCase()}
              </div>
            )}
            <h3 className="text-xl font-bold text-white mt-3">
              {candidate.full_name || candidate.username || "Study Buddy"}
            </h3>
            {candidate.username && candidate.full_name && (
              <p className="text-sm text-zinc-400">@{candidate.username}</p>
            )}
            {candidate.bio && (
              <p className="text-sm text-zinc-400 mt-1 text-center line-clamp-2 max-w-[250px]">
                {candidate.bio}
              </p>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="flex flex-col items-center p-2 rounded-xl bg-zinc-800/60">
              <Brain className="w-4 h-4 text-purple-400 mb-1" />
              <span className="text-lg font-bold text-white">Lv.{candidate.xp_level}</span>
              <span className="text-[10px] text-zinc-500">Level</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-xl bg-zinc-800/60">
              <Flame className="w-4 h-4 text-orange-400 mb-1" />
              <span className="text-lg font-bold text-white">{candidate.current_streak}</span>
              <span className="text-[10px] text-zinc-500">Streak</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-xl bg-zinc-800/60">
              <Clock className="w-4 h-4 text-blue-400 mb-1" />
              <span className="text-lg font-bold text-white">{formatStudyTime(candidate.total_minutes_all_time)}</span>
              <span className="text-[10px] text-zinc-500">Study Time</span>
            </div>
          </div>

          {/* Preparing For + Focus Areas */}
          <div className="flex-1 space-y-3">
            {candidate.preparing_for && candidate.preparing_for.length > 0 ? (
              <div className="flex items-start gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex flex-wrap gap-1">
                  {candidate.preparing_for.slice(0, 3).map((exam) => (
                    <span
                      key={exam}
                      className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    >
                      {getExamLabel(exam)}
                    </span>
                  ))}
                  {candidate.preparing_for.length > 3 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500">
                      +{candidate.preparing_for.length - 3}
                    </span>
                  )}
                </div>
              </div>
            ) : candidate.exam_type ? (
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-sm font-medium text-emerald-400">{candidate.exam_type}</span>
              </div>
            ) : null}
            {candidate.focus_areas && candidate.focus_areas.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {candidate.focus_areas.slice(0, 5).map((area) => (
                  <span
                    key={area}
                    className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700"
                  >
                    {area}
                  </span>
                ))}
                {candidate.focus_areas.length > 5 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500">
                    +{candidate.focus_areas.length - 5}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons (desktop fallback) */}
          <div className="flex items-center justify-center gap-6 mt-4">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => { x.set(-200); onSwipe("pass"); }}
              className="w-14 h-14 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-colors"
            >
              <X className="w-7 h-7" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => { x.set(200); onSwipe("like"); }}
              className="w-14 h-14 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-green-400 hover:bg-green-500/10 hover:border-green-500/30 transition-colors"
            >
              <Heart className="w-7 h-7" />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
