"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { MessageCircle, ChevronRight, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BotConnectStepProps {
  userId: string;
  onSkip: () => void;
  onComplete: () => void;
}

// Get bot username from env (should be set in production)
const TELEGRAM_BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "PrepSPSCBot";

export function BotConnectStep({ userId, onSkip, onComplete }: BotConnectStepProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  // Generate deep link for Telegram bot with start parameter
  // The start parameter includes the user ID so the bot can link the account
  const telegramDeepLink = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${userId}`;

  const handleConnect = () => {
    setIsConnecting(true);
    // Open Telegram in new tab
    window.open(telegramDeepLink, "_blank");

    // After a delay, move to next step
    // In production, you'd poll to check if connection was successful
    setTimeout(() => {
      onComplete();
    }, 3000);
  };

  const features = [
    "Daily study reminders at 8 AM",
    "Quick quizzes on any topic",
    "Save notes from anywhere",
    "Progress updates & streak alerts",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      {/* Telegram Logo */}
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-[#0088cc]/20 flex items-center justify-center">
          <MessageCircle className="w-10 h-10 text-[#0088cc]" />
        </div>
      </div>

      {/* Title */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-white mb-2">
          Connect Telegram Bot
        </h2>
        <p className="text-white/60 text-sm">
          Get study reminders and quick quizzes right in Telegram
        </p>
      </div>

      {/* Features */}
      <div className="bg-white/5 rounded-lg p-4 space-y-3">
        {features.map((feature, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center gap-3 text-sm text-white/80"
          >
            <Check className="w-4 h-4 text-primary flex-shrink-0" />
            {feature}
          </motion.div>
        ))}
      </div>

      {/* Connect Button */}
      <Button
        onClick={handleConnect}
        disabled={isConnecting}
        className="w-full bg-[#0088cc] hover:bg-[#0088cc]/90 gap-2"
        size="lg"
      >
        {isConnecting ? (
          <>
            Opening Telegram...
          </>
        ) : (
          <>
            <MessageCircle className="w-5 h-5" />
            Connect Telegram
            <ExternalLink className="w-4 h-4" />
          </>
        )}
      </Button>

      {/* Instructions */}
      {isConnecting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-sm"
        >
          <p className="text-white/80">
            <strong>Next steps:</strong>
          </p>
          <ol className="list-decimal list-inside mt-2 space-y-1 text-white/60">
            <li>Click "Start" in the Telegram bot</li>
            <li>Your account will be linked automatically</li>
            <li>You'll receive your first reminder tomorrow at 8 AM</li>
          </ol>
        </motion.div>
      )}

      {/* Skip Option */}
      <button
        onClick={onSkip}
        className="w-full text-center text-sm text-white/40 hover:text-white/60 transition-colors"
      >
        Skip for now — you can connect later in Settings
      </button>
    </motion.div>
  );
}
