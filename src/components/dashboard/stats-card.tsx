"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "primary" | "accent" | "destructive";
  className?: string;
}

const variantStyles = {
  default: "text-foreground",
  primary: "text-primary",
  accent: "text-accent",
  destructive: "text-destructive",
};

const iconBgStyles = {
  default: "bg-secondary",
  primary: "bg-primary/10",
  accent: "bg-accent/10",
  destructive: "bg-destructive/10",
};

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  className,
}: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("glass-card p-6", className)}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className={cn("text-3xl font-bold mt-1", variantStyles[variant])}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
          {trend && (
            <p
              className={cn(
                "text-xs mt-2 flex items-center gap-1",
                trend.isPositive ? "text-primary" : "text-destructive"
              )}
            >
              {trend.isPositive ? "+" : "-"}
              {Math.abs(trend.value)}%
              <span className="text-muted-foreground">vs last week</span>
            </p>
          )}
        </div>
        <div
          className={cn(
            "p-3 rounded-xl",
            iconBgStyles[variant]
          )}
        >
          <Icon className={cn("w-6 h-6", variantStyles[variant])} />
        </div>
      </div>
    </motion.div>
  );
}
