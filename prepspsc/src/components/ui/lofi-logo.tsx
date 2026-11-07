"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";

interface LofiLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function LofiLogo({ className, size = "md", showText = true }: LofiLogoProps) {
  const sizeClasses = {
    sm: "h-6",
    md: "h-8",
    lg: "h-10",
  };

  const textSizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };

  return (
    <Link href="/" className={cn("flex items-center gap-2 group", className)}>
      {/* Cute Red Panda with Glasses */}
      <div className={cn("relative", sizeClasses[size])}>
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-auto"
        >
          {/* Ears */}
          <ellipse cx="10" cy="8" rx="5" ry="5" fill="#C75B39" />
          <ellipse cx="10" cy="8" rx="3" ry="3" fill="#F4A683" />
          <ellipse cx="30" cy="8" rx="5" ry="5" fill="#C75B39" />
          <ellipse cx="30" cy="8" rx="3" ry="3" fill="#F4A683" />

          {/* Main face */}
          <ellipse cx="20" cy="22" rx="16" ry="14" fill="#C75B39" />

          {/* Face markings - cream/white areas */}
          <ellipse cx="20" cy="26" rx="12" ry="10" fill="#F4E4D8" />

          {/* Cheek patches (darker rust) */}
          <ellipse cx="9" cy="22" rx="4" ry="3" fill="#A04422" />
          <ellipse cx="31" cy="22" rx="4" ry="3" fill="#A04422" />

          {/* Eye white areas */}
          <ellipse cx="13" cy="20" rx="5" ry="4" fill="white" />
          <ellipse cx="27" cy="20" rx="5" ry="4" fill="white" />

          {/* Eyes (pupils) */}
          <circle cx="14" cy="20" r="2.5" fill="#2D1810" />
          <circle cx="26" cy="20" r="2.5" fill="#2D1810" />

          {/* Eye shine */}
          <circle cx="15" cy="19" r="1" fill="white" />
          <circle cx="27" cy="19" r="1" fill="white" />

          {/* Glasses frame */}
          <circle
            cx="13"
            cy="20"
            r="6"
            fill="none"
            stroke="#14b8a6"
            strokeWidth="1.5"
          />
          <circle
            cx="27"
            cy="20"
            r="6"
            fill="none"
            stroke="#14b8a6"
            strokeWidth="1.5"
          />
          {/* Glasses bridge */}
          <path
            d="M19 20 L21 20"
            stroke="#14b8a6"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Glasses arms */}
          <path
            d="M7 19 L4 17"
            stroke="#14b8a6"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M33 19 L36 17"
            stroke="#14b8a6"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* Nose */}
          <ellipse cx="20" cy="27" rx="2.5" ry="2" fill="#2D1810" />
          <ellipse cx="20" cy="26.5" rx="1" ry="0.5" fill="#4A3A35" />

          {/* Mouth */}
          <path
            d="M17 30 Q20 33 23 30"
            fill="none"
            stroke="#2D1810"
            strokeWidth="1"
            strokeLinecap="round"
          />

          {/* Forehead marking */}
          <path
            d="M16 14 Q20 11 24 14"
            fill="none"
            stroke="#A04422"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Text */}
      {showText && (
        <span
          className={cn(
            "font-bold text-white tracking-tight",
            textSizeClasses[size]
          )}
        >
          <span className="text-teal-400">Prep</span>
          <span className="text-white">SPSC</span>
        </span>
      )}
    </Link>
  );
}
