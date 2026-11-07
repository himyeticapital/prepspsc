"use client";

import { TypewriterText } from "./typewriter-text";
import { FeatureCard } from "./feature-card";
import { FloatingParticles } from "./floating-particles";
import { TestimonialsSection } from "./testimonials-section";
import { Button } from "@/components/ui/button";
import { RedPandaMascot } from "@/components/ui/red-panda-mascot";
import { LayoutDashboard, Users, BookOpen, Sparkles, CalendarDays, Network, ArrowRight } from "lucide-react";
import Link from "next/link";

const phrases = [
  "Your AI powered study space for Sikkim PSC exam preparation",
  "Master your exams with interactive mock tests",
  "Track your progress and climb the leaderboard",
  "Collab with fellow aspirants in virtual study rooms",
  "Online coaching classes suck-Study and Revise with AI and friends instead",
  "Practice with real exam-pattern questions",
];

export function HeroWithCards() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Dark Background - Match app's exact background color */}
      <div className="fixed inset-0 bg-[#09090b]">
        {/* Subtle accent glows using app's exact primary/accent colors */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      {/* Floating Particles */}
      <FloatingParticles />

      {/* Main Content Container */}
      <div className="relative z-10 container mx-auto px-4 py-12 min-h-screen flex flex-col justify-center">
        {/* Logo at Top - Slightly left of center on mobile, left-aligned on desktop */}
        <div className="absolute top-8 left-[44%] -translate-x-1/2 md:left-8 md:translate-x-0">
          <RedPandaMascot size="md" showText={true} />
        </div>

        {/* Hero Text Section - Integrated */}
        <div className="text-center mb-12">
          <div className="text-xl md:text-2xl text-white/80 font-mono min-h-[2em] flex items-center justify-center mt-16">
            <TypewriterText
              phrases={phrases}
              typingSpeed={80}
              deletingSpeed={50}
              pauseDuration={3000}
            />
          </div>
          <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
            A gamified, social study platform built for Sikkim PSC aspirants
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mt-8 px-4 sm:px-0">
            <Link href="/signup" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
                Start Learning <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link href="/login" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-border hover:bg-white/5">
                Continue Learning
              </Button>
            </Link>
          </div>
        </div>

        {/* 2x2 Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          <FeatureCard
            title="Dashboard"
            description="Track your progress, XP, streaks, and achievements in one beautiful dashboard"
            icon={<LayoutDashboard className="w-6 h-6" />}
            image="/landing/dashboard-mockup.svg"
            delay={0}
            priority
          />
          <FeatureCard
            title="Study Rooms"
            description="Join virtual study rooms and collaborate with fellow aspirants"
            icon={<Users className="w-6 h-6" />}
            image="/landing/rooms-mockup.svg"
            delay={0.1}
          />
          <FeatureCard
            title="Mock Tests"
            description="Interactive mock tests for all upcoming Sikkim PSC exams"
            icon={<BookOpen className="w-6 h-6" />}
            image="/landing/mock-tests-mockup.svg"
            delay={0.2}
          />
          <FeatureCard
            title="Study with AI"
            description="Generate summaries, mind maps, flashcards, quizzes & infographics — revise with Spaced Repetition & Active Recall"
            icon={<Sparkles className="w-6 h-6" />}
            image="/landing/study-ai-mockup.svg"
            delay={0.3}
          />
          <FeatureCard
            title="Study Planner"
            description="AI-generated personalised study plans with week-by-week schedules, Leitner box spaced repetition, and XP rewards"
            icon={<CalendarDays className="w-6 h-6" />}
            image="/landing/study-planner-mockup.svg"
            delay={0.4}
          />
          <FeatureCard
            title="Knowledge Graph"
            description="Visualise topic prerequisites as a live dependency graph — unlock topics in the right order and get AI-recommended next steps"
            icon={<Network className="w-6 h-6" />}
            image="/landing/knowledge-graph-mockup.svg"
            delay={0.5}
          />
        </div>

        {/* Testimonials Section */}
        <TestimonialsSection />

        {/* Footer - Centered on mobile, spread on desktop */}
        <div className="flex flex-col items-center md:flex-row md:items-start md:justify-between mt-12 text-white/40 text-sm gap-4 md:gap-0">
          <div className="hidden md:block flex-1" />
          <p className="text-center">Made with ❤️ in Sikkim</p>
          <div className="flex flex-col items-center md:items-end md:flex-1 gap-2">
            <div className="flex items-center gap-3">
              <a
                href="https://www.instagram.com/prepspsc"
                target="_blank"
                rel="noopener noreferrer"
                className="group text-white/40 transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(225,48,108,0.7)]"
                aria-label="Follow us on Instagram"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                >
                  <defs>
                    <linearGradient id="instagram-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#FCAF45" />
                      <stop offset="25%" stopColor="#F77737" />
                      <stop offset="50%" stopColor="#E1306C" />
                      <stop offset="75%" stopColor="#C13584" />
                      <stop offset="100%" stopColor="#833AB4" />
                    </linearGradient>
                  </defs>
                  <path
                    className="fill-current group-hover:fill-[url(#instagram-gradient)] transition-all duration-300"
                    d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"
                  />
                </svg>
              </a>
              <a
                href="https://www.reddit.com/r/prepspsc"
                target="_blank"
                rel="noopener noreferrer"
                className="group text-white/40 transition-all duration-300 hover:text-[#FF4500] hover:drop-shadow-[0_0_8px_rgba(255,69,0,0.7)]"
                aria-label="Join us on Reddit"
              >
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                >
                  <path
                    className="fill-current transition-all duration-300"
                    d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"
                  />
                </svg>
              </a>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Link href="/terms" className="hover:text-primary transition-colors">Terms</Link>
              <span className="text-white/20">·</span>
              <Link href="/refund-policy" className="hover:text-primary transition-colors">Refund Policy</Link>
              <span className="text-white/20">·</span>
              <Link href="/contact" className="hover:text-primary transition-colors">Contact</Link>
              <span className="text-white/20">·</span>
              <Link href="/developers" className="hover:text-primary transition-colors">Developers</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
