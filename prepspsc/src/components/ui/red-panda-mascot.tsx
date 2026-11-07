"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useState } from "react";

interface RedPandaMascotProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
}

export function RedPandaMascot({ className, size = "md", showText = true }: RedPandaMascotProps) {
  const [isHovered, setIsHovered] = useState(false);

  const sizeConfig = {
    sm: { class: "h-12 w-12", pixels: 48 },
    md: { class: "h-14 w-14", pixels: 56 },
    lg: { class: "h-16 w-16", pixels: 64 },
    xl: { class: "h-20 w-20", pixels: 80 },
  };

  const textSizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
    xl: "text-3xl",
  };

  return (
    <Link href="/" className={cn("flex items-center gap-0.5 group", className)}>
      {/* Cute Mascot with teal glow on hover */}
      <motion.div
        className={cn("relative", sizeConfig[size].class)}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        onTapStart={() => setIsHovered(true)}
        onTap={() => setTimeout(() => setIsHovered(false), 300)}
        animate={isHovered ? {
          scale: 1.15,
          rotate: [0, -5, 5, -5, 0],
        } : {
          scale: 1,
          rotate: 0,
        }}
        transition={{
          scale: { duration: 0.2 },
          rotate: { duration: 0.4, ease: "easeInOut" },
        }}
        style={{
          filter: isHovered
            ? "drop-shadow(0 0 8px rgba(45, 212, 191, 0.8)) drop-shadow(0 0 16px rgba(45, 212, 191, 0.5))"
            : "none",
        }}
      >
        <Image
          src="/mascot.png"
          alt="PrepSPSC Mascot"
          width={sizeConfig[size].pixels}
          height={sizeConfig[size].pixels}
          className="h-full w-auto object-contain transition-all duration-200"
          priority
        />

        {/* Teal glow ring on hover */}
        {isHovered && (
          <motion.div
            className="absolute inset-0 rounded-full"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1.2 }}
            exit={{ opacity: 0 }}
            style={{
              background: "radial-gradient(circle, rgba(45, 212, 191, 0.3) 0%, transparent 70%)",
            }}
          />
        )}
      </motion.div>

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
