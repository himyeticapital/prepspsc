"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  AlertCircle,
  CheckCircle,
  Zap,
  FileText,
  Map,
  ListChecks,
  HelpCircle,
  BarChart3,
} from "lucide-react";

const GENERATION_TYPES = [
  { key: "summary", label: "Summary", icon: FileText, color: "text-green-400" },
  { key: "mindmap", label: "Mind Map", icon: Map, color: "text-blue-400" },
  { key: "flashcards", label: "Flashcards", icon: ListChecks, color: "text-yellow-400" },
  { key: "quiz", label: "Quiz", icon: HelpCircle, color: "text-purple-400" },
  { key: "infographic", label: "Infographic", icon: BarChart3, color: "text-red-400" },
];

interface UsageLimitBannerProps {
  generationsByType: Record<string, number>;
  isPro: boolean;
  onUpgradeClick?: () => void;
  className?: string;
}

export function UsageLimitBanner({
  generationsByType,
  isPro,
  onUpgradeClick,
  className,
}: UsageLimitBannerProps) {
  // Pro users have unlimited
  if (isPro) {
    return (
      <div className={cn("p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20", className)}>
        <div className="flex items-center gap-2 text-sm">
          <Zap className="w-4 h-4 text-purple-400" />
          <span className="text-white/80">
            <span className="text-purple-400 font-medium">Unlimited</span> AI generations
          </span>
        </div>
      </div>
    );
  }

  // DEV MODE: Bypass limit display in development
  const isDev = process.env.NODE_ENV === "development";

  // Count available and used types
  const typesUsed = GENERATION_TYPES.filter(
    (type) => (generationsByType[type.key] || 0) >= 1
  );
  const typesAvailable = GENERATION_TYPES.filter(
    (type) => (generationsByType[type.key] || 0) < 1
  );
  const allUsed = typesAvailable.length === 0 && !isDev;

  if (allUsed) {
    return (
      <div className={cn("p-4 rounded-lg bg-orange-500/10 border border-orange-500/30", className)}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-400" />
            <div>
              <p className="text-sm text-orange-300 font-medium">
                Daily limit reached
              </p>
              <p className="text-xs text-white/50">
                Upgrade to Pro for unlimited AI generations
              </p>
            </div>
          </div>
          {onUpgradeClick && (
            <Button
              onClick={onUpgradeClick}
              size="sm"
              className="bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white shrink-0"
            >
              <Sparkles className="w-4 h-4 mr-1" />
              Upgrade
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("p-3 rounded-lg bg-white/5 border border-white/10", className)}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-white/80">
              <span className="text-green-400 font-medium">{typesAvailable.length}</span> of 5 types available today
            </span>
          </div>
          {onUpgradeClick && (
            <button
              onClick={onUpgradeClick}
              className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
            >
              Get unlimited
            </button>
          )}
        </div>

        {/* Type indicators */}
        <div className="flex flex-wrap gap-2">
          {GENERATION_TYPES.map((type) => {
            const isUsed = (generationsByType[type.key] || 0) >= 1;
            const Icon = type.icon;
            return (
              <div
                key={type.key}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs",
                  isUsed
                    ? "bg-white/5 text-white/40"
                    : "bg-white/10 text-white/80"
                )}
                title={isUsed ? `${type.label}: Used today` : `${type.label}: Available`}
              >
                <Icon className={cn("w-3 h-3", isUsed ? "text-white/30" : type.color)} />
                <span className={isUsed ? "line-through" : ""}>{type.label}</span>
                {isUsed && <CheckCircle className="w-3 h-3 text-white/30" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
