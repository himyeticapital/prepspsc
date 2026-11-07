"use client";

import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import { useAnimationFrame } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

interface Testimonial {
  name: string;
  handle: string;
  username: string;
  fallbackAvatar: string;
  quote: string;
}

const upperRowTestimonials: Testimonial[] = [
  {
    name: "Abhishek Subba",
    handle: "@abhisheksubba.py",
    username: "abhisheksubba.py",
    fallbackAvatar: "/avatars/avatar-10.svg",
    quote: "Study rooms changed everything. Studying with fellow aspirants in real-time keeps me accountable and motivated.",
  },
  {
    name: "pratish gautam",
    handle: "@praz",
    username: "praz",
    fallbackAvatar: "/avatars/avatar-7.svg",
    quote: "AI-generated flashcards and mindmaps are incredible. What took hours now takes minutes. Perfect for a study session!",
  },
  {
    name: "VAN",
    handle: "@vandergough",
    username: "vandergough",
    fallbackAvatar: "/avatars/avatar-5.svg",
    quote: "The leaderboard adds healthy competition. Seeing my rank rise keeps me pushing harder every single day.",
  },
  {
    name: "Sunuhang Subba",
    handle: "@sunu",
    username: "sunu",
    fallbackAvatar: "/avatars/avatar-1.svg",
    quote: "Spaced repetition reminders tell me exactly when to revise. My retention has improved dramatically.",
  },
];

const lowerRowTestimonials: Testimonial[] = [
  {
    name: "Meshach",
    handle: "@meshachkhing",
    username: "meshachkhing",
    fallbackAvatar: "/avatars/avatar-3.svg",
    quote: "Chatting with fellow aspirants while studying makes preparation less lonely. We share tips and motivate each other.",
  },
  {
    name: "Vishal",
    handle: "@pandeyvishal177",
    username: "pandeyvishal177",
    fallbackAvatar: "/avatars/avatar-3.svg",
    quote: "Paper blurting for active recall is genius. Writing what I remember before checking answers reinforced my learning.",
  },
  {
    name: "Shraddha S",
    handle: "@shraddha.marist",
    username: "shraddha.marist",
    fallbackAvatar: "/avatars/avatar-2.svg",
    quote: "Earning achievements and maintaining streaks makes studying feel like a game. I actually look forward to daily practice!",
  },
];

function TestimonialCard({
  testimonial,
  avatarUrl
}: {
  testimonial: Testimonial;
  avatarUrl: string;
}) {
  return (
    <div className="flex-shrink-0 w-[260px] sm:w-[300px] p-3 sm:p-4 rounded-xl widget-glass transition-all duration-300 cursor-default ring-1 ring-transparent hover:ring-primary/60 hover:shadow-[0_0_30px_rgba(45,212,191,0.25)] hover:scale-[1.02]">
      <div className="flex items-start gap-2 sm:gap-3">
        <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden border-2 border-primary/30 flex-shrink-0 transition-all duration-300 hover:border-primary hover:scale-110">
          <Image
            src={avatarUrl}
            alt={testimonial.name}
            fill
            className="object-cover"
            unoptimized={avatarUrl.startsWith("http")}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed mb-2">
            &ldquo;{testimonial.quote}&rdquo;
          </p>
          <div>
            <p className="text-[10px] sm:text-xs font-medium text-foreground">{testimonial.name}</p>
            <p className="text-[10px] sm:text-xs text-primary">{testimonial.handle}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Infinite scroll row component using JS animation
function ScrollingRow({
  testimonials,
  direction,
  getAvatarUrl,
  rowKey,
}: {
  testimonials: Testimonial[];
  direction: "left" | "right";
  getAvatarUrl: (t: Testimonial) => string;
  rowKey: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xPosRef = useRef(0);
  const [, forceUpdate] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const speed = 0.5; // pixels per frame

  // Measure content width on mount and resize
  useEffect(() => {
    const measureWidth = () => {
      if (containerRef.current) {
        // Get all cards in the first set
        const firstSetCards = containerRef.current.querySelectorAll('[data-set="0"]');
        if (firstSetCards.length > 0) {
          // Calculate total width: sum of all card widths + gaps
          let totalWidth = 0;
          const gap = window.innerWidth >= 640 ? 24 : 16; // gap-6 = 24px, gap-4 = 16px

          firstSetCards.forEach((card, index) => {
            totalWidth += (card as HTMLElement).offsetWidth;
            if (index < firstSetCards.length - 1) {
              totalWidth += gap;
            }
          });

          // Add one more gap for spacing between sets
          totalWidth += gap;

          setContentWidth(totalWidth);
        }
      }
    };

    // Delay measurement to ensure cards are rendered
    const timer = setTimeout(measureWidth, 100);
    window.addEventListener("resize", measureWidth);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", measureWidth);
    };
  }, []);

  // Initialize position for right-scrolling row
  useEffect(() => {
    if (direction === "right" && contentWidth > 0) {
      xPosRef.current = -contentWidth;
      forceUpdate((n) => n + 1);
    }
  }, [direction, contentWidth]);

  // Animation loop using ref for smooth animation
  useAnimationFrame(() => {
    if (contentWidth === 0) return;

    if (direction === "left") {
      xPosRef.current -= speed;
      // Reset when first set is completely scrolled out
      if (Math.abs(xPosRef.current) >= contentWidth) {
        xPosRef.current = 0;
      }
    } else {
      xPosRef.current += speed;
      // Reset when scrolled too far right
      if (xPosRef.current >= 0) {
        xPosRef.current = -contentWidth;
      }
    }

    // Apply transform directly for smoother animation
    if (containerRef.current) {
      containerRef.current.style.transform = `translateX(${xPosRef.current}px)`;
    }
  });

  // Duplicate testimonials for seamless loop
  const duplicated = [...testimonials, ...testimonials];

  return (
    <div className="overflow-hidden">
      <div
        ref={containerRef}
        className="flex gap-4 sm:gap-6 pl-4"
        style={{ willChange: "transform" }}
      >
        {duplicated.map((testimonial, index) => (
          <div
            key={`${rowKey}-${index}`}
            data-set={index < testimonials.length ? "0" : "1"}
            className="flex-shrink-0"
          >
            <TestimonialCard
              testimonial={testimonial}
              avatarUrl={getAvatarUrl(testimonial)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TestimonialsSection() {
  const [avatars, setAvatars] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchAvatars() {
      const supabase = createClient();
      const allTestimonials = [...upperRowTestimonials, ...lowerRowTestimonials];
      const usernames = allTestimonials.map((t) => t.username);

      const { data } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .in("username", usernames);

      if (data) {
        const avatarMap: Record<string, string> = {};
        data.forEach((profile) => {
          if (profile.avatar_url) {
            avatarMap[profile.username] = profile.avatar_url;
          }
        });
        setAvatars(avatarMap);
      }
    }

    fetchAvatars();
  }, []);

  const getAvatarUrl = (testimonial: Testimonial) => {
    return avatars[testimonial.username] || testimonial.fallbackAvatar;
  };

  return (
    <section className="py-10 sm:py-16 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6 sm:mb-8 px-4 max-w-5xl mx-auto">
        <span className="text-primary text-lg sm:text-xl font-bold">&#10095;</span>
        <h2 className="text-lg sm:text-xl font-semibold text-foreground">What Our Beta Users Say</h2>
      </div>

      {/* Upper Row - Scroll Left */}
      <div className="mb-4 sm:mb-6">
        <ScrollingRow
          testimonials={upperRowTestimonials}
          direction="left"
          getAvatarUrl={getAvatarUrl}
          rowKey="upper"
        />
      </div>

      {/* Lower Row - Scroll Right */}
      <div>
        <ScrollingRow
          testimonials={lowerRowTestimonials}
          direction="right"
          getAvatarUrl={getAvatarUrl}
          rowKey="lower"
        />
      </div>

      {/* Marketing Tagline */}
      <div className="max-w-5xl mx-auto px-4">
        <p className="text-center text-[10px] sm:text-xs text-muted-foreground mt-6 sm:mt-8 leading-relaxed transition-all duration-300 cursor-default hover:text-primary hover:drop-shadow-[0_0_12px_rgba(45,212,191,0.7)]">
          Why no toppers testimonials?<br className="sm:hidden" /> Toppers already topped, now it&apos;s your turn!
        </p>
      </div>
    </section>
  );
}
