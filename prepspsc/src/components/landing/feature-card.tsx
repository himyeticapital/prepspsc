"use client";

import { motion } from "framer-motion";
import { useState, useRef, MouseEvent } from "react";
import Image from "next/image";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  image: string;
  delay?: number;
  priority?: boolean;
}

export function FeatureCard({
  title,
  description,
  icon,
  image,
  delay = 0,
  priority = false,
}: FeatureCardProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) / 20; // Divide by 20 for subtle effect
    const y = (e.clientY - rect.top - rect.height / 2) / 20;

    setMousePosition({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePosition({ x: 0, y: 0 });
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="widget-glass p-5 rounded-2xl relative overflow-hidden group cursor-pointer"
      style={{
        transform: `perspective(1000px) rotateX(${-mousePosition.y}deg) rotateY(${mousePosition.x}deg) scale(1)`,
        transition: "transform 0.3s ease-out",
      }}
    >
      {/* Icon & Title - Match app's feature chip style */}
      <motion.div
        className="flex items-center gap-2.5 mb-3 relative z-10"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: delay + 0.2, duration: 0.5 }}
      >
        <motion.div
          className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary"
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          {icon}
        </motion.div>
        <motion.h3
          className="text-lg font-bold text-foreground"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + 0.3, duration: 0.5 }}
        >
          {title}
        </motion.h3>
      </motion.div>

      {/* Description - Use muted-foreground color */}
      <motion.p
        className="text-muted-foreground text-xs mb-3 relative z-10"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay + 0.4, duration: 0.5 }}
      >
        {description}
      </motion.p>

      {/* Mockup Image - Match app's card background */}
      <motion.div
        className="relative h-36 rounded-lg overflow-hidden border border-border bg-card"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: delay + 0.5, duration: 0.5 }}
        whileHover={{ scale: 1.02 }}
      >
        <Image
          src={image}
          alt={`${title} preview`}
          fill
          priority={priority}
          className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
        />
        {/* Overlay gradient on hover - Use app's background color */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </motion.div>

      {/* Hover glow effect - Use app's exact primary color */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/5 to-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
    </motion.div>
  );
}
