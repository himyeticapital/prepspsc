"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Crown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProGateProps {
  children: React.ReactNode;
  isPro: boolean;
  feature: string;
  description?: string;
  className?: string;
}

export function ProGate({
  children,
  isPro,
  feature,
  description,
  className,
}: ProGateProps) {
  if (isPro) {
    return <>{children}</>;
  }

  return (
    <div className={cn("relative", className)}>
      {/* Blurred content */}
      <div className="pointer-events-none opacity-40 blur-[2px] select-none">
        {children}
      </div>

      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-xl"
      >
        <div className="p-6 rounded-2xl bg-white/5 border border-accent/30 text-center max-w-xs">
          <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4">
            <Crown className="w-6 h-6 text-accent" />
          </div>
          <h3 className="text-lg font-semibold mb-2">{feature}</h3>
          {description && (
            <p className="text-sm text-white/60 mb-4">{description}</p>
          )}
          <Link href="/pricing">
            <Button className="premium-gradient gap-2">
              <Lock className="w-4 h-4" />
              Upgrade to Pro
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}

interface ProBadgeProps {
  className?: string;
}

export function ProBadge({ className }: ProBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium",
        "bg-accent/20 text-accent border border-accent/30 rounded-full",
        className
      )}
    >
      <Crown className="w-3 h-3" />
      PRO
    </span>
  );
}

interface ProFeatureButtonProps {
  isPro: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function ProFeatureButton({
  isPro,
  children,
  onClick,
  disabled,
  className,
}: ProFeatureButtonProps) {
  if (!isPro) {
    return (
      <Link href="/pricing">
        <Button
          variant="outline"
          className={cn(
            "gap-2 border-accent/30 text-white/60 hover:text-accent hover:border-accent/50",
            className
          )}
        >
          <Lock className="w-4 h-4" />
          {children}
          <ProBadge className="ml-1" />
        </Button>
      </Link>
    );
  }

  return (
    <Button onClick={onClick} disabled={disabled} className={className}>
      {children}
    </Button>
  );
}
