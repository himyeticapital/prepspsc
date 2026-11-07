"use client";

import { TypewriterText } from "./typewriter-text";
import {
  BookOpen,
  Timer,
  Users,
  Trophy,
} from "lucide-react";

const phrases = [
  "Your cozy study space for Sikkim PSC exam preparation",
  "Master your exams with interactive mock tests",
  "Track your progress and climb the leaderboard",
  "Join fellow aspirants in virtual study rooms",
  "Study smarter, not harder with PrepSPSC",
];

const features = [
  { icon: Timer, label: "Study Timer" },
  { icon: Users, label: "Study Rooms" },
  { icon: BookOpen, label: "Mock Tests" },
  { icon: Trophy, label: "Leaderboard" },
];

export function HeroSection() {
  return (
    <>
      {/* Subtle Greeting - Top Left */}
      <div className="fixed top-24 left-6 md:left-10 z-10 max-w-md">
        <p className="text-sm text-white/60 mb-1">Welcome to</p>
        <h1 className="text-3xl md:text-4xl font-bold text-shadow mb-3">
          <span className="text-primary">Prep</span>
          <span className="text-white">SPSC</span>
        </h1>
        {/* Retro terminal-style typewriter effect */}
        <div className="font-mono text-sm md:text-base text-white/80 min-h-[1.5em]">
          <TypewriterText
            phrases={phrases}
            typingSpeed={40}
            deletingSpeed={25}
            pauseDuration={2500}
          />
        </div>
      </div>

      {/* Feature Chips - Bottom Left */}
      <div className="fixed bottom-6 left-6 md:left-10 z-10 flex flex-wrap gap-2 max-w-sm">
        {features.map((feature) => (
          <div
            key={feature.label}
            className="feature-chip flex items-center gap-2 px-3 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/80 text-sm"
          >
            <feature.icon className="w-4 h-4 text-primary" />
            <span>{feature.label}</span>
          </div>
        ))}
      </div>
    </>
  );
}
