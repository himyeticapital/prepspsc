"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Check, Zap } from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const proFeatures = [
  "Access to all premium mock tests",
  "Unlimited AI generations (mindmaps, flashcards, quizzes)",
  "1.5x XP multiplier on all activities",
  "Detailed performance analytics",
  "Custom profile frames & Pro achievements",
];

export function UpgradeModal({ open, onOpenChange }: UpgradeModalProps) {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-destructive/20 max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
            <Crown className="w-8 h-8 text-accent" />
          </div>
          <DialogTitle className="text-2xl">Upgrade to Pro</DialogTitle>
          <DialogDescription>
            Unlock premium tests and supercharge your Sikkim PSC preparation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-6">
          {proFeatures.map((feature, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-primary" />
              </div>
              <span className="text-sm">{feature}</span>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <Button
            className="w-full premium-gradient text-white"
            onClick={() => {
              onOpenChange(false);
              router.push("/pricing");
            }}
          >
            <Zap className="w-4 h-4 mr-2" />
            View Pricing Plans
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
