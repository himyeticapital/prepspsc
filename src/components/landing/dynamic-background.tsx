"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BACKGROUNDS } from "@/types/widget.types";

export function DynamicBackground() {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Cycle through backgrounds every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % BACKGROUNDS.length);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  const currentBackground = BACKGROUNDS[currentIndex];

  return (
    <div className="fixed inset-0 z-0">
      {/* Keep all backgrounds mounted, only animate opacity for smooth crossfade */}
      {BACKGROUNDS.map((bg, index) => (
        <motion.div
          key={bg.id}
          initial={false}
          animate={{ opacity: index === currentIndex ? 1 : 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="absolute inset-0"
          style={{ zIndex: index === currentIndex ? 1 : 0 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bg.url}
            alt={bg.name}
            className="w-full h-full object-cover"
          />
        </motion.div>
      ))}

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/40 z-10" />

      {/* Vignette effect */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 z-10" />
    </div>
  );
}
