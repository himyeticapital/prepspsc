"use client";

import { useWidgetStore } from "@/stores/widget-store";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

export function BackgroundLayer() {
  const currentBackground = useWidgetStore((state) => state.currentBackground);
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isLofi = mounted && theme === "lofi";
  // Always use user's selected background - lofi mode just adds warm overlays
  const activeBackground = currentBackground;

  // Check if it's a solid color, external URL (Unsplash), or local
  const isSolid = activeBackground.startsWith("solid:");
  const solidColor = isSolid ? activeBackground.replace("solid:", "") : null;
  const isExternal = activeBackground.startsWith("http");

  return (
    <div className="fixed inset-0 z-0 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeBackground}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0"
        >
          {isSolid ? (
            // Solid color background
            <div
              className="w-full h-full"
              style={{ backgroundColor: solidColor || "#000" }}
            />
          ) : (
            // Image background
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={activeBackground}
              alt="Background"
              className="w-full h-full object-cover"
              loading={isExternal ? "lazy" : "eager"}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Overlay - warmer for lofi mode */}
      <div
        className="absolute inset-0 transition-colors duration-500"
        style={{
          background: isLofi
            ? "rgba(26, 22, 18, 0.45)"
            : "rgba(0, 0, 0, 0.30)"
        }}
      />

      {/* Vignette effect - warmer for lofi */}
      <div
        className="absolute inset-0 transition-all duration-500"
        style={{
          background: isLofi
            ? "radial-gradient(ellipse at center, transparent 0%, rgba(26, 22, 18, 0.5) 100%)"
            : "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%)",
        }}
      />

      {/* Subtle gradient at bottom for UI elements */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 transition-colors duration-500"
        style={{
          background: isLofi
            ? "linear-gradient(to top, rgba(26, 22, 18, 0.6), transparent)"
            : "linear-gradient(to top, rgba(0, 0, 0, 0.5), transparent)"
        }}
      />

      {/* Lofi warm grain overlay for extra coziness */}
      {isLofi && (
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
          }}
        />
      )}
    </div>
  );
}
